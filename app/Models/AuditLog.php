<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AuditLog extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'user_id',
        'user_name_snapshot',
        'action',
        'subject_type',
        'subject_id',
        'subject_label',
        'old_value',
        'new_value',
        'ip_address',
        'occurred_at',
    ];

    protected $casts = [
        'old_value'   => 'array',
        'new_value'   => 'array',
        'occurred_at' => 'datetime',
    ];
}
