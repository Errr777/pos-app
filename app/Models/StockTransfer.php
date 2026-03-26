<?php

namespace App\Models;

use App\Traits\HasHashId;

use Illuminate\Database\Eloquent\Model;

class StockTransfer extends Model
{
    use HasHashId;

    protected $fillable = [
        'txn_id',
        'from_warehouse_id',
        'to_warehouse_id',
        'item_id',
        'quantity',
        'occurred_at',
        'reference',
        'actor',
        'note',
        'status',
        'delivery_order_id',
    ];

    protected $casts = [
        'occurred_at'       => 'datetime',
        'from_warehouse_id' => 'integer',
        'to_warehouse_id'   => 'integer',
        'item_id'           => 'integer',
        'quantity'          => 'integer',
    ];

    public function fromWarehouse()
    {
        return $this->belongsTo(Warehouse::class, 'from_warehouse_id');
    }

    public function toWarehouse()
    {
        return $this->belongsTo(Warehouse::class, 'to_warehouse_id');
    }

    public function item()
    {
        return $this->belongsTo(Item::class, 'item_id');
    }

    public function deliveryOrder()
    {
        return $this->belongsTo(DeliveryOrder::class);
    }
}
