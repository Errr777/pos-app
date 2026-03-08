<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RolePermission extends Model
{
    protected $fillable = ['role_id', 'module', 'can_view', 'can_write', 'can_delete'];

    protected $casts = [
        'can_view'   => 'boolean',
        'can_write'  => 'boolean',
        'can_delete' => 'boolean',
    ];

    public function role()
    {
        return $this->belongsTo(Role::class);
    }
}
