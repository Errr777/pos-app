<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Warehouse extends Model
{
    protected $fillable = ['code', 'name', 'location', 'description', 'is_active', 'is_default'];

    protected $casts = [
        'is_active'  => 'boolean',
        'is_default' => 'boolean',
    ];

    public function warehouseItems()
    {
        return $this->hasMany(WarehouseItem::class);
    }

    public function transactions()
    {
        return $this->hasMany(Transaction::class);
    }
}
