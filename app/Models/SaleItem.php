<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SaleItem extends Model
{
    protected $fillable = [
        'sale_header_id',
        'item_id',
        'variant_id',
        'item_name_snapshot',
        'item_code_snapshot',
        'variant_name_snapshot',
        'unit_price',
        'cost_price_snapshot',
        'quantity',
        'discount_amount',
        'line_total',
    ];

    protected $casts = [
        'unit_price' => 'integer',
        'cost_price_snapshot' => 'integer',
        'quantity' => 'integer',
        'discount_amount' => 'integer',
        'line_total' => 'integer',
    ];

    public function saleHeader()
    {
        return $this->belongsTo(SaleHeader::class);
    }

    public function item()
    {
        return $this->belongsTo(Item::class);
    }

    public function variant()
    {
        return $this->belongsTo(ItemVariant::class, 'variant_id');
    }
}
