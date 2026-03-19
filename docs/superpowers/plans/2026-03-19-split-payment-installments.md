# Split Payment / Installments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add credit/installment payment mode to the POS — cashier sets a schedule at checkout, first payment collected now, remaining payments tracked per customer with overdue detection and blocking.

**Architecture:** Two new tables (`installment_plans`, `installment_payments`) link to `sale_headers`. Existing cash sale flow is untouched. `payment_method='credit'` is added as a new valid value. A daily artisan command marks overdue payments. Both the POS terminal and customer profile page support recording installment payments.

**Tech Stack:** Laravel 12, Inertia.js v2, React 19, TypeScript, Tailwind CSS v4, SQLite

---

## File Map

### New files
| File | Responsibility |
|---|---|
| `database/migrations/2026_03_19_100001_create_installment_plans_table.php` | installment_plans schema |
| `database/migrations/2026_03_19_100002_create_installment_payments_table.php` | installment_payments schema |
| `app/Models/InstallmentPlan.php` | Plan model with helpers |
| `app/Models/InstallmentPayment.php` | Payment row model |
| `app/Console/Commands/MarkOverdueInstallments.php` | Daily overdue checker |
| `app/Http/Controllers/InstallmentController.php` | plans(), schedule(), pay(), payFromTerminal() |
| `resources/js/pages/pos/InstallmentPayment.tsx` | "Bayar Cicilan" terminal page |
| `resources/js/pages/customers/Show.tsx` | Customer detail page with Cicilan tab |

### Modified files
| File | Change |
|---|---|
| `app/Models/Customer.php` | Add `hasActiveCredit()`, `isBlockedForCredit()` |
| `app/Http/Controllers/PosController.php` | store(): add credit validation + plan creation; terminal(): pass customer credit status |
| `app/Http/Controllers/CustomerController.php` | Add show() method |
| `routes/web.php` | Add installment routes + customer show route |
| `routes/console.php` | Register daily schedule |

---

## Task 1: Migrations

**Files:**
- Create: `database/migrations/2026_03_19_100001_create_installment_plans_table.php`
- Create: `database/migrations/2026_03_19_100002_create_installment_payments_table.php`

- [ ] **Step 1: Create installment_plans migration**

```php
<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('installment_plans', function (Blueprint $table) {
            $table->id();
            $table->foreignId('sale_header_id')->constrained('sale_headers')->cascadeOnDelete();
            $table->foreignId('customer_id')->constrained('customers');
            $table->unsignedBigInteger('total_amount');
            $table->unsignedBigInteger('paid_amount')->default(0);
            $table->unsignedInteger('installment_count');
            $table->decimal('interest_rate', 5, 2)->default(0.00); // % per installment
            $table->unsignedBigInteger('late_fee_amount')->default(0); // flat fee per late payment
            $table->string('status', 20)->default('active')->index(); // active|completed|overdue|cancelled
            $table->text('note')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('installment_plans');
    }
};
```

- [ ] **Step 2: Create installment_payments migration**

```php
<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('installment_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('installment_plan_id')->constrained('installment_plans')->cascadeOnDelete();
            $table->date('due_date')->index();
            $table->unsignedBigInteger('amount_due');
            $table->unsignedBigInteger('interest_amount')->default(0);
            $table->unsignedBigInteger('late_fee_applied')->default(0);
            $table->unsignedBigInteger('amount_paid')->default(0);
            $table->timestamp('paid_at')->nullable();
            $table->string('status', 20)->default('pending')->index(); // pending|paid|overdue|partial
            $table->string('payment_method', 30)->nullable(); // set when paid: cash|transfer|qris|card
            $table->unsignedBigInteger('recorded_by')->nullable(); // FK to users
            $table->text('note')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('installment_payments');
    }
};
```

- [ ] **Step 3: Run migrations**

```bash
cd /Users/errr/Developer/Project/my/pos-app
php artisan migrate
```

Expected: both tables created without errors.

- [ ] **Step 4: Commit**

```bash
git add database/migrations/2026_03_19_100001_create_installment_plans_table.php
git add database/migrations/2026_03_19_100002_create_installment_payments_table.php
git commit -m "feat: add installment_plans and installment_payments migrations"
```

---

## Task 2: Models

**Files:**
- Create: `app/Models/InstallmentPlan.php`
- Create: `app/Models/InstallmentPayment.php`
- Modify: `app/Models/Customer.php`

