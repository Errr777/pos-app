<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DeliveryOrder extends Model
{
    protected $fillable = [
        'do_number',
        'from_warehouse_id',
        'to_warehouse_id',
        'status',
        'sender_id',
        'sender_name',
        'recipient_id',
        'recipient_name',
        'sent_at',
        'confirmed_at',
        'note',
        'created_by',
    ];

    protected $casts = [
        'sent_at'      => 'datetime',
        'confirmed_at' => 'datetime',
    ];

    // ── Relations ─────────────────────────────────────────────────────────────

    public function fromWarehouse()
    {
        return $this->belongsTo(Warehouse::class, 'from_warehouse_id');
    }

    public function toWarehouse()
    {
        return $this->belongsTo(Warehouse::class, 'to_warehouse_id');
    }

    public function items()
    {
        return $this->hasMany(DeliveryOrderItem::class);
    }

    public function sender()
    {
        return $this->belongsTo(User::class, 'sender_id');
    }

    public function recipient()
    {
        return $this->belongsTo(User::class, 'recipient_id');
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function stockTransfers()
    {
        return $this->hasMany(StockTransfer::class);
    }

    // ── Scopes ────────────────────────────────────────────────────────────────

    public function scopePending($query)
    {
        return $query->where('status', 'pending');
    }

    public function scopeConfirmed($query)
    {
        return $query->where('status', 'confirmed');
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    public function isPending(): bool
    {
        return $this->status === 'pending';
    }

    public function isConfirmed(): bool
    {
        return $this->status === 'confirmed';
    }

    public function isCancelled(): bool
    {
        return $this->status === 'cancelled';
    }

    public static function generateNumber(): string
    {
        $prefix = 'SJ-' . now()->format('Ymd') . '-';
        $last   = static::where('do_number', 'like', $prefix . '%')->count();
        return $prefix . str_pad($last + 1, 4, '0', STR_PAD_LEFT);
    }
}
