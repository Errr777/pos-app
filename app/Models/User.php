<?php

namespace App\Models;

use App\Traits\HasHashId;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use App\Models\RolePermission;

class User extends Authenticatable
{
    use HasHashId;

    use HasFactory, Notifiable;

    public static array $roles = ['admin', 'manajer', 'staff', 'kasir'];

    protected $fillable = [
        'name',
        'email',
        'password',
        'role',
        'is_active',
        'last_login_at',
    ];

    protected $hidden = [
        'password',
        'remember_token',
        'email_verified_at',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'last_login_at'     => 'datetime',
            'password'          => 'hashed',
            'is_active'         => 'boolean',
        ];
    }

    public function userPermissions()
    {
        return $this->hasMany(UserPermission::class);
    }

    /**
     * Warehouses explicitly assigned to this user.
     * Empty = access all warehouses.
     */
    public function assignedWarehouses()
    {
        return $this->belongsToMany(Warehouse::class, 'user_warehouses');
    }

    /**
     * Returns array of allowed warehouse IDs for this user.
     * Empty array means "all warehouses allowed" (no restriction).
     * Admin always returns empty array (= all allowed).
     */
    public function allowedWarehouseIds(): array
    {
        if ($this->role === 'admin') return [];
        return $this->assignedWarehouses()->pluck('warehouses.id')->toArray();
    }

    /**
     * Check if the user has a specific permission on a module.
     * Admin role bypasses all checks.
     */
    public function hasPermission(string $module, string $action): bool
    {
        if ($this->role === 'admin') return true;

        // User-specific override takes precedence; fall back to role-level permission
        $perm = $this->userPermissions->firstWhere('module', $module)
            ?? RolePermission::join('roles', 'roles.id', '=', 'role_permissions.role_id')
                ->where('roles.name', $this->role)
                ->where('role_permissions.module', $module)
                ->first(['role_permissions.can_view', 'role_permissions.can_write', 'role_permissions.can_delete']);

        if (!$perm) return false;

        return match($action) {
            'can_view',   'view'   => (bool) $perm->can_view,
            'can_write',  'write'  => (bool) $perm->can_write,
            'can_delete', 'delete' => (bool) $perm->can_delete,
            default  => false,
        };
    }
}
