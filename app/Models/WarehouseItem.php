<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class WarehouseItem extends Model
{
    protected $fillable = ['warehouse_id', 'item_id', 'stok', 'stok_minimal'];

    protected $casts = [
        'stok'         => 'integer',
        'stok_minimal' => 'integer',
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
