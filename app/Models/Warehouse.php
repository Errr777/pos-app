<?php

namespace App\Models;

use App\Traits\HasHashId;

use Illuminate\Database\Eloquent\Model;

class Warehouse extends Model
{
    use HasHashId;

    protected $fillable = ['code', 'name', 'location', 'description', 'is_active', 'is_default', 'phone', 'city'];

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
