<?php

namespace App\Models;

use App\Traits\HasHashId;

use Illuminate\Database\Eloquent\Model;

class StockAdjustment extends Model
{
    use HasHashId;

    protected $fillable = [
        'txn_id', 'warehouse_id', 'item_id',
        'old_quantity', 'new_quantity', 'difference',
        'reason', 'actor', 'occurred_at', 'note',
    ];

    protected $casts = [
        'occurred_at'  => 'datetime',
        'warehouse_id' => 'integer',
        'item_id'      => 'integer',
        'old_quantity' => 'integer',
        'new_quantity' => 'integer',
        'difference'   => 'integer',
    ];

    public function warehouse() { return $this->belongsTo(Warehouse::class); }
    public function item()      { return $this->belongsTo(Item::class); }
}
