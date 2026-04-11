<?php

namespace App\Http\Middleware;

use App\Models\AppSetting;
use App\Models\InstallmentPayment;
use App\Models\Item;
use App\Models\LicenseConfig;
use App\Models\PurchaseOrder;
use App\Models\RolePermission;
use App\Models\UserPermission;
use Illuminate\Foundation\Inspiring;
use Illuminate\Http\Request;
use Inertia\Middleware;
use Tighten\Ziggy\Ziggy;

class HandleInertiaRequests extends Middleware
{
    protected $rootView = 'app';

    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    public function share(Request $request): array
    {
        [$message, $author] = str(Inspiring::quotes()->random())->explode('-');

        return [
            ...parent::share($request),
            'name' => config('app.name'),
            'quote' => ['message' => trim($message), 'author' => trim($author)],
            'auth' => [
                'user' => $request->user()
                    ? array_merge($request->user()->toArray(), ['id' => hid($request->user()->id)])
                    : null,
            ],
            'ziggy' => fn (): array => [
                ...(new Ziggy)->toArray(),
                'location' => $request->url(),
            ],
            'sidebarOpen' => ! $request->hasCookie('sidebar_state') || $request->cookie('sidebar_state') === 'true',

            'permissions' => function () use ($request) {
                $user = $request->user();
                if (! $user) {
                    return [];
                }

                // Admin bypasses everything — no DB queries needed
                if ($user->role === 'admin') {
                    return collect(UserPermission::$modules)
                        ->mapWithKeys(fn ($_, $key) => [
                            $key => ['can_view' => true, 'can_write' => true, 'can_delete' => true],
                        ])->toArray();
                }

                // Cache per user+role — cleared when permissions are updated
                return \Illuminate\Support\Facades\Cache::remember(
                    "user_perms_{$user->id}_{$user->role}",
                    300, // 5 minutes
                    function () use ($user) {
                        $rolePerms = RolePermission::join('roles', 'roles.id', '=', 'role_permissions.role_id')
                            ->where('roles.name', $user->role)
                            ->get(['role_permissions.module', 'role_permissions.can_view', 'role_permissions.can_write', 'role_permissions.can_delete'])
                            ->keyBy('module');

                        $userPerms = UserPermission::where('user_id', $user->id)
                            ->get()
                            ->keyBy('module');

                        return collect(UserPermission::$modules)
                            ->mapWithKeys(function ($_, $key) use ($rolePerms, $userPerms) {
                                $p = $userPerms->has($key) ? $userPerms->get($key) : $rolePerms->get($key);

                                return [$key => [
                                    'can_view' => $p ? (bool) $p->can_view : false,
                                    'can_write' => $p ? (bool) $p->can_write : false,
                                    'can_delete' => $p ? (bool) $p->can_delete : false,
                                ]];
                            })->toArray();
                    }
                );
            },

            'allowedWarehouseIds' => function () use ($request) {
                $user = $request->user();
                if (! $user) {
                    return [];
                }

                return collect($user->allowedWarehouseIds())->map(fn ($id) => hid($id))->values()->toArray();
            },

            'flash' => [
                'success' => $request->session()->get('success'),
                'error' => $request->session()->get('error'),
            ],

            'storeSettings' => fn () => AppSetting::allAsArray(),

            'license' => fn () => \Illuminate\Support\Facades\Cache::remember('license_config', 300, function () {
                $l = LicenseConfig::current();
                if (! $l) {
                    return null;
                }
                $staleHours = $l->last_synced_at
                    ? now()->diffInHours($l->last_synced_at)
                    : null;
                return [
                    'valid'            => $l->valid,
                    'status'           => $l->status,
                    'modules'          => $l->modules ?? [],
                    'max_users'        => $l->max_users,
                    'max_outlets'      => $l->max_outlets,
                    'expires_at'       => $l->expires_at?->toIso8601String(),
                    'last_synced_at'   => $l->last_synced_at?->toIso8601String(),
                    'sync_stale'       => $staleHours !== null && $staleHours > 24,
                    'current_users'    => \App\Models\User::count(),
                    'current_outlets'  => \App\Models\Warehouse::where('is_active', true)->count(),
                ];
            }),

            'notifications' => function () use ($request) {
                $user = $request->user();
                if (! $user) {
                    return ['lowStockCount' => 0, 'pendingPoCount' => 0, 'overdueInstallmentCount' => 0];
                }

                return \Illuminate\Support\Facades\Cache::remember('notifications_counts', 120, function () {
                    return [
                        'lowStockCount'           => Item::where('type', 'barang')->whereColumn('stok', '<', 'stok_minimal')->count(),
                        'pendingPoCount'          => PurchaseOrder::whereIn('status', ['draft', 'ordered', 'partial'])->count(),
                        'overdueInstallmentCount' => InstallmentPayment::whereIn('status', ['pending', 'overdue'])
                            ->where('due_date', '<=', now()->toDateString())
                            ->count(),
                    ];
                });
            },
        ];
    }
}
