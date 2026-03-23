<?php

namespace App\Helpers;

use App\Models\Customer;
use Illuminate\Support\Collection;

class InstallmentPlanMapper
{
    /**
     * Build the shared installment-plan payload for a given customer.
     * Used by CustomerController::show() and InstallmentController::plans().
     */
    public static function forCustomer(Customer $customer): Collection
    {
        return \App\Models\InstallmentPlan::where('customer_id', $customer->id)
            ->with([
                'payments' => fn ($q) => $q->orderBy('due_date'),
                'saleHeader:id,sale_number,occurred_at,grand_total',
            ])
            ->orderByDesc('created_at')
            ->get()
            ->map(fn ($plan) => [
                'id' => $plan->id,
                'saleNumber' => $plan->saleHeader?->sale_number,
                'occurredAt' => $plan->saleHeader?->occurred_at?->toISOString(),
                'grandTotal' => $plan->saleHeader?->grand_total,
                'totalAmount' => $plan->total_amount,
                'paidAmount' => $plan->paid_amount,
                'remainingAmount' => $plan->remainingAmount(),
                'installmentCount' => $plan->installment_count,
                'interestRate' => (float) $plan->interest_rate,
                'lateFeeAmount' => $plan->late_fee_amount,
                'status' => $plan->status,
                'note' => $plan->note,
                'payments' => $plan->payments->map(fn ($p) => [
                    'id' => $p->id,
                    'dueDate' => $p->due_date->toDateString(),
                    'amountDue' => $p->amount_due,
                    'interestAmount' => $p->interest_amount,
                    'lateFeeApplied' => $p->late_fee_applied,
                    'totalDue' => $p->totalDue(),
                    'amountPaid' => $p->amount_paid,
                    'paidAt' => $p->paid_at?->toISOString(),
                    'status' => $p->status,
                    'paymentMethod' => $p->payment_method,
                    'note' => $p->note,
                ]),
            ]);
    }
}
