<?php

namespace App\Models;

use App\Traits\HasHashId;

use Illuminate\Database\Eloquent\Model;

class InstallmentPayment extends Model
{
    use HasHashId;

    protected $fillable = [
        'installment_plan_id',
        'due_date',
        'amount_due',
        'interest_amount',
        'late_fee_applied',
        'amount_paid',
        'paid_at',
        'status',
        'payment_method',
        'recorded_by',
        'note',
    ];

    protected $casts = [
        'due_date' => 'date',
        'paid_at' => 'datetime',
    ];

    public function plan()
    {
        return $this->belongsTo(InstallmentPlan::class, 'installment_plan_id');
    }

    public function recorder()
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }

    public function totalDue(): int
    {
        return $this->amount_due + $this->interest_amount + $this->late_fee_applied;
    }

    public function remainingDue(): int
    {
        return max(0, $this->totalDue() - $this->amount_paid);
    }
}
