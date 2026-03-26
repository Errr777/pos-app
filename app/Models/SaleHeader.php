<?php

namespace App\Models;

use App\Traits\HasHashId;

use Illuminate\Database\Eloquent\Model;

class SaleHeader extends Model
{
    use HasHashId;

    protected $fillable = [
        'sale_number',
        'warehouse_id',
        'customer_id',
        'cashier_id',
        'occurred_at',
        'subtotal',
        'discount_amount',
        'tax_amount',
        'grand_total',
        'payment_method',
        'payment_amount',
        'change_amount',
        'status',
        'note',
        'idempotency_key',
        'promo_code_used',
        'invoice_number',
        'invoice_issued_at',
    ];

    protected $casts = [
        'occurred_at' => 'datetime',
        'invoice_issued_at' => 'datetime',
        'subtotal' => 'integer',
        'discount_amount' => 'integer',
        'tax_amount' => 'integer',
        'grand_total' => 'integer',
        'payment_amount' => 'integer',
        'change_amount' => 'integer',
    ];

    public function warehouse()
    {
        return $this->belongsTo(Warehouse::class);
    }

    public function customer()
    {
        return $this->belongsTo(Customer::class);
    }

    public function cashier()
    {
        return $this->belongsTo(User::class, 'cashier_id');
    }

    public function saleItems()
    {
        return $this->hasMany(SaleItem::class);
    }
}
