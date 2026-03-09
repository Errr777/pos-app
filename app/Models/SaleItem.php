<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SaleItem extends Model
{
    protected $fillable = [
        'sale_header_id',
        'item_id',
        'item_name_snapshot',
        'item_code_snapshot',
        'unit_price',
        'quantity',
        'discount_amount',
        'line_total',
    ];

    protected $casts = [
        'unit_price'      => 'integer',
        'quantity'        => 'integer',
        'discount_amount' => 'integer',
        'line_total'      => 'integer',
    ];

    public function saleHeader() { return $this->belongsTo(SaleHeader::class); }
    public function item()       { return $this->belongsTo(Item::class); }
}
