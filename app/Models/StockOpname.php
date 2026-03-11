<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class StockOpname extends Model
{
    protected $fillable = [
        'ref_number', 'warehouse_id', 'status',
        'date', 'created_by', 'submitted_at', 'note',
    ];

    protected $casts = [
        'date'         => 'date',
        'submitted_at' => 'datetime',
        'warehouse_id' => 'integer',
    ];

    public function warehouse() { return $this->belongsTo(Warehouse::class); }
    public function items()     { return $this->hasMany(StockOpnameItem::class, 'opname_id'); }
}
