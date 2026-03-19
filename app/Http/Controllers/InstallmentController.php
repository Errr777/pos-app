<?php

namespace App\Http\Controllers;

use App\Helpers\AuditLogger;
use App\Models\Customer;
use App\Models\InstallmentPayment;
use App\Models\InstallmentPlan;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class InstallmentController extends Controller
{
    public function __construct()
    {
        $this->middleware(function ($request, $next) {
            $user = $request->user();
            if (! $user) {
                return redirect()->route('login');
            }

            $action = in_array($request->method(), ['POST', 'PUT', 'PATCH'])
                ? 'can_write' : 'can_view';

            if (! $user->hasPermission('pos', $action)) {
                return $request->wantsJson()
                    ? response()->json(['error' => 'Forbidden'], 403)
                    : abort(403);
            }

            return $next($request);
        });
    }

    /**
     * GET /customers/{customer}/installments
     * All installment plans for a customer (JSON, used by customer profile tab).
     */
    public function plans(Customer $customer)
    {
        $plans = InstallmentPlan::where('customer_id', $customer->id)
            ->with(['payments', 'saleHeader:id,sale_number,occurred_at,grand_total'])
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

        return response()->json($plans);
    }

    /**
     * GET /pos/installments/customer/{customer}
     * Return active plans + pending/overdue payments for a customer (used by terminal).
     */
    public function customerPlans(Customer $customer)
    {
        $plans = InstallmentPlan::where('customer_id', $customer->id)
            ->whereIn('status', ['active', 'overdue'])
            ->with([
                'payments' => fn ($q) => $q->whereIn('status', ['pending', 'overdue', 'partial'])->orderBy('due_date'),
                'saleHeader:id,sale_number',
            ])
            ->get()
            ->map(fn ($plan) => [
                'id' => $plan->id,
                'saleNumber' => $plan->saleHeader?->sale_number,
                'remainingAmount' => $plan->remainingAmount(),
                'status' => $plan->status,
                'payments' => $plan->payments->map(fn ($p) => [
                    'id' => $p->id,
                    'dueDate' => $p->due_date->toDateString(),
                    'amountDue' => $p->amount_due,
                    'interestAmount' => $p->interest_amount,
                    'lateFeeApplied' => $p->late_fee_applied,
                    'totalDue' => $p->totalDue(),
                    'status' => $p->status,
                ]),
            ]);

        return response()->json([
            'plans' => $plans,
            'isBlocked' => $customer->isBlockedForCredit(),
        ]);
    }

    /**
     * GET /pos/installments
     * "Bayar Cicilan" terminal page.
     */
    public function terminalPage()
    {
        $customers = Customer::where('is_active', true)
            ->orderBy('name')
            ->withCount(['installmentPlans as overdue_count' => fn ($q) => $q->where('status', 'overdue')])
            ->withCount(['installmentPlans as active_count' => fn ($q) => $q->whereIn('status', ['active', 'overdue'])])
            ->get()
            ->map(fn ($c) => [
                'id' => $c->id,
                'name' => $c->name,
                'code' => $c->code,
                'isBlocked' => $c->overdue_count > 0,
                'hasCredit' => $c->active_count > 0,
            ]);

        return Inertia::render('pos/InstallmentPayment', [
            'customers' => $customers,
        ]);
    }

    public function invoice(InstallmentPlan $plan)
    {
        $plan->load(['payments', 'saleHeader.saleItems', 'customer', 'saleHeader.warehouse']);

        if (! $plan->invoice_number) {
            $plan->update([
                'invoice_number' => \App\Helpers\InvoiceNumber::generate(),
                'invoice_issued_at' => now(),
            ]);
        }

        return Inertia::render('pos/Invoice', [
            'invoice' => [
                'invoiceNumber' => $plan->invoice_number,
                'issuedAt' => $plan->invoice_issued_at->toISOString(),
                'saleNumber' => $plan->saleHeader->sale_number,
                'date' => $plan->created_at->toISOString(),
                'cashier' => null,
                'status' => $plan->status,
                'paymentMethod' => 'credit',
                'paymentAmount' => $plan->paid_amount,
                'changeAmount' => 0,
                'note' => $plan->note,
                'customer' => [
                    'name' => $plan->customer->name,
                    'phone' => $plan->customer->phone,
                    'address' => $plan->customer->address,
                ],
                'warehouse' => [
                    'name' => $plan->saleHeader->warehouse?->name,
                    'address' => $plan->saleHeader->warehouse?->location,
                    'phone' => $plan->saleHeader->warehouse?->phone,
                ],
                'subtotal' => $plan->total_amount,
                'discountAmount' => 0,
                'taxAmount' => 0,
                'grandTotal' => $plan->total_amount,
                'items' => $plan->saleHeader->saleItems->map(fn ($si) => [
                    'name' => $si->item_name_snapshot,
                    'code' => $si->item_code_snapshot,
                    'unitPrice' => $si->unit_price,
                    'quantity' => $si->quantity,
                    'discountAmount' => $si->discount_amount,
                    'lineTotal' => $si->line_total,
                ]),
                'schedule' => $plan->payments->map(fn ($p) => [
                    'dueDate' => $p->due_date->toDateString(),
                    'amountDue' => $p->amount_due,
                    'interestAmount' => $p->interest_amount,
                    'lateFeeApplied' => $p->late_fee_applied,
                    'totalDue' => $p->totalDue(),
                    'status' => $p->status,
                ]),
            ],
        ]);
    }

    /**
     * POST /installments/{plan}/payments/{payment}/pay
     * Record a payment against one installment row.
     */
    public function pay(Request $request, InstallmentPlan $plan, InstallmentPayment $payment)
    {
        if ($payment->installment_plan_id !== $plan->id) {
            abort(404);
        }

        if ($payment->status === 'paid') {
            if ($request->wantsJson()) {
                return response()->json(['error' => 'Cicilan ini sudah dibayar.'], 422);
            }

            return back()->withErrors(['general' => 'Cicilan ini sudah dibayar.']);
        }

        $request->validate([
            'amount_paid' => 'required|integer|min:1',
            'payment_method' => 'required|in:cash,transfer,qris,card',
            'note' => 'nullable|string|max:500',
        ]);

        $amountPaid = (int) $request->amount_paid;
        $totalDue = $payment->totalDue();

        DB::transaction(function () use ($payment, $plan, $amountPaid, $totalDue, $request) {
            $newStatus = $amountPaid >= $totalDue ? 'paid' : 'partial';

            $payment->update([
                'amount_paid' => $amountPaid,
                'paid_at' => $newStatus === 'paid' ? now() : null,
                'status' => $newStatus,
                'payment_method' => $request->payment_method,
                'recorded_by' => Auth::id(),
                'note' => $request->note,
            ]);

            $plan->paid_amount = min($plan->paid_amount + $amountPaid, $plan->total_amount);

            $allDone = $plan->remainingAmount() <= 0
                || ! $plan->payments()->whereNotIn('status', ['paid'])->exists();

            $plan->status = $allDone ? 'completed'
                : ($plan->payments()->where('status', 'overdue')->exists() ? 'overdue' : 'active');

            $plan->save();

            AuditLogger::log('installment.paid', $plan->customer, [
                'plan_id' => $plan->id,
                'payment_id' => $payment->id,
                'amount' => $amountPaid,
                'payment_method' => $request->payment_method,
            ], null);
        });

        if ($request->wantsJson()) {
            return response()->json(['message' => 'Pembayaran berhasil dicatat.']);
        }

        return back()->with('success', 'Pembayaran cicilan berhasil dicatat.');
    }

    /**
     * POST /pos/installments/pay
     * Pay installment from the POS terminal (resolves plan/payment from payment ID).
     */
    public function payFromTerminal(Request $request)
    {
        $request->validate([
            'installment_payment_id' => 'required|integer|exists:installment_payments,id',
            'amount_paid' => 'required|integer|min:1',
            'payment_method' => 'required|in:cash,transfer,qris,card',
            'note' => 'nullable|string|max:500',
        ]);

        $payment = InstallmentPayment::with('plan')->findOrFail($request->installment_payment_id);

        return $this->pay($request, $payment->plan, $payment);
    }
}
