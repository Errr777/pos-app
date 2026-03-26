<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Builder;

class Transaction extends Model
{
    use HasFactory;

    protected $fillable = [
        'txn_id',
        'reference',
        'order_id',
        'customer_id',
        'item_id',
        'warehouse_id',
        'occurred_at',
        'amount',
        'currency',
        'status',
        'type',
        'fees',
        'net_amount',
        'actor',
        'source',
        'party',
        'category',
        'qrcode',
        'payment_method',
        'metadata',
        'note',
    ];

    protected $casts = [
        'occurred_at'  => 'datetime',
        'item_id'      => 'integer',
        'warehouse_id' => 'integer',
        'payment_method' => 'array',
        'metadata'     => 'array',
    ];

    // -----------------------------------------------------
    // 🔗 Relationships
    // -----------------------------------------------------

    public function item()
    {
        return $this->belongsTo(Item::class, 'item_id');
    }

    public function customer()
    {
        return $this->belongsTo(User::class, 'customer_id');
    }

    public function audits()
    {
        return $this->hasMany(TransactionAudit::class);
    }

    // -----------------------------------------------------
    // 🔍 Query Scopes
    // -----------------------------------------------------

    public function scopeSearch(Builder $query, ?string $term): Builder
    {
        if (empty($term)) return $query;

        $term = strtolower(trim($term));

        return $query->where(function ($q) use ($term) {
            $q->whereRaw('LOWER(txn_id) like ?', ["%{$term}%"])
              ->orWhereRaw('LOWER(reference) like ?', ["%{$term}%"])
              ->orWhereRaw('LOWER(actor) like ?', ["%{$term}%"])
              ->orWhereRaw('LOWER(source) like ?', ["%{$term}%"])
              ->orWhereRaw('LOWER(party) like ?', ["%{$term}%"])
              ->orWhereRaw('LOWER(category) like ?', ["%{$term}%"])
              ->orWhereRaw('LOWER(note) like ?', ["%{$term}%"])
              ->orWhereRaw('LOWER(JSON_EXTRACT(payment_method, "$.brand")) like ?', ["%{$term}%"])
              ->orWhereRaw('CAST(amount AS CHAR) like ?', ["%{$term}%"]);
        });
    }

    public function scopeDateBetween(Builder $query, $from = null, $to = null): Builder
    {
        if ($from) $query->where('occurred_at', '>=', $from);
        if ($to) $query->where('occurred_at', '<=', $to);
        return $query;
    }

    public function scopeApplyFilters(Builder $query, array $filters = []): Builder
    {
        if (!empty($filters['status'])) $query->where('status', $filters['status']);
        if (!empty($filters['type'])) $query->where('type', $filters['type']);
        if (!empty($filters['customer_id'])) $query->where('customer_id', $filters['customer_id']);
        if (!empty($filters['order_id'])) $query->where('order_id', $filters['order_id']);
        if (!empty($filters['item_id'])) $query->where('item_id', $filters['item_id']);
        if (!empty($filters['min_amount'])) $query->where('amount', '>=', intval($filters['min_amount']));
        if (!empty($filters['max_amount'])) $query->where('amount', '<=', intval($filters['max_amount']));
        return $query;
    }

    // -----------------------------------------------------
    // 🧮 Accessors / Helpers
    // -----------------------------------------------------

    public function getFormattedAmountAttribute(): string
    {
        $sign = $this->amount < 0 ? '-' : '';
        $value = number_format(abs($this->amount) / 100, 2);
        return "{$sign}{$this->currency} {$value}";
    }

    public function getDirectionAttribute(): string
    {
        return $this->amount >= 0 ? 'IN' : 'OUT';
    }

    public function getPaymentBrandAttribute(): ?string
    {
        return $this->payment_method['brand'] ?? null;
    }
}