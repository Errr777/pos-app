<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class WarehouseItemPrice extends Model
{
    protected $fillable = ['warehouse_id', 'item_id', 'harga_jual'];

    protected $casts = [
        'harga_jual'   => 'integer',
        'warehouse_id' => 'integer',
        'item_id'      => 'integer',
    ];

    public function warehouse()
    {
        return $this->belongsTo(Warehouse::class);
    }

    public function item()
    {
        return $this->belongsTo(Item::class);
    }
}
