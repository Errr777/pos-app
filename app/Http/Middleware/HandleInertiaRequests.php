<?php

namespace App\Http\Middleware;

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
            'name'  => config('app.name'),
            'quote' => ['message' => trim($message), 'author' => trim($author)],
            'auth'  => ['user' => $request->user()],
            'ziggy' => fn (): array => [
                ...(new Ziggy)->toArray(),
                'location' => $request->url(),
            ],
            'sidebarOpen' => ! $request->hasCookie('sidebar_state') || $request->cookie('sidebar_state') === 'true',

            'permissions' => function () use ($request) {
                $user = $request->user();
                if (!$user) return [];

                // Admin bypasses everything
                if ($user->role === 'admin') {
                    return collect(UserPermission::$modules)
                        ->mapWithKeys(fn ($_, $key) => [
                            $key => ['can_view' => true, 'can_write' => true, 'can_delete' => true],
                        ])->toArray();
                }

                // Start with role-level defaults
                $rolePerms = RolePermission::join('roles', 'roles.id', '=', 'role_permissions.role_id')
                    ->where('roles.name', $user->role)
                    ->get(['role_permissions.module', 'role_permissions.can_view', 'role_permissions.can_write', 'role_permissions.can_delete'])
                    ->keyBy('module');

                // User-specific overrides
                $userPerms = UserPermission::where('user_id', $user->id)
                    ->get()
                    ->keyBy('module');

                return collect(UserPermission::$modules)
                    ->mapWithKeys(function ($_, $key) use ($rolePerms, $userPerms) {
                        // User permission overrides role permission if present
                        if ($userPerms->has($key)) {
                            $p = $userPerms->get($key);
                        } else {
                            $p = $rolePerms->get($key);
                        }
                        return [$key => [
                            'can_view'   => $p ? (bool) $p->can_view   : false,
                            'can_write'  => $p ? (bool) $p->can_write  : false,
                            'can_delete' => $p ? (bool) $p->can_delete : false,
                        ]];
                    })->toArray();
            },

            'allowedWarehouseIds' => function () use ($request) {
                $user = $request->user();
                if (!$user) return [];
                return $user->allowedWarehouseIds(); // empty = all allowed
            },

            'flash' => [
                'success' => $request->session()->get('success'),
                'error'   => $request->session()->get('error'),
            ],
        ];
    }
}
