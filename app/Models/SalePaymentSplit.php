<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SalePaymentSplit extends Model
{
    protected $fillable = [
        'sale_header_id',
        'payment_method',
        'amount',
    ];

    protected $casts = [
        'amount' => 'integer',
    ];

    public function saleHeader()
    {
        return $this->belongsTo(SaleHeader::class);
    }
}
