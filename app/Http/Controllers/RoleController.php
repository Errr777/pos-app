<?php

namespace App\Http\Controllers;

use App\Helpers\AuditLogger;
use App\Models\Role;
use App\Models\RolePermission;
use App\Models\UserPermission;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Inertia\Inertia;

class RoleController extends Controller
{
    public function __construct()
    {
        $this->middleware(function ($request, $next) {
            $user = $request->user();
            $method = $request->method();
            $action = match (true) {
                in_array($method, ['POST', 'PUT', 'PATCH']) => 'can_write',
                $method === 'DELETE' => 'can_delete',
                default => 'can_view',
            };
            if (! $user->hasPermission('users', $action)) {
                abort(403);
            }

            return $next($request);
        });
    }

    public function index()
    {
        $roles = Role::with('permissions')->orderBy('id')->get()->map(function ($role) {
            $permsKeyed = $role->permissions->keyBy('module');

            $permissions = collect(UserPermission::$modules)
                ->mapWithKeys(function ($_, $key) use ($permsKeyed) {
                    $p = $permsKeyed->get($key);

                    return [$key => [
                        'can_view' => $p ? (bool) $p->can_view : false,
                        'can_write' => $p ? (bool) $p->can_write : false,
                        'can_delete' => $p ? (bool) $p->can_delete : false,
                    ]];
                })->toArray();

            return [
                'id' => hid($role->id),
                'name' => $role->name,
                'label' => $role->label,
                'is_system' => $role->is_system,
                'permissions' => $permissions,
            ];
        });

        return Inertia::render('Users/Roles', [
            'roles' => $roles,
            'modules' => UserPermission::$modules,
        ]);
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:50|unique:roles,name|regex:/^[a-z_]+$/',
            'label' => 'required|string|max:100',
        ]);

        if ($validator->fails()) {
            return back()->withErrors($validator)->withInput();
        }

        Role::create([
            'name' => $validator->validated()['name'],
            'label' => $validator->validated()['label'],
            'is_system' => false,
        ]);

        return redirect()->route('users.roles')->with('success', 'Role berhasil ditambahkan.');
    }

    public function update(Request $request, Role $role)
    {
        if ($role->is_system) {
            return back()->withErrors(['general' => 'Role sistem tidak dapat diubah.']);
        }

        $validator = Validator::make($request->all(), [
            'label' => 'required|string|max:100',
        ]);

        if ($validator->fails()) {
            return back()->withErrors($validator)->withInput();
        }

        $role->update(['label' => $validator->validated()['label']]);

        return redirect()->route('users.roles')->with('success', 'Role berhasil diperbarui.');
    }

    public function destroy(Role $role)
    {
        if ($role->is_system) {
            return back()->withErrors(['general' => 'Role sistem tidak dapat dihapus.']);
        }

        $role->delete();

        return redirect()->route('users.roles')->with('success', 'Role berhasil dihapus.');
    }

    public function updatePermissions(Request $request, Role $role)
    {
        if ($role->is_system && $role->name === 'admin') {
            return back()->withErrors(['general' => 'Hak akses role admin tidak dapat diubah.']);
        }

        $validator = Validator::make($request->all(), [
            'permissions' => 'required|array',
            'permissions.*.can_view' => 'boolean',
            'permissions.*.can_write' => 'boolean',
            'permissions.*.can_delete' => 'boolean',
        ]);

        if ($validator->fails()) {
            return back()->withErrors($validator)->withInput();
        }

        $validModules = array_keys(UserPermission::$modules);

        foreach ($request->permissions as $module => $perms) {
            if (! in_array($module, $validModules)) {
                continue;
            }

            $canView = (bool) ($perms['can_view'] ?? false);
            $canWrite = (bool) ($perms['can_write'] ?? false);
            $canDelete = (bool) ($perms['can_delete'] ?? false);

            if ($canWrite || $canDelete) {
                $canView = true;
            }

            RolePermission::updateOrCreate(
                ['role_id' => $role->id, 'module' => $module],
                ['can_view' => $canView, 'can_write' => $canWrite, 'can_delete' => $canDelete]
            );
        }

        // Invalidate cached permissions for all users of this role
        \App\Models\User::where('role', $role->name)->pluck('id')->each(
            fn ($uid) => \Illuminate\Support\Facades\Cache::forget("user_perms_{$uid}_{$role->name}")
        );

        $modulesChanged = array_keys($request->permissions ?? []);

        AuditLogger::log('role.permissions_changed', $role, null, [
            'role_name' => $role->name,
            'modules_changed' => $modulesChanged,
        ]);

        return redirect()->route('users.roles')->with('success', 'Hak akses role berhasil diperbarui.');
    }
}
