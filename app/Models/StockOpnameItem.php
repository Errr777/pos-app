<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class StockOpnameItem extends Model
{
    protected $fillable = [
        'opname_id', 'item_id', 'item_name_snapshot', 'item_code_snapshot',
        'system_qty', 'actual_qty', 'variance', 'note',
    ];

    protected $casts = [
        'system_qty' => 'integer',
        'actual_qty' => 'integer',
        'variance'   => 'integer',
    ];

    public function opname() { return $this->belongsTo(StockOpname::class); }
    public function item()   { return $this->belongsTo(Item::class); }
}
