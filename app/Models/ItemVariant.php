<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ItemVariant extends Model
{
    protected $fillable = ['item_id', 'name', 'price_modifier', 'is_active'];

    protected $casts = [
        'price_modifier' => 'integer',
        'is_active'      => 'boolean',
    ];

    public function item()
    {
        return $this->belongsTo(Item::class);
    }
}
