<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

class User extends Authenticatable
{
    use HasFactory, Notifiable;

    public static array $roles = ['admin', 'staff', 'kasir'];

    protected $fillable = [
        'name',
        'email',
        'password',
        'role',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    public function userPermissions()
    {
        return $this->hasMany(UserPermission::class);
    }

    /**
     * Check if the user has a specific permission on a module.
     * Admin role bypasses all checks.
     */
    public function hasPermission(string $module, string $action): bool
    {
        if ($this->role === 'admin') return true;

        $perm = $this->userPermissions->firstWhere('module', $module);
        if (!$perm) return false;

        return match($action) {
            'view'   => $perm->can_view,
            'write'  => $perm->can_write,
            'delete' => $perm->can_delete,
            default  => false,
        };
    }
}
