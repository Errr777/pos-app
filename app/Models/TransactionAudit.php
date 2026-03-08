<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TransactionAudit extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'transaction_id',
        'action',
        'performed_by',
        'performed_by_name',
        'ip_address',
        'user_agent',
        'before',
        'after',
        'created_at',
    ];

    protected $casts = [
        'before'     => 'array',
        'after'      => 'array',
        'created_at' => 'datetime',
    ];

    public function transaction()
    {
        return $this->belongsTo(Transaction::class);
    }

    public function performer()
    {
        return $this->belongsTo(User::class, 'performed_by');
    }
}