- [ ] **Step 1: Create InstallmentPlan model**

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class InstallmentPlan extends Model
{
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
    ];

    protected $casts = [
        'interest_rate' => 'decimal:2',
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
```

- [ ] **Step 2: Create InstallmentPayment model**

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class InstallmentPayment extends Model
{
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
        'paid_at'  => 'datetime',
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
}
```

- [ ] **Step 3: Add credit helpers to Customer model**

Add these methods to `app/Models/Customer.php`:

```php
public function installmentPlans()
{
    return $this->hasMany(InstallmentPlan::class);
}

public function hasActiveCredit(): bool
{
    return $this->installmentPlans()
        ->whereIn('status', ['active', 'overdue'])
        ->exists();
}

public function isBlockedForCredit(): bool
{
    return $this->installmentPlans()
        ->where('status', 'overdue')
        ->exists();
}
```

- [ ] **Step 4: Commit**

```bash
git add app/Models/InstallmentPlan.php app/Models/InstallmentPayment.php app/Models/Customer.php
git commit -m "feat: add InstallmentPlan, InstallmentPayment models and Customer credit helpers"
```

---

## Task 3: Artisan Command

**Files:**
- Create: `app/Console/Commands/MarkOverdueInstallments.php`
- Modify: `routes/console.php`

- [ ] **Step 1: Create MarkOverdueInstallments command**

```php
<?php

namespace App\Console\Commands;

use App\Models\InstallmentPayment;
use App\Models\InstallmentPlan;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class MarkOverdueInstallments extends Command
{
    protected $signature   = 'installments:mark-overdue';
    protected $description = 'Mark past-due installment payments as overdue and apply late fees';

    public function handle(): int
    {
        $today = Carbon::today();

        DB::transaction(function () use ($today) {
            // 1. Find pending payments past due date
            $overduePayments = InstallmentPayment::where('status', 'pending')
                ->where('due_date', '<', $today)
                ->with('plan')
                ->get();

            foreach ($overduePayments as $payment) {
                $lateFee = $payment->plan->late_fee_amount ?? 0;
                $payment->update([
                    'status'           => 'overdue',
                    'late_fee_applied' => $lateFee,
                ]);
            }

            // 2. Mark parent plans as overdue if they have any overdue payment
            $planIds = $overduePayments->pluck('installment_plan_id')->unique();
            InstallmentPlan::whereIn('id', $planIds)
                ->where('status', 'active')
                ->update(['status' => 'overdue']);
        });

        $count = InstallmentPayment::where('status', 'overdue')->count();
        $this->info("Done. Total overdue payments: {$count}");

        return Command::SUCCESS;
    }
}
```

- [ ] **Step 2: Register schedule in routes/console.php**

Add this line to `routes/console.php`:

```php
Schedule::command('installments:mark-overdue')->dailyAt('01:00');
```

- [ ] **Step 3: Test command runs**

```bash
php artisan installments:mark-overdue
```

Expected: "Done. Total overdue payments: 0"

- [ ] **Step 4: Commit**

```bash
git add app/Console/Commands/MarkOverdueInstallments.php routes/console.php
git commit -m "feat: add MarkOverdueInstallments artisan command and daily schedule"
```

---

## Task 4: InstallmentController

**Files:**
- Create: `app/Http/Controllers/InstallmentController.php`

- [ ] **Step 1: Create the controller**

```php
<?php

namespace App\Http\Controllers;

use App\Models\Customer;
use App\Models\InstallmentPayment;
use App\Models\InstallmentPlan;
use App\Helpers\AuditLogger;
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
            if (!$user) return redirect()->route('login');

            $action = in_array($request->method(), ['POST', 'PUT', 'PATCH'])
                ? 'can_write' : 'can_view';

            if (!$user->hasPermission('pos', $action)) {
                return $request->wantsJson()
                    ? response()->json(['error' => 'Forbidden'], 403)
                    : abort(403);
            }

            return $next($request);
        });
    }

    /**
     * GET /customers/{customer}/installments
     * All installment plans for a customer (used by customer profile tab).
     */
    public function plans(Customer $customer)
    {
        $plans = InstallmentPlan::where('customer_id', $customer->id)
            ->with(['payments', 'saleHeader:id,sale_number,occurred_at'])
            ->orderByDesc('created_at')
            ->get()
            ->map(fn ($plan) => [
                'id'               => $plan->id,
                'saleNumber'       => $plan->saleHeader?->sale_number,
                'occurredAt'       => $plan->saleHeader?->occurred_at?->toISOString(),
                'totalAmount'      => $plan->total_amount,
                'paidAmount'       => $plan->paid_amount,
                'remainingAmount'  => $plan->remainingAmount(),
                'installmentCount' => $plan->installment_count,
                'interestRate'     => (float) $plan->interest_rate,
                'lateFeeAmount'    => $plan->late_fee_amount,
                'status'           => $plan->status,
                'note'             => $plan->note,
                'payments'         => $plan->payments->map(fn ($p) => [
                    'id'             => $p->id,
                    'dueDate'        => $p->due_date->toISOString(),
                    'amountDue'      => $p->amount_due,
                    'interestAmount' => $p->interest_amount,
                    'lateFeeApplied' => $p->late_fee_applied,
                    'amountPaid'     => $p->amount_paid,
                    'totalDue'       => $p->totalDue(),
                    'paidAt'         => $p->paid_at?->toISOString(),
                    'status'         => $p->status,
                    'paymentMethod'  => $p->payment_method,
                    'note'           => $p->note,
                ]),
            ]);

        return response()->json($plans);
    }

    /**
     * POST /installments/{plan}/payments/{payment}/pay
     * Record a payment against one installment row (from customer profile or terminal).
     */
    public function pay(Request $request, InstallmentPlan $plan, InstallmentPayment $payment)
    {
        if ($payment->installment_plan_id !== $plan->id) {
            abort(404);
        }

        if ($payment->status === 'paid') {
            return back()->withErrors(['general' => 'Cicilan ini sudah dibayar.']);
        }

        $request->validate([
            'amount_paid'    => 'required|integer|min:1',
            'payment_method' => 'required|in:cash,transfer,qris,card',
            'note'           => 'nullable|string|max:500',
        ]);

        $amountPaid = (int) $request->amount_paid;
        $totalDue   = $payment->totalDue();

        DB::transaction(function () use ($payment, $plan, $amountPaid, $totalDue, $request) {
            $newStatus = $amountPaid >= $totalDue ? 'paid' : 'partial';

            $payment->update([
                'amount_paid'    => $amountPaid,
                'paid_at'        => $newStatus === 'paid' ? now() : null,
                'status'         => $newStatus,
                'payment_method' => $request->payment_method,
                'recorded_by'    => Auth::id(),
                'note'           => $request->note,
            ]);

            // Update plan paid_amount
            $plan->paid_amount += $amountPaid;
            $plan->paid_amount  = min($plan->paid_amount, $plan->total_amount);

            // Mark plan completed if all payments are paid or paid+partial covering full amount
            $allDone = $plan->remainingAmount() <= 0 ||
                $plan->payments()->whereNotIn('status', ['paid'])->doesntExist();

            if ($allDone) {
                $plan->status = 'completed';
            } elseif ($plan->payments()->where('status', 'overdue')->exists()) {
                $plan->status = 'overdue';
            } else {
                $plan->status = 'active';
            }

            $plan->save();

            AuditLogger::log('installment.paid', $plan->customer, [
                'plan_id'        => $plan->id,
                'payment_id'     => $payment->id,
                'amount'         => $amountPaid,
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
     * Pay installment directly from POS terminal: search customer, pick payment, pay.
     */
    public function payFromTerminal(Request $request)
    {
        $request->validate([
            'installment_payment_id' => 'required|integer|exists:installment_payments,id',
            'amount_paid'            => 'required|integer|min:1',
            'payment_method'         => 'required|in:cash,transfer,qris,card',
            'note'                   => 'nullable|string|max:500',
        ]);

        $payment = InstallmentPayment::with('plan')->findOrFail($request->installment_payment_id);
        $plan    = $payment->plan;

        if ($payment->status === 'paid') {
            return response()->json(['error' => 'Cicilan ini sudah dibayar.'], 422);
        }

        return $this->pay($request, $plan, $payment);
    }

    /**
     * GET /pos/installments/customer/{customer}
     * Return active plans + pending payments for a customer (used by terminal).
     */
    public function customerPlans(Customer $customer)
    {
        $plans = InstallmentPlan::where('customer_id', $customer->id)
            ->whereIn('status', ['active', 'overdue'])
            ->with(['payments' => fn ($q) => $q->whereIn('status', ['pending', 'overdue', 'partial'])->orderBy('due_date'), 'saleHeader:id,sale_number'])
            ->get()
            ->map(fn ($plan) => [
                'id'              => $plan->id,
                'saleNumber'      => $plan->saleHeader?->sale_number,
                'remainingAmount' => $plan->remainingAmount(),
                'status'          => $plan->status,
                'payments'        => $plan->payments->map(fn ($p) => [
                    'id'             => $p->id,
                    'dueDate'        => $p->due_date->toDateString(),
                    'amountDue'      => $p->amount_due,
                    'interestAmount' => $p->interest_amount,
                    'lateFeeApplied' => $p->late_fee_applied,
                    'totalDue'       => $p->totalDue(),
                    'status'         => $p->status,
                ]),
            ]);

        $isBlocked = $customer->isBlockedForCredit();

        return response()->json([
            'plans'     => $plans,
            'isBlocked' => $isBlocked,
        ]);
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/Http/Controllers/InstallmentController.php
git commit -m "feat: add InstallmentController with plans, pay, payFromTerminal, customerPlans"
```

---

## Task 5: Routes

**Files:**
- Modify: `routes/web.php`

- [ ] **Step 1: Add InstallmentController import** at top of routes/web.php with other use statements:

```php
use App\Http\Controllers\InstallmentController;
```

- [ ] **Step 2: Add routes** inside the auth middleware group:

```php
// Installments
Route::get( 'customers/{customer}/installments',                  [InstallmentController::class, 'plans'])          ->name('installments.plans');
Route::get( 'pos/installments/customer/{customer}',               [InstallmentController::class, 'customerPlans'])  ->name('installments.customer_plans');
Route::post('pos/installments/pay',                               [InstallmentController::class, 'payFromTerminal'])->name('installments.pay_terminal');
Route::post('installments/{plan}/payments/{payment}/pay',         [InstallmentController::class, 'pay'])            ->name('installments.pay');

// Customer detail (for cicilan tab)
Route::get('/customers/{customer}', [CustomerController::class, 'show'])->name('customers.show');
```

Note: add `customers/{customer}` show route BEFORE the existing `customers` routes to avoid conflict, or place it adjacent to them.

- [ ] **Step 3: Commit**

```bash
git add routes/web.php
git commit -m "feat: add installment and customer show routes"
```

---

## Task 6: Update PosController

**Files:**
- Modify: `app/Http/Controllers/PosController.php`

- [ ] **Step 1: Add imports** at top of PosController.php:

```php
use App\Models\InstallmentPlan;
use App\Models\InstallmentPayment;
use Illuminate\Support\Carbon;
```

- [ ] **Step 2: Update validation in store()** — change payment_method rule and add credit fields:

Find this line:
```php
'payment_method' => 'required|in:cash,transfer,qris,card',
```
Replace with:
```php
'payment_method'                     => 'required|in:cash,transfer,qris,card,credit',
// Credit-only fields (ignored for non-credit sales)
'credit_schedule'                    => 'required_if:payment_method,credit|array|min:2',
'credit_schedule.*.due_date'         => 'required_if:payment_method,credit|date',
'credit_schedule.*.amount_due'       => 'required_if:payment_method,credit|integer|min:0',
'credit_schedule.*.interest_amount'  => 'nullable|integer|min:0',
'credit_interest_rate'               => 'nullable|numeric|min:0|max:100',
'credit_late_fee'                    => 'nullable|integer|min:0',
```

Also update customer_id validation for credit:
```php
'customer_id' => 'nullable|integer|exists:customers,id|required_if:payment_method,credit',
```

- [ ] **Step 3: Add overdue block check** just before `DB::transaction(` in store():

```php
// Block credit purchases for customers with overdue installments
if ($data['payment_method'] === 'credit') {
    $customer = Customer::findOrFail($data['customer_id']);
    if ($customer->isBlockedForCredit()) {
        return back()->withErrors([
            'customer_id' => 'Pelanggan ini memiliki cicilan yang sudah jatuh tempo. Lunasi dulu sebelum kredit baru.',
        ])->withInput();
    }
}
```

- [ ] **Step 4: Add plan creation inside DB::transaction()** — add after `$result = [...]` is set, still inside the transaction closure. Add as a new step after step 4 (stock deduction):

```php
            // 5. For credit sales: create installment plan and schedule
            if ($data['payment_method'] === 'credit') {
                $schedule      = $data['credit_schedule'];
                $interestRate  = (float) ($data['credit_interest_rate'] ?? 0);
                $lateFee       = (int) ($data['credit_late_fee'] ?? 0);

                $plan = InstallmentPlan::create([
                    'sale_header_id'    => $sale->id,
                    'customer_id'       => $data['customer_id'],
                    'total_amount'      => $grandTotal,
                    'paid_amount'       => 0,
                    'installment_count' => count($schedule),
                    'interest_rate'     => $interestRate,
                    'late_fee_amount'   => $lateFee,
                    'status'            => 'active',
                ]);

                foreach ($schedule as $i => $row) {
                    $isFirst    = $i === 0;
                    $amountDue  = (int) $row['amount_due'];
                    $interestAmt = (int) ($row['interest_amount'] ?? 0);

                    InstallmentPayment::create([
                        'installment_plan_id' => $plan->id,
                        'due_date'            => $row['due_date'],
                        'amount_due'          => $amountDue,
                        'interest_amount'     => $interestAmt,
                        'late_fee_applied'    => 0,
                        'amount_paid'         => $isFirst ? (int) $data['payment_amount'] : 0,
                        'paid_at'             => $isFirst ? now() : null,
                        'status'              => $isFirst ? 'paid' : 'pending',
                        'payment_method'      => $isFirst ? null : null, // first is DP, no separate method needed
                        'recorded_by'         => Auth::id(),
                    ]);
                }

                // Update plan paid_amount with first payment (DP)
                $plan->paid_amount = (int) $data['payment_amount'];
                if ($plan->paid_amount >= $grandTotal) {
                    $plan->status = 'completed';
                }
                $plan->save();
            }
```

- [ ] **Step 5: Update terminal() to pass credit status per customer**

In `terminal()`, update the customers mapping:

```php
$customers = Customer::where('is_active', true)
    ->orderBy('name')
    ->withCount(['installmentPlans as overdue_plans_count' => fn ($q) => $q->where('status', 'overdue')])
    ->withCount(['installmentPlans as active_plans_count'  => fn ($q) => $q->whereIn('status', ['active', 'overdue'])])
    ->get()->map(fn ($c) => [
        'id'           => $c->id,
        'name'         => $c->name,
        'code'         => $c->code,
        'isBlocked'    => $c->overdue_plans_count > 0,
        'hasCredit'    => $c->active_plans_count > 0,
    ]);
```

- [ ] **Step 6: Commit**

```bash
git add app/Http/Controllers/PosController.php
git commit -m "feat: update PosController to support credit payment method and installment plan creation"
```

---

## Task 7: CustomerController — add show()

**Files:**
- Modify: `app/Http/Controllers/CustomerController.php`

- [ ] **Step 1: Add show() method**

Add these imports if missing:
```php
use App\Models\InstallmentPlan;
use Inertia\Inertia;
```

Add method:
```php
public function show(Customer $customer)
{
    $plans = InstallmentPlan::where('customer_id', $customer->id)
        ->with(['payments' => fn ($q) => $q->orderBy('due_date'), 'saleHeader:id,sale_number,occurred_at,grand_total'])
        ->orderByDesc('created_at')
        ->get()
        ->map(fn ($plan) => [
            'id'               => $plan->id,
            'saleNumber'       => $plan->saleHeader?->sale_number,
            'occurredAt'       => $plan->saleHeader?->occurred_at?->toISOString(),
            'grandTotal'       => $plan->saleHeader?->grand_total,
            'totalAmount'      => $plan->total_amount,
            'paidAmount'       => $plan->paid_amount,
            'remainingAmount'  => $plan->remainingAmount(),
            'installmentCount' => $plan->installment_count,
            'interestRate'     => (float) $plan->interest_rate,
            'lateFeeAmount'    => $plan->late_fee_amount,
            'status'           => $plan->status,
            'note'             => $plan->note,
            'payments'         => $plan->payments->map(fn ($p) => [
                'id'             => $p->id,
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
            ]),
        ]);

    $totalOutstanding = $plans->where('status', '!=', 'completed')->sum(fn ($p) => $p['remainingAmount']);
    $isBlocked        = $customer->isBlockedForCredit();

    return Inertia::render('customers/Show', [
        'customer' => [
            'id'      => $customer->id,
            'name'    => $customer->name,
            'code'    => $customer->code,
            'phone'   => $customer->phone,
            'email'   => $customer->email,
            'address' => $customer->address,
            'city'    => $customer->city,
            'notes'   => $customer->notes,
        ],
        'plans'           => $plans,
        'totalOutstanding'=> $totalOutstanding,
        'isBlocked'       => $isBlocked,
    ]);
}
```

- [ ] **Step 2: Commit**

```bash
git add app/Http/Controllers/CustomerController.php
git commit -m "feat: add CustomerController::show() with installment plans"
```

---

## Task 8: Frontend — Customer Show page with Cicilan tab

**Files:**
- Create: `resources/js/pages/customers/Show.tsx`

- [ ] **Step 1: Create the page**

```tsx
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { router, usePage, useForm } from '@inertiajs/react';
import { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';

interface CustomerInfo {
    id: number; name: string; code: string; phone: string | null;
    email: string | null; address: string | null; city: string | null; notes: string | null;
}

interface PaymentRow {
    id: number; dueDate: string; amountDue: number; interestAmount: number;
    lateFeeApplied: number; totalDue: number; amountPaid: number; paidAt: string | null;
    status: 'pending' | 'paid' | 'overdue' | 'partial'; paymentMethod: string | null; note: string | null;
}

interface PlanRow {
    id: number; saleNumber: string | null; occurredAt: string | null; grandTotal: number;
    totalAmount: number; paidAmount: number; remainingAmount: number;
    installmentCount: number; interestRate: number; lateFeeAmount: number;
    status: 'active' | 'completed' | 'overdue' | 'cancelled'; note: string | null;
    payments: PaymentRow[];
}

interface PageProps {
    customer: CustomerInfo;
    plans: PlanRow[];
    totalOutstanding: number;
    isBlocked: boolean;
    permissions: Record<string, Record<string, boolean>>;
    [key: string]: unknown;
}

const fmt = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;
const statusLabel: Record<string, { label: string; cls: string }> = {
    active:    { label: 'Aktif',     cls: 'bg-blue-100 text-blue-700' },
    completed: { label: 'Lunas',     cls: 'bg-green-100 text-green-700' },
    overdue:   { label: 'Jatuh Tempo', cls: 'bg-red-100 text-red-700' },
    cancelled: { label: 'Dibatalkan', cls: 'bg-gray-100 text-gray-500' },
    pending:   { label: 'Menunggu',  cls: 'bg-yellow-100 text-yellow-700' },
    paid:      { label: 'Dibayar',   cls: 'bg-green-100 text-green-700' },
    partial:   { label: 'Sebagian',  cls: 'bg-orange-100 text-orange-700' },
};

function PaymentForm({ payment, planId, onDone }: {
    payment: PaymentRow; planId: number; onDone: () => void;
}) {
    const form = useForm({
        amount_paid: payment.totalDue,
        payment_method: 'cash' as string,
        note: '',
    });

    function submit(e: React.FormEvent) {
        e.preventDefault();
        form.post(route('installments.pay', { plan: planId, payment: payment.id }), {
            onSuccess: onDone,
        });
    }

    return (
        <form onSubmit={submit} className="mt-2 p-3 rounded-lg border bg-muted/30 space-y-3 text-sm">
            <div className="flex gap-3 flex-wrap">
                <div>
                    <label className="block text-xs font-medium mb-1">Jumlah Bayar</label>
                    <input type="number" min={1} value={form.data.amount_paid}
                        onChange={e => form.setData('amount_paid', parseInt(e.target.value) || 0)}
                        className="border rounded px-2 py-1 w-36 text-right" />
                    {form.errors.amount_paid && <p className="text-red-500 text-xs mt-0.5">{form.errors.amount_paid}</p>}
                </div>
                <div>
                    <label className="block text-xs font-medium mb-1">Metode</label>
                    <select value={form.data.payment_method} onChange={e => form.setData('payment_method', e.target.value)}
                        className="border rounded px-2 py-1">
                        {['cash','transfer','qris','card'].map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                </div>
                <div className="flex-1 min-w-32">
                    <label className="block text-xs font-medium mb-1">Catatan</label>
                    <input type="text" value={form.data.note} onChange={e => form.setData('note', e.target.value)}
                        className="border rounded px-2 py-1 w-full" placeholder="Opsional" />
                </div>
            </div>
            <div className="flex gap-2">
                <button type="submit" disabled={form.processing}
                    className="px-3 py-1.5 rounded bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50">
                    {form.processing ? 'Menyimpan…' : 'Catat Pembayaran'}
                </button>
                <button type="button" onClick={onDone} className="px-3 py-1.5 rounded border text-xs">Batal</button>
            </div>
        </form>
    );
}

export default function CustomerShow() {
    const { customer, plans, totalOutstanding, isBlocked, permissions } = usePage<PageProps>().props;
    const canWrite = permissions?.pos?.can_write ?? false;
    const [expandedPlan, setExpandedPlan] = useState<number | null>(plans[0]?.id ?? null);
    const [payingPaymentId, setPayingPaymentId] = useState<number | null>(null);

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Pelanggan', href: route('customers.index') },
        { title: customer.name, href: '#' },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
                {/* Header */}
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h1 className="text-xl font-bold">{customer.name}</h1>
                        <p className="text-sm text-muted-foreground">{customer.code}{customer.phone ? ` · ${customer.phone}` : ''}</p>
                    </div>
                    <a href={route('customers.index')} className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border bg-background hover:bg-muted transition-colors font-medium">
                        ← Kembali
                    </a>
                </div>

                {/* Blocked banner */}
                {isBlocked && (
                    <div className="flex items-center gap-3 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        Pelanggan ini memiliki cicilan jatuh tempo. Tidak dapat menggunakan kredit baru sampai hutang dilunasi.
                    </div>
                )}

                {/* Summary */}
                {plans.length > 0 && (
                    <div className="rounded-xl border p-4 grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                        <div>
                            <div className="text-muted-foreground text-xs mb-0.5">Total Cicilan</div>
                            <div className="font-semibold">{plans.length} plan</div>
                        </div>
                        <div>
                            <div className="text-muted-foreground text-xs mb-0.5">Sisa Hutang</div>
                            <div className={`font-semibold ${totalOutstanding > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                {fmt(totalOutstanding)}
                            </div>
                        </div>
                        <div>
                            <div className="text-muted-foreground text-xs mb-0.5">Status</div>
                            <div className={`font-semibold ${isBlocked ? 'text-red-600' : 'text-green-600'}`}>
                                {isBlocked ? 'Tertunggak' : 'Baik'}
                            </div>
                        </div>
                    </div>
                )}

                {/* Plans */}
                <div className="space-y-3">
                    <h2 className="font-semibold">Riwayat Cicilan</h2>
                    {plans.length === 0 ? (
                        <div className="rounded-xl border p-6 text-center text-sm text-muted-foreground">
                            Belum ada cicilan untuk pelanggan ini.
                        </div>
                    ) : plans.map(plan => (
                        <div key={plan.id} className="rounded-xl border overflow-hidden">
                            {/* Plan header */}
                            <button type="button" onClick={() => setExpandedPlan(expandedPlan === plan.id ? null : plan.id)}
                                className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors text-sm">
                                <div className="flex items-center gap-3">
                                    {expandedPlan === plan.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                    <div className="text-left">
                                        <div className="font-medium">{plan.saleNumber ?? '—'}</div>
                                        <div className="text-xs text-muted-foreground">
                                            {plan.occurredAt ? new Date(plan.occurredAt).toLocaleDateString('id-ID') : '—'} · {plan.installmentCount}x cicilan
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="text-right">
                                        <div className="font-semibold">{fmt(plan.totalAmount)}</div>
                                        {plan.remainingAmount > 0 && (
                                            <div className="text-xs text-muted-foreground">Sisa: {fmt(plan.remainingAmount)}</div>
                                        )}
                                    </div>
                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusLabel[plan.status]?.cls}`}>
                                        {statusLabel[plan.status]?.label}
                                    </span>
                                </div>
                            </button>

                            {/* Payment schedule */}
                            {expandedPlan === plan.id && (
                                <div className="divide-y">
                                    {plan.payments.map((p, idx) => (
                                        <div key={p.id} className="px-4 py-3 text-sm">
                                            <div className="flex items-center justify-between gap-2">
                                                <div>
                                                    <div className="font-medium text-xs text-muted-foreground mb-0.5">
                                                        Cicilan #{idx + 1} · Jatuh tempo {new Date(p.dueDate).toLocaleDateString('id-ID')}
                                                    </div>
                                                    <div className="font-semibold">{fmt(p.totalDue)}</div>
                                                    {(p.interestAmount > 0 || p.lateFeeApplied > 0) && (
                                                        <div className="text-xs text-muted-foreground">
                                                            Pokok: {fmt(p.amountDue)}
                                                            {p.interestAmount > 0 && ` · Bunga: ${fmt(p.interestAmount)}`}
                                                            {p.lateFeeApplied > 0 && ` · Denda: ${fmt(p.lateFeeApplied)}`}
                                                        </div>
                                                    )}
                                                    {p.paidAt && (
                                                        <div className="text-xs text-green-600">
                                                            Dibayar {new Date(p.paidAt).toLocaleDateString('id-ID')} via {p.paymentMethod}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusLabel[p.status]?.cls}`}>
                                                        {statusLabel[p.status]?.label}
                                                    </span>
                                                    {canWrite && p.status !== 'paid' && payingPaymentId !== p.id && (
                                                        <button type="button" onClick={() => setPayingPaymentId(p.id)}
                                                            className="text-xs px-2 py-1 rounded border bg-background hover:bg-muted transition-colors">
                                                            Bayar
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                            {payingPaymentId === p.id && (
                                                <PaymentForm payment={p} planId={plan.id} onDone={() => setPayingPaymentId(null)} />
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </AppLayout>
    );
}
```

- [ ] **Step 2: Add link from Customer Index page**

In `resources/js/pages/customers/Index.tsx`, find where customer rows are rendered and add a detail link button (eye icon or name link) that navigates to `route('customers.show', customer.id)`.

- [ ] **Step 3: Commit**

```bash
git add resources/js/pages/customers/Show.tsx resources/js/pages/customers/Index.tsx
git commit -m "feat: add Customer Show page with installment plan tab"
```

---

## Task 9: Frontend — "Bayar Cicilan" terminal page

**Files:**
- Create: `resources/js/pages/pos/InstallmentPayment.tsx`

- [ ] **Step 1: Create page**

This page is a standalone terminal screen for recording installment payments. It uses Inertia's `router.visit()` to navigate to it from the terminal.

```tsx
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { router, usePage } from '@inertiajs/react';
import { useState, useRef } from 'react';
import { Search } from 'lucide-react';

interface CustomerOption { id: number; name: string; code: string; isBlocked: boolean; hasCredit: boolean; }
interface PaymentRow {
    id: number; dueDate: string; amountDue: number; interestAmount: number;
    lateFeeApplied: number; totalDue: number; status: string;
}
interface PlanOption {
    id: number; saleNumber: string | null; remainingAmount: number; status: string; payments: PaymentRow[];
}

interface PageProps {
    customers: CustomerOption[];
    [key: string]: unknown;
}

const fmt = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Kasir', href: route('pos.terminal') },
    { title: 'Bayar Cicilan', href: '#' },
];

export default function InstallmentPaymentPage() {
    const { customers } = usePage<PageProps>().props;

    const [search, setSearch] = useState('');
    const [dropOpen, setDropOpen] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState<CustomerOption | null>(null);
    const [plans, setPlans] = useState<PlanOption[]>([]);
    const [loadingPlans, setLoadingPlans] = useState(false);

    const [selectedPaymentId, setSelectedPaymentId] = useState<number | null>(null);
    const [amountPaid, setAmountPaid] = useState(0);
    const [paymentMethod, setPaymentMethod] = useState('cash');
    const [note, setNote] = useState('');
    const [processing, setProcessing] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [successMsg, setSuccessMsg] = useState('');

    const searchRef = useRef<HTMLInputElement>(null);

    const filteredCustomers = customers.filter(c => {
        const q = search.toLowerCase();
        return !q || c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q);
    }).slice(0, 15);

    function selectCustomer(c: CustomerOption) {
        setSelectedCustomer(c);
        setSearch(c.name);
        setDropOpen(false);
        setPlans([]);
        setSelectedPaymentId(null);
        setSuccessMsg('');

        setLoadingPlans(true);
        fetch(route('installments.customer_plans', { customer: c.id }), {
            headers: { 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        })
            .then(r => r.json())
            .then(data => setPlans(data.plans ?? []))
            .finally(() => setLoadingPlans(false));
    }

    function selectPayment(p: PaymentRow) {
        setSelectedPaymentId(p.id);
        setAmountPaid(p.totalDue);
        setErrors({});
    }

    function submitPayment(e: React.FormEvent) {
        e.preventDefault();
        if (!selectedPaymentId) return;
        setProcessing(true);
        setErrors({});

        router.post(route('installments.pay_terminal'), {
            installment_payment_id: selectedPaymentId,
            amount_paid: amountPaid,
            payment_method: paymentMethod,
            note,
        }, {
            onError: (errs) => setErrors(errs as Record<string, string>),
            onSuccess: () => {
                setSuccessMsg('Pembayaran berhasil dicatat!');
                setSelectedPaymentId(null);
                setNote('');
                // Refresh plans
                if (selectedCustomer) selectCustomer(selectedCustomer);
            },
            onFinish: () => setProcessing(false),
        });
    }

    const allPayments = plans.flatMap(plan =>
        plan.payments.map(p => ({ ...p, planId: plan.id, saleNumber: plan.saleNumber }))
    );

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
                <div className="flex items-center justify-between">
                    <h1 className="text-xl font-bold">Bayar Cicilan</h1>
                    <a href={route('pos.terminal')} className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border bg-background hover:bg-muted transition-colors font-medium">
                        ← Terminal
                    </a>
                </div>

                {successMsg && (
                    <div className="rounded-lg border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-700">
                        {successMsg}
                    </div>
                )}

                {/* Customer search */}
                <div>
                    <label className="block text-sm font-medium mb-1">Pelanggan</label>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input ref={searchRef} type="text" value={search}
                            onChange={e => { setSearch(e.target.value); setDropOpen(true); setSelectedCustomer(null); setPlans([]); }}
                            onFocus={() => setDropOpen(true)}
                            onBlur={() => setTimeout(() => setDropOpen(false), 150)}
                            placeholder="Cari nama atau kode pelanggan…"
                            className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
                        {dropOpen && filteredCustomers.length > 0 && (
                            <div className="absolute left-0 right-0 top-full mt-1 z-20 bg-popover border rounded-lg shadow-lg max-h-52 overflow-y-auto">
                                {filteredCustomers.map(c => (
                                    <button key={c.id} type="button" onMouseDown={() => selectCustomer(c)}
                                        className="w-full text-left px-3 py-2 hover:bg-muted/60 flex items-center justify-between text-sm">
                                        <span>{c.name} <span className="text-muted-foreground text-xs">({c.code})</span></span>
                                        {c.isBlocked && <span className="text-xs text-red-600 font-medium">Tertunggak</span>}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Plans / payments */}
                {loadingPlans && <p className="text-sm text-muted-foreground">Memuat cicilan…</p>}

                {!loadingPlans && selectedCustomer && plans.length === 0 && (
                    <div className="rounded-xl border p-6 text-center text-sm text-muted-foreground">
                        Tidak ada cicilan aktif untuk pelanggan ini.
                    </div>
                )}

                {allPayments.length > 0 && (
                    <div className="space-y-2">
                        <h2 className="text-sm font-medium">Pilih cicilan yang akan dibayar:</h2>
                        {allPayments.map(p => (
                            <div key={p.id}
                                className={`rounded-lg border p-3 cursor-pointer transition-colors ${selectedPaymentId === p.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/30'} ${p.status === 'overdue' ? 'border-red-300' : ''}`}
                                onClick={() => selectPayment(p)}>
                                <div className="flex justify-between text-sm">
                                    <div>
                                        <span className="font-medium">{p.saleNumber ?? '—'}</span>
                                        <span className="text-muted-foreground ml-2 text-xs">Jatuh tempo {new Date(p.dueDate).toLocaleDateString('id-ID')}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-semibold">{fmt(p.totalDue)}</span>
                                        {p.status === 'overdue' && <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">Terlambat</span>}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Payment form */}
                {selectedPaymentId && (
                    <form onSubmit={submitPayment} className="rounded-xl border p-4 space-y-4 bg-muted/20">
                        <h2 className="font-semibold text-sm">Detail Pembayaran</h2>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-medium mb-1">Jumlah Bayar</label>
                                <input type="number" min={1} value={amountPaid}
                                    onChange={e => setAmountPaid(parseInt(e.target.value) || 0)}
                                    className="w-full border rounded-lg px-3 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-ring" />
                                {errors.amount_paid && <p className="text-red-500 text-xs mt-0.5">{errors.amount_paid}</p>}
                            </div>
                            <div>
                                <label className="block text-xs font-medium mb-1">Metode</label>
                                <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}
                                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                                    <option value="cash">Cash</option>
                                    <option value="transfer">Transfer</option>
                                    <option value="qris">QRIS</option>
                                    <option value="card">Card</option>
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-medium mb-1">Catatan (opsional)</label>
                            <input type="text" value={note} onChange={e => setNote(e.target.value)}
                                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                placeholder="Catatan pembayaran…" />
                        </div>
                        {errors.general && <p className="text-red-500 text-sm">{errors.general}</p>}
                        <div className="flex gap-2">
                            <button type="submit" disabled={processing}
                                className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50">
                                {processing ? 'Menyimpan…' : 'Catat Pembayaran'}
                            </button>
                            <button type="button" onClick={() => setSelectedPaymentId(null)}
                                className="px-4 py-2 rounded-lg border text-sm">Batal</button>
                        </div>
                    </form>
                )}
            </div>
        </AppLayout>
    );
}
```

- [ ] **Step 2: Add route for the page**

Add to `routes/web.php`:
```php
Route::get('pos/installments', [InstallmentController::class, 'terminalPage'])->name('pos.installments');
```

Add `terminalPage()` to `InstallmentController`:
```php
public function terminalPage()
{
    $customers = Customer::where('is_active', true)
        ->orderBy('name')
        ->withCount(['installmentPlans as overdue_count' => fn ($q) => $q->where('status', 'overdue')])
        ->withCount(['installmentPlans as active_count'  => fn ($q) => $q->whereIn('status', ['active', 'overdue'])])
        ->get()->map(fn ($c) => [
            'id'        => $c->id,
            'name'      => $c->name,
            'code'      => $c->code,
            'isBlocked' => $c->overdue_count > 0,
            'hasCredit' => $c->active_count > 0,
        ]);

    return Inertia::render('pos/InstallmentPayment', [
        'customers' => $customers,
    ]);
}
```

- [ ] **Step 3: Commit**

```bash
git add resources/js/pages/pos/InstallmentPayment.tsx routes/web.php app/Http/Controllers/InstallmentController.php
git commit -m "feat: add InstallmentPayment terminal page and terminalPage() route"
```

---

## Task 10: Frontend — Update POS Terminal for credit payment

**Files:**
- Modify: `resources/js/pages/pos/Terminal.tsx`

This is the largest frontend change. The Terminal receives `customers` with `isBlocked` and `hasCredit` fields. Add credit payment mode to the payment panel.

- [ ] **Step 1: Add credit-related state and types**

In the Terminal component, add these state variables near the existing payment state:

```tsx
// Credit/installment state
const [isCreditMode, setIsCreditMode]       = useState(false);
const [creditSchedule, setCreditSchedule]   = useState<ScheduleRow[]>([]);
const [creditInterestRate, setCreditInterestRate] = useState(0);
const [creditLateFee, setCreditLateFee]     = useState(0);
const [dpAmount, setDpAmount]               = useState(0);
const [installmentCount, setInstallmentCount] = useState(2);
const [intervalMonths, setIntervalMonths]   = useState(1);
```

Add interface before component:
```tsx
interface ScheduleRow {
    due_date: string;   // ISO date string
    amount_due: number;
    interest_amount: number;
    is_first: boolean;
}
```

- [ ] **Step 2: Add schedule generator helper**

```tsx
function generateSchedule(
    grandTotal: number,
    dp: number,
    count: number,
    intervalMonths: number,
    interestRate: number
): ScheduleRow[] {
    const rows: ScheduleRow[] = [];
    const remaining = grandTotal - dp;
    const baseAmount = count <= 1 ? remaining : Math.floor(remaining / (count - 1));
    let runningRemainder = remaining;

    // First row: DP paid today
    rows.push({ due_date: new Date().toISOString().split('T')[0], amount_due: dp, interest_amount: 0, is_first: true });

    for (let i = 1; i < count; i++) {
        const d = new Date();
        d.setMonth(d.getMonth() + i * intervalMonths);
        const isLast = i === count - 1;
        const rowAmount = isLast ? runningRemainder : baseAmount;
        runningRemainder -= rowAmount;
        const interest = Math.round(rowAmount * interestRate / 100);
        rows.push({ due_date: d.toISOString().split('T')[0], amount_due: rowAmount, interest_amount: interest, is_first: false });
    }
    return rows;
}
```

- [ ] **Step 3: Add "Bayar Cicilan" button to terminal header**

In the terminal top-bar area, add next to the existing header buttons:
```tsx
<a href={route('pos.installments')}
    className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border bg-background hover:bg-muted transition-colors font-medium">
    Bayar Cicilan
</a>
```

- [ ] **Step 4: Add Kredit option to payment method selector**

Find the payment method radio/button group in Terminal.tsx and add a credit option. When `isCreditMode` is true:
- Show the credit setup panel
- Require a customer to be selected (show validation error inline if not)
- If selected customer `isBlocked`, show warning and disable submit

```tsx
{/* Credit mode toggle — only show if customer is selected and not blocked */}
<label className={`flex items-center gap-2 cursor-pointer px-3 py-2 rounded-lg border text-sm ${isCreditMode ? 'border-primary bg-primary/5 font-semibold' : 'hover:bg-muted/30'}`}>
    <input type="radio" name="paymentMethod" value="credit"
        checked={isCreditMode}
        onChange={() => { setIsCreditMode(true); setPaymentMethod('credit'); }}
        className="accent-primary" />
    Kredit
</label>
```

- [ ] **Step 5: Add credit setup panel**

Render this panel below the payment method selector, only when `isCreditMode === true`:

```tsx
{isCreditMode && (
    <div className="mt-3 rounded-xl border bg-muted/20 p-4 space-y-3 text-sm">
        {!selectedCustomerId && (
            <p className="text-red-500 text-xs">Pilih pelanggan terlebih dahulu untuk menggunakan kredit.</p>
        )}
        {selectedCustomer?.isBlocked && (
            <div className="flex items-center gap-2 text-red-600 text-xs">
                <AlertTriangle className="w-3.5 h-3.5" /> Pelanggan ini memiliki cicilan jatuh tempo. Kredit diblokir.
            </div>
        )}
        <div className="grid grid-cols-2 gap-3">
            <div>
                <label className="text-xs font-medium">Uang Muka (DP)</label>
                <input type="number" min={0} max={grandTotal} value={dpAmount}
                    onChange={e => { const v = parseInt(e.target.value)||0; setDpAmount(v); setCreditSchedule(generateSchedule(grandTotal, v, installmentCount, intervalMonths, creditInterestRate)); }}
                    className="mt-1 w-full border rounded px-2 py-1.5 text-right focus:outline-none focus:ring-1 focus:ring-ring" />
            </div>
            <div>
                <label className="text-xs font-medium">Jumlah Cicilan</label>
                <input type="number" min={2} max={24} value={installmentCount}
                    onChange={e => { const v = parseInt(e.target.value)||2; setInstallmentCount(v); setCreditSchedule(generateSchedule(grandTotal, dpAmount, v, intervalMonths, creditInterestRate)); }}
                    className="mt-1 w-full border rounded px-2 py-1.5 text-right focus:outline-none focus:ring-1 focus:ring-ring" />
            </div>
            <div>
                <label className="text-xs font-medium">Interval (bulan)</label>
                <input type="number" min={1} max={12} value={intervalMonths}
                    onChange={e => { const v = parseInt(e.target.value)||1; setIntervalMonths(v); setCreditSchedule(generateSchedule(grandTotal, dpAmount, v, installmentCount, creditInterestRate)); }}
                    className="mt-1 w-full border rounded px-2 py-1.5 text-right focus:outline-none focus:ring-1 focus:ring-ring" />
            </div>
            <div>
                <label className="text-xs font-medium">Bunga % / cicilan</label>
                <input type="number" min={0} max={100} step={0.1} value={creditInterestRate}
                    onChange={e => { const v = parseFloat(e.target.value)||0; setCreditInterestRate(v); setCreditSchedule(generateSchedule(grandTotal, dpAmount, installmentCount, intervalMonths, v)); }}
                    className="mt-1 w-full border rounded px-2 py-1.5 text-right focus:outline-none focus:ring-1 focus:ring-ring" />
            </div>
        </div>

        {/* Schedule preview */}
        {creditSchedule.length > 0 && (
            <div className="mt-2">
                <div className="text-xs font-medium mb-1">Preview Jadwal:</div>
                <div className="space-y-1">
                    {creditSchedule.map((row, i) => (
                        <div key={i} className="flex justify-between text-xs px-2 py-1 rounded bg-background border">
                            <span>{row.is_first ? 'Sekarang (DP)' : new Date(row.due_date).toLocaleDateString('id-ID')}</span>
                            <span className="font-medium">
                                Rp {(row.amount_due + row.interest_amount).toLocaleString('id-ID')}
                                {row.interest_amount > 0 && <span className="text-muted-foreground"> (+bunga)</span>}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        )}
    </div>
)}
```

- [ ] **Step 6: Update submit payload for credit sales**

In the submit handler, when `isCreditMode`, add credit fields to the POST payload:
```tsx
...(isCreditMode && {
    credit_schedule:      creditSchedule,
    credit_interest_rate: creditInterestRate,
    credit_late_fee:      creditLateFee,
    payment_amount:       dpAmount, // only DP collected now
}),
```

Also: initialize schedule when cart total changes:
```tsx
useEffect(() => {
    if (isCreditMode && grandTotal > 0) {
        setDpAmount(prev => Math.min(prev, grandTotal));
        setCreditSchedule(generateSchedule(grandTotal, dpAmount, installmentCount, intervalMonths, creditInterestRate));
    }
}, [grandTotal, isCreditMode]);
```

- [ ] **Step 7: Commit**

```bash
git add resources/js/pages/pos/Terminal.tsx
git commit -m "feat: add credit payment mode and installment schedule builder to POS Terminal"
```

---

## Task 11: Final check

- [ ] **Step 1: Run type check**
```bash
cd /Users/errr/Developer/Project/my/pos-app && npm run types
```

- [ ] **Step 2: Run PHP code style**
```bash
vendor/bin/pint app/Models/InstallmentPlan.php app/Models/InstallmentPayment.php app/Http/Controllers/InstallmentController.php app/Console/Commands/MarkOverdueInstallments.php
```

- [ ] **Step 3: Run tests**
```bash
composer run test
```

- [ ] **Step 4: Final commit if any style fixes**
```bash
git add -p
git commit -m "style: pint fixes for installment feature"
```
