<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ReturnItem extends Model
{
    protected $fillable = [
        'return_header_id', 'item_id', 'item_name_snapshot',
        'quantity', 'unit_price', 'line_total', 'condition',
    ];

    protected $casts = [
        'quantity'   => 'integer',
        'unit_price' => 'integer',
        'line_total' => 'integer',
    ];

    public function item()         { return $this->belongsTo(Item::class); }
    public function returnHeader() { return $this->belongsTo(ReturnHeader::class); }
}
