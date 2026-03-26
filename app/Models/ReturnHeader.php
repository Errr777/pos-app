<?php

namespace App\Models;

use App\Traits\HasHashId;

use Illuminate\Database\Eloquent\Model;

class ReturnHeader extends Model
{
    use HasHashId;

    protected $fillable = [
        'return_number', 'type', 'sale_header_id', 'purchase_order_id',
        'customer_id', 'supplier_id', 'warehouse_id', 'processed_by',
        'occurred_at', 'status', 'total_amount', 'reason', 'note',
    ];

    protected $casts = [
        'occurred_at'  => 'datetime',
        'total_amount' => 'integer',
    ];

    public function customer()      { return $this->belongsTo(Customer::class); }
    public function supplier()      { return $this->belongsTo(Supplier::class); }
    public function warehouse()     { return $this->belongsTo(Warehouse::class); }
    public function processedBy()   { return $this->belongsTo(User::class, 'processed_by'); }
    public function saleHeader()    { return $this->belongsTo(SaleHeader::class); }
    public function purchaseOrder() { return $this->belongsTo(PurchaseOrder::class); }
    public function returnItems()   { return $this->hasMany(ReturnItem::class, 'return_header_id'); }
}
