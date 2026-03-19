<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DeliveryOrderItem extends Model
{
    protected $fillable = [
        'delivery_order_id',
        'item_id',
        'item_name_snapshot',
        'item_code_snapshot',
        'quantity',
        'unit_price',
        'quantity_received',
    ];

    protected $casts = [
        'quantity'          => 'integer',
        'unit_price'        => 'integer',
        'quantity_received' => 'integer',
    ];

    public function deliveryOrder()
    {
        return $this->belongsTo(DeliveryOrder::class);
    }

    public function item()
    {
        return $this->belongsTo(Item::class);
    }
}
