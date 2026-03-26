<?php

namespace App\Models;

use App\Traits\HasHashId;

use Illuminate\Database\Eloquent\Model;

class Role extends Model
{
    use HasHashId;

    protected $fillable = ['name', 'label', 'is_system'];

    protected $casts = ['is_system' => 'boolean'];

    public function permissions()
    {
        return $this->hasMany(RolePermission::class);
    }
}
