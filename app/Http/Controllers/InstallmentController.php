<?php

namespace App\Http\Controllers;

use App\Helpers\AuditLogger;
use App\Helpers\InvoiceNumber;
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
        $plans = \App\Helpers\InstallmentPlanMapper::forCustomer($customer);

        return response()->json($plans);
    }

    /**
     * GET /pos/installments/customer/{customer}
     * Return active plans + pending/overdue payments for a customer (used by terminal).
     */
    public function customerPlans(Customer $customer)
    {
        // Include completed plans that still have outstanding balance (paid_amount < total_amount)
        $plans = InstallmentPlan::where('customer_id', $customer->id)
            ->where(function ($q) {
                $q->whereIn('status', ['active', 'overdue'])
                  ->orWhere(fn ($q2) => $q2->where('status', 'completed')
                      ->whereColumn('paid_amount', '<', 'total_amount'));
            })
            ->with([
                'payments',
                'saleHeader:id,sale_number',
            ])
            ->get()
            ->map(function ($plan) {
                $allPmts    = $plan->payments;
                $totalCount = $allPmts->count();
                $sequence   = $allPmts->pluck('id')->flip(); // id → 0-based index

                $remainingAmount    = $plan->remainingAmount();
                $allScheduledPaid  = $allPmts->every(fn ($p) => $p->status === 'paid');

                return [
                    'id'              => hid($plan->id),
                    'saleNumber'      => $plan->saleHeader?->sale_number,
                    'occurredAt'      => $plan->saleHeader?->occurred_at?->toISOString(),
                    'createdAt'       => $plan->created_at?->toISOString(),
                    'totalAmount'     => $plan->total_amount,
                    'paidAmount'      => $plan->paid_amount,
                    'remainingAmount' => $remainingAmount,
                    'interestRate'    => (float) $plan->interest_rate,
                    'lateFeeAmount'   => $plan->late_fee_amount,
                    'status'          => $plan->status,
                    'totalPayments'   => $totalCount,
                    'note'            => $plan->note,
                    'canPayExtra'     => $allScheduledPaid && $remainingAmount > 0,
                    'payments'        => $allPmts->map(fn ($p) => [
                        'id'             => hid($p->id),
                        'dueDate'        => $p->due_date->toDateString(),
                        'amountDue'      => $p->amount_due,
                        'interestAmount' => $p->interest_amount,
                        'lateFeeApplied' => $p->late_fee_applied,
                        'totalDue'       => $p->totalDue(),
                        'alreadyPaid'    => $p->amount_paid,
                        'remainingDue'   => $p->remainingDue(),
                        'isPaid'         => $p->status === 'paid',
                        'status'         => $p->status,
                        'paymentNumber'  => $sequence->get($p->id) + 1,
                        'remainingAfter' => $totalCount - $sequence->get($p->id) - 1,
                        'paymentMethod'  => $p->payment_method,
                        'paidAt'         => $p->paid_at?->toISOString(),
                    ])->values(),
                ];
            });

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
            ->withCount(['installmentPlans as active_count' => fn ($q) => $q->where(fn ($q2) =>
                $q2->whereIn('status', ['active', 'overdue'])
                   ->orWhere(fn ($q3) => $q3->where('status', 'completed')->whereColumn('paid_amount', '<', 'total_amount'))
            )])
            ->withSum(['installmentPlans as remaining_total' => fn ($q) => $q->where(fn ($q2) =>
                $q2->whereIn('status', ['active', 'overdue'])
                   ->orWhere(fn ($q3) => $q3->where('status', 'completed')->whereColumn('paid_amount', '<', 'total_amount'))
            )], \DB::raw('GREATEST(CAST(total_amount AS SIGNED) - CAST(paid_amount AS SIGNED), 0)'))
            ->addSelect(\DB::raw(
                "(SELECT COUNT(*) FROM installment_payments
                  INNER JOIN installment_plans ON installment_payments.installment_plan_id = installment_plans.id
                  WHERE installment_plans.customer_id = customers.id
                    AND (installment_plans.status IN ('active','overdue')
                         OR (installment_plans.status = 'completed' AND installment_plans.paid_amount < installment_plans.total_amount))
                 ) as total_payment_count"
            ))
            ->addSelect(\DB::raw(
                "(SELECT COUNT(*) FROM installment_payments
                  INNER JOIN installment_plans ON installment_payments.installment_plan_id = installment_plans.id
                  WHERE installment_plans.customer_id = customers.id
                    AND (installment_plans.status IN ('active','overdue')
                         OR (installment_plans.status = 'completed' AND installment_plans.paid_amount < installment_plans.total_amount))
                    AND installment_payments.status = 'paid') as paid_payment_count"
            ))
            ->get();

        // Collect sale numbers per customer in one query (avoids N+1)
        $saleNumbersByCustomer = InstallmentPlan::whereIn('customer_id', $customers->pluck('id'))
            ->where(fn ($q) => $q->whereIn('status', ['active', 'overdue'])
                ->orWhere(fn ($q2) => $q2->where('status', 'completed')->whereColumn('paid_amount', '<', 'total_amount')))
            ->with('saleHeader:id,sale_number')
            ->get()
            ->groupBy('customer_id')
            ->map(fn ($plans) => $plans->pluck('saleHeader.sale_number')->filter()->values()->all());

        $mapped = $customers->map(fn ($c) => [
            'id' => hid($c->id),
            'name' => $c->name,
            'code' => $c->code,
            'isBlocked' => $c->overdue_count > 0,
            'hasCredit' => $c->active_count > 0,
            'remainingTotal' => (int) ($c->remaining_total ?? 0),
            'activePlans' => (int) $c->active_count,
            'totalPayments' => (int) ($c->total_payment_count ?? 0),
            'paidPayments' => (int) ($c->paid_payment_count ?? 0),
            'saleNumbers' => $saleNumbersByCustomer->get($c->id, []),
        ]);

        return Inertia::render('pos/InstallmentPayment', [
            'customers' => $mapped,
        ]);
    }

    /**
     * GET /pos/kredit
     * Combined credit management page — all plans, all statuses, inline payment.
     */
    public function kreditPelangganPage(Request $request)
    {
        $status  = $request->get('status', 'all');
        $search  = trim((string) $request->get('search', ''));
        $perPage = in_array((int) $request->get('per_page', 20), [20, 50, 100])
            ? (int) $request->get('per_page', 20) : 20;

        $allowedSort = [
            'created'   => 'installment_plans.created_at',
            'remaining' => 'remaining_amount',
            'customer'  => 'customers.name',
        ];
        $sortKey = $request->get('sort_by', 'created');
        $sortCol = $allowedSort[$sortKey] ?? 'installment_plans.created_at';
        $sortDir = strtolower($request->get('sort_dir', 'desc')) === 'asc' ? 'asc' : 'desc';

        $query = InstallmentPlan::query()
            ->select(
                'installment_plans.*',
                DB::raw('GREATEST(CAST(installment_plans.total_amount AS SIGNED) - CAST(installment_plans.paid_amount AS SIGNED), 0) as remaining_amount')
            )
            ->join('customers', 'customers.id', '=', 'installment_plans.customer_id')
            ->with([
                'customer:id,name,code',
                'saleHeader:id,sale_number,occurred_at',
                'payments',
            ]);

        if ($status === 'belum_lunas') {
            $query->where(fn ($q) => $q
                ->whereIn('installment_plans.status', ['active', 'overdue'])
                ->orWhere(fn ($q2) => $q2
                    ->where('installment_plans.status', 'completed')
                    ->whereColumn('installment_plans.paid_amount', '<', 'installment_plans.total_amount')));
        } elseif ($status === 'lunas') {
            $query->where('installment_plans.status', 'completed')
                  ->whereColumn('installment_plans.paid_amount', '>=', 'installment_plans.total_amount');
        } elseif (in_array($status, ['active', 'overdue', 'completed', 'cancelled'])) {
            $query->where('installment_plans.status', $status);
        }

        if ($search !== '') {
            $term = strtolower($search);
            $query->where(fn ($q) => $q
                ->whereRaw('LOWER(customers.name) like ?', ["%{$term}%"])
                ->orWhereRaw('LOWER(customers.code) like ?', ["%{$term}%"])
                ->orWhereHas('saleHeader', fn ($sq) =>
                    $sq->whereRaw('LOWER(sale_number) like ?', ["%{$term}%"])
                )
            );
        }

        if ($sortKey === 'customer') {
            $query->orderBy('customers.name', $sortDir);
        } else {
            $query->orderBy($sortCol, $sortDir);
        }

        $plans = $query->paginate($perPage)->withQueryString()
            ->through(function ($plan) {
                $allPmts   = $plan->payments;
                $total     = $allPmts->count();
                $paidCount = $allPmts->where('status', 'paid')->count();
                $seq       = $allPmts->pluck('id')->flip();
                $remaining = (int) $plan->remaining_amount;
                $allPaid   = $allPmts->every(fn ($p) => $p->status === 'paid');

                return [
                    'id'               => hid($plan->id),
                    'customerId'       => hid($plan->customer?->id),
                    'customerName'     => $plan->customer?->name,
                    'customerCode'     => $plan->customer?->code,
                    'saleNumber'       => $plan->saleHeader?->sale_number,
                    'occurredAt'       => $plan->saleHeader?->occurred_at?->toISOString(),
                    'createdAt'        => $plan->created_at?->toISOString(),
                    'totalAmount'      => $plan->total_amount,
                    'paidAmount'       => $plan->paid_amount,
                    'remainingAmount'  => $remaining,
                    'installmentCount' => $plan->installment_count,
                    'paidCount'        => $paidCount,
                    'interestRate'     => (float) $plan->interest_rate,
                    'lateFeeAmount'    => $plan->late_fee_amount,
                    'status'           => $plan->status,
                    'note'             => $plan->note,
                    'canPayExtra'      => $allPaid && $remaining > 0,
                    'payments'         => $allPmts->map(fn ($p) => [
                        'id'             => hid($p->id),
                        'dueDate'        => $p->due_date->toDateString(),
                        'amountDue'      => $p->amount_due,
                        'interestAmount' => $p->interest_amount,
                        'lateFeeApplied' => $p->late_fee_applied,
                        'totalDue'       => $p->totalDue(),
                        'alreadyPaid'    => $p->amount_paid,
                        'remainingDue'   => $p->remainingDue(),
                        'isPaid'         => $p->status === 'paid',
                        'status'         => $p->status,
                        'paymentNumber'  => $seq->get($p->id) + 1,
                        'remainingAfter' => $total - $seq->get($p->id) - 1,
                        'paymentMethod'  => $p->payment_method,
                        'paidAt'         => $p->paid_at?->toISOString(),
                        'note'           => $p->note,
                    ])->values(),
                ];
            });

        return Inertia::render('pos/KreditPelanggan', [
            'plans'   => $plans,
            'filters' => $request->only(['search', 'status', 'per_page', 'sort_by', 'sort_dir']),
        ]);
    }

    /**
     * GET /pos/kredit  (legacy — kept for historyPage compatibility)
     * @deprecated use kreditPelangganPage
     */
    public function historyPage(Request $request)
    {
        $status  = $request->get('status', 'all'); // all|active|overdue|completed
        $search  = trim((string) $request->get('search', ''));
        $perPage = in_array((int) $request->get('per_page', 20), [20, 50, 100])
            ? (int) $request->get('per_page', 20) : 20;

        $allowedSort = [
            'created'   => 'installment_plans.created_at',
            'remaining' => 'remaining_amount',
            'customer'  => 'customers.name',
        ];
        $sortKey = $request->get('sort_by', 'created');
        $sortCol = $allowedSort[$sortKey] ?? 'installment_plans.created_at';
        $sortDir = strtolower($request->get('sort_dir', 'desc')) === 'asc' ? 'asc' : 'desc';

        $query = InstallmentPlan::query()
            ->select(
                'installment_plans.*',
                DB::raw('GREATEST(CAST(installment_plans.total_amount AS SIGNED) - CAST(installment_plans.paid_amount AS SIGNED), 0) as remaining_amount')
            )
            ->join('customers', 'customers.id', '=', 'installment_plans.customer_id')
            ->with([
                'customer:id,name,code',
                'saleHeader:id,sale_number,occurred_at',
                'payments',
            ]);

        if ($status !== 'all') {
            $query->where('installment_plans.status', $status);
        }

        if ($search !== '') {
            $term = strtolower($search);
            $query->where(function ($q) use ($term) {
                $q->whereRaw('LOWER(customers.name) like ?', ["%{$term}%"])
                  ->orWhereRaw('LOWER(customers.code) like ?', ["%{$term}%"])
                  ->orWhereHas('saleHeader', fn ($sq) =>
                      $sq->whereRaw('LOWER(sale_number) like ?', ["%{$term}%"])
                  );
            });
        }

        if ($sortKey === 'customer') {
            $query->orderBy('customers.name', $sortDir);
        } else {
            $query->orderBy($sortCol, $sortDir);
        }

        $plans = $query->paginate($perPage)->withQueryString()
            ->through(function ($plan) {
                $payments  = $plan->payments;
                $paidCount = $payments->where('status', 'paid')->count();

                return [
                    'id'               => hid($plan->id),
                    'customerId'       => hid($plan->customer?->id),
                    'customerName'     => $plan->customer?->name,
                    'customerCode'     => $plan->customer?->code,
                    'saleNumber'       => $plan->saleHeader?->sale_number,
                    'occurredAt'       => $plan->saleHeader?->occurred_at?->toISOString(),
                    'totalAmount'      => $plan->total_amount,
                    'paidAmount'       => $plan->paid_amount,
                    'remainingAmount'  => (int) $plan->remaining_amount,
                    'installmentCount' => $plan->installment_count,
                    'paidCount'        => $paidCount,
                    'interestRate'     => (float) $plan->interest_rate,
                    'status'           => $plan->status,
                    'note'             => $plan->note,
                    'createdAt'        => $plan->created_at?->toISOString(),
                    'payments'         => $payments->map(fn ($p) => [
                        'id'             => hid($p->id),
                        'dueDate'        => $p->due_date->toDateString(),
                        'amountDue'      => $p->amount_due,
                        'interestAmount' => $p->interest_amount,
                        'lateFeeApplied' => $p->late_fee_applied,
                        'totalDue'       => $p->totalDue(),
                        'amountPaid'     => $p->amount_paid,
                        'paidAt'         => $p->paid_at?->toISOString(),
                        'status'         => $p->status,
                        'paymentMethod'  => $p->payment_method,
                        'note'           => $p->note,
                    ])->values(),
                ];
            });

        return Inertia::render('pos/CreditHistory', [
            'plans'   => $plans,
            'filters' => $request->only(['search', 'status', 'per_page', 'sort_by', 'sort_dir']),
        ]);
    }

    /**
     * POST /pos/installments/{plan}/add-installment
     * Extend a plan with a new installment row when the last one is still unpaid.
     */
    public function addInstallment(Request $request, InstallmentPlan $plan)
    {
        $remaining = $plan->remainingAmount();

        if ($remaining <= 0) {
            return response()->json(['error' => 'Tidak ada sisa pembayaran.'], 422);
        }

        // Must still have unpaid scheduled payments (otherwise use pay-extra)
        if (! $plan->payments()->whereNotIn('status', ['paid'])->exists()) {
            return response()->json(['error' => 'Gunakan pembayaran sisa untuk melunasi.'], 422);
        }

        $request->validate([
            'due_date'   => 'required|date|after:today',
            'amount_due' => "required|integer|min:1|max:{$remaining}",
            'note'       => 'nullable|string|max:500',
        ]);

        DB::transaction(function () use ($plan, $request) {
            InstallmentPayment::create([
                'installment_plan_id' => $plan->id,
                'due_date'            => $request->due_date,
                'amount_due'          => (int) $request->amount_due,
                'interest_amount'     => 0,
                'late_fee_applied'    => 0,
                'amount_paid'         => 0,
                'status'              => 'pending',
                'payment_method'      => null,
                'recorded_by'         => Auth::id(),
                'note'                => $request->note,
            ]);

            $plan->increment('installment_count');

            AuditLogger::log('installment.extended', $plan->customer, [
                'plan_id'    => $plan->id,
                'due_date'   => $request->due_date,
                'amount_due' => $request->amount_due,
            ], null);
        });

        return response()->json(['message' => 'Cicilan berikutnya berhasil ditambahkan.']);
    }

    /**
     * POST /pos/installments/{plan}/pay-extra
     * Ad-hoc payment for remaining balance after all scheduled installments are paid.
     */
    public function payExtra(Request $request, InstallmentPlan $plan)
    {
        $remaining = $plan->remainingAmount();

        if ($remaining <= 0) {
            return response()->json(['error' => 'Tidak ada sisa pembayaran.'], 422);
        }

        if ($plan->payments()->whereNotIn('status', ['paid'])->exists()) {
            return response()->json(['error' => 'Masih ada cicilan terjadwal yang belum lunas.'], 422);
        }

        $request->validate([
            'amount_paid'    => "required|integer|min:1|max:{$remaining}",
            'payment_method' => 'required|in:cash,transfer,qris,card',
            'note'           => 'nullable|string|max:500',
        ]);

        $amountPaid = (int) $request->amount_paid;

        DB::transaction(function () use ($plan, $amountPaid, $remaining, $request) {
            $note = trim(($request->note ?? '') . ' [Di luar jadwal cicilan]');

            $payment = $plan->payments()->create([
                'due_date'         => now()->toDateString(),
                'amount_due'       => $remaining,
                'interest_amount'  => 0,
                'late_fee_applied' => 0,
                'amount_paid'      => $amountPaid,
                'paid_at'          => $amountPaid >= $remaining ? now() : null,
                'status'           => $amountPaid >= $remaining ? 'paid' : 'partial',
                'payment_method'   => $request->payment_method,
                'recorded_by'      => Auth::id(),
                'note'             => $note,
            ]);

            $plan->paid_amount = min($plan->paid_amount + $amountPaid, $plan->total_amount);
            $allDone = ! $plan->payments()->whereNotIn('status', ['paid'])->exists();
            $plan->status = $allDone ? 'completed' : 'active';
            $plan->save();

            AuditLogger::log('installment.extra_paid', $plan->customer, [
                'plan_id'        => $plan->id,
                'payment_id'     => $payment->id,
                'amount'         => $amountPaid,
                'payment_method' => $request->payment_method,
            ], null);
        });

        if ($request->wantsJson()) {
            return response()->json(['message' => 'Pembayaran tambahan berhasil dicatat.']);
        }

        return back()->with('success', 'Pembayaran tambahan berhasil dicatat.');
    }

    public function invoice(InstallmentPlan $plan)
    {
        // Permission enforced by constructor middleware (pos / can_view for GET).
        $plan->load(['payments', 'saleHeader.saleItems', 'customer', 'saleHeader.warehouse']);

        abort_if(! $plan->saleHeader, 404);

        if (! $plan->invoice_number) {
            $plan->update([
                'invoice_number' => InvoiceNumber::generate(),
                'invoice_issued_at' => now(),
            ]);
            $plan->refresh();
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

        // Apply late fee to compute correct remaining before validation
        $lateFee = (int) ($request->late_fee ?? 0);
        $remainingDue = max(0, $payment->totalDue() + $lateFee - $payment->amount_paid);

        $request->validate([
            'amount_paid' => "required|integer|min:1|max:{$remainingDue}",
            'payment_method' => 'required|in:cash,transfer,qris,card',
            'note' => 'nullable|string|max:500',
            'late_fee' => 'nullable|integer|min:0',
        ]);

        $amountPaid = (int) $request->amount_paid;
        $shortfall  = $remainingDue - $amountPaid; // > 0 means underpayment

        // Guard: ensure payment won't push paid_amount above total obligation
        $totalObligation = max($plan->total_amount, (int) $plan->payments()->sum(DB::raw('amount_due + interest_amount + late_fee_applied')));
        if ($plan->paid_amount + $amountPaid > $totalObligation) {
            $error = 'Pembayaran melebihi total hutang. Maksimum yang bisa dibayar: ' . number_format($totalObligation - $plan->paid_amount, 0, ',', '.');
            if ($request->wantsJson()) {
                return response()->json(['error' => $error, 'max_allowed' => $totalObligation - $plan->paid_amount], 422);
            }
            return back()->withErrors(['amount_paid' => $error]);
        }

        DB::transaction(function () use ($payment, $plan, $amountPaid, $shortfall, $lateFee, $request) {
            // Is this the last unpaid installment in the schedule?
            $isLastUnpaid = ! $plan->payments()
                ->where('id', '!=', $payment->id)
                ->whereNotIn('status', ['paid'])
                ->exists();

            // Always mark as paid regardless of amount.
            $payment->update([
                'late_fee_applied' => $payment->late_fee_applied + $lateFee,
                'amount_paid'      => $payment->amount_paid + $amountPaid,
                'paid_at'          => now(),
                'status'           => 'paid',
                'payment_method'   => $request->payment_method,
                'recorded_by'      => Auth::id(),
                'note'             => $request->note,
            ]);

            if ($shortfall > 0) {
                if ($isLastUnpaid) {
                    // Last installment: create a new row for the shortfall (+1 month)
                    $lastDueDate = \Carbon\Carbon::parse(
                        $plan->payments()->max('due_date')
                    );

                    $plan->payments()->create([
                        'due_date'         => $lastDueDate->addMonth()->toDateString(),
                        'amount_due'       => $shortfall,
                        'interest_amount'  => 0,
                        'late_fee_applied' => 0,
                        'amount_paid'      => 0,
                        'status'           => 'pending',
                        'payment_method'   => null,
                        'recorded_by'      => Auth::id(),
                        'note'             => 'Sisa pembayaran yang belum dilunasi',
                    ]);

                    $plan->increment('installment_count');
                } else {
                    // Middle installment: carry shortfall into the next unpaid row
                    // so displayed amounts stay consistent with plan.remainingAmount().
                    $plan->payments()
                        ->where('id', '!=', $payment->id)
                        ->whereNotIn('status', ['paid'])
                        ->orderBy('due_date')
                        ->first()
                        ?->increment('amount_due', $shortfall);
                }
            }

            $plan->paid_amount = $plan->paid_amount + $amountPaid;
            $allDone = ! $plan->payments()->whereNotIn('status', ['paid'])->exists();

            $plan->status = $allDone ? 'completed'
                : ($plan->payments()->where('status', 'overdue')->exists() ? 'overdue' : 'active');

            $plan->save();

            AuditLogger::log('installment.paid', $plan->customer, [
                'plan_id'        => $plan->id,
                'payment_id'     => $payment->id,
                'amount'         => $amountPaid,
                'shortfall'      => $shortfall,
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
        $request->merge([
            'installment_payment_id' => dhid((string) ($request->installment_payment_id ?? '')),
        ]);

        $request->validate([
            'installment_payment_id' => 'required|integer|exists:installment_payments,id',
            'amount_paid' => 'required|integer|min:1',
            'payment_method' => 'required|in:cash,transfer,qris,card',
            'note' => 'nullable|string|max:500',
            'late_fee' => 'nullable|integer|min:0',
        ]);

        $payment = InstallmentPayment::with('plan')->findOrFail($request->installment_payment_id);

        return $this->pay($request, $payment->plan, $payment);
    }
}
