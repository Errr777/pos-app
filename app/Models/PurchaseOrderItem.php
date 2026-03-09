<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PurchaseOrderItem extends Model
{
    protected $fillable = [
        'purchase_order_id', 'item_id', 'item_name_snapshot',
        'ordered_qty', 'received_qty', 'unit_price', 'line_total',
    ];

    protected $casts = [
        'ordered_qty'  => 'integer',
        'received_qty' => 'integer',
        'unit_price'   => 'integer',
        'line_total'   => 'integer',
    ];

    public function purchaseOrder() { return $this->belongsTo(PurchaseOrder::class); }
    public function item()          { return $this->belongsTo(Item::class); }
}
