<?php

namespace App\Models;

use App\Traits\HasHashId;

use Illuminate\Database\Eloquent\Model;

class InstallmentPlan extends Model
{
    use HasHashId;

    protected $fillable = [
        'sale_header_id',
        'customer_id',
        'total_amount',
        'paid_amount',
        'installment_count',
        'interest_rate',
        'late_fee_amount',
        'status',
        'note',
        'invoice_number',
        'invoice_issued_at',
    ];

    protected $casts = [
        'interest_rate' => 'decimal:2',
        'invoice_issued_at' => 'datetime',
    ];

    public function saleHeader()
    {
        return $this->belongsTo(SaleHeader::class);
    }

    public function customer()
    {
        return $this->belongsTo(Customer::class);
    }

    public function payments()
    {
        return $this->hasMany(InstallmentPayment::class)->orderBy('due_date');
    }

    public function remainingAmount(): int
    {
        return max(0, $this->total_amount - $this->paid_amount);
    }

    public function nextDuePayment(): ?InstallmentPayment
    {
        return $this->payments()
            ->whereIn('status', ['pending', 'overdue'])
            ->orderBy('due_date')
            ->first();
    }

    public function isOverdue(): bool
    {
        return $this->status === 'overdue';
    }
}
