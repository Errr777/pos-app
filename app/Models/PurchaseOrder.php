<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PurchaseOrder extends Model
{
    protected $fillable = [
        'po_number', 'supplier_id', 'warehouse_id', 'ordered_by', 'received_by',
        'status', 'ordered_at', 'expected_at', 'received_at',
        'subtotal', 'tax_amount', 'grand_total', 'note',
        'invoice_number', 'invoice_issued_at',
    ];

    protected $casts = [
        'ordered_at' => 'datetime',
        'expected_at' => 'date',
        'received_at' => 'datetime',
        'subtotal' => 'integer',
        'tax_amount' => 'integer',
        'grand_total' => 'integer',
        'invoice_issued_at' => 'datetime',
    ];

    public function supplier()
    {
        return $this->belongsTo(Supplier::class);
    }

    public function warehouse()
    {
        return $this->belongsTo(Warehouse::class);
    }

    public function orderedBy()
    {
        return $this->belongsTo(User::class, 'ordered_by');
    }

    public function receivedBy()
    {
        return $this->belongsTo(User::class, 'received_by');
    }

    public function items()
    {
        return $this->hasMany(PurchaseOrderItem::class);
    }
}
