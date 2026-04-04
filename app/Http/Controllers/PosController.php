<?php

namespace App\Http\Controllers;

use App\Helpers\InvoiceNumber;
use App\Models\AppSetting;
use App\Models\Customer;
use Barryvdh\DomPDF\Facade\Pdf;
use App\Models\InstallmentPayment;
use App\Models\InstallmentPlan;
use App\Models\Item;
use App\Models\Promotion;
use App\Models\SaleHeader;
use App\Models\SaleItem;
use App\Models\Warehouse;
use App\Models\WarehouseItem;
use App\Traits\FiltersWarehouseByUser;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Inertia\Inertia;

class PosController extends Controller
{
    use FiltersWarehouseByUser;

    public function __construct()
    {
        $this->middleware(function ($request, $next) {
            $user = $request->user();
            if (! $user) {
                return redirect()->route('login');
            }

            $method = $request->method();
            $action = match (true) {
                $method === 'DELETE' => 'can_delete',
                in_array($method, ['POST', 'PUT', 'PATCH']) => 'can_write',
                default => 'can_view',
            };

            if (! $user->hasPermission('pos', $action)) {
                return $request->wantsJson()
                    ? response()->json(['error' => 'Forbidden'], 403)
                    : abort(403);
            }

            return $next($request);
        });
    }

    /**
     * Sale history (index).
     */
    public function index(Request $request)
    {
        $perPage = in_array((int) $request->get('per_page', 20), [10, 20, 50, 100])
            ? (int) $request->get('per_page', 20) : 20;
        $search = trim((string) $request->get('search', ''));
        $dateFrom = $request->get('date_from');
        $dateTo = $request->get('date_to');
        $payMethod = $request->get('payment_method', '');
        $status = $request->get('status', '');
        $sortDir = strtolower($request->get('sort_dir', 'desc')) === 'asc' ? 'asc' : 'desc';

        $allowedSort = [
            'date' => 'sale_headers.occurred_at',
            'saleNumber' => 'sale_headers.sale_number',
            'grandTotal' => 'sale_headers.grand_total',
            'paymentMethod' => 'sale_headers.payment_method',
            'cashier' => 'users.name',
            'customer' => 'customers.name',
        ];
        $sortKey = $request->get('sort_by', 'date');
        $sortColumn = $allowedSort[$sortKey] ?? 'sale_headers.occurred_at';

        $query = SaleHeader::with(['warehouse', 'customer', 'cashier'])
            ->withCount('saleItems')
            ->leftJoin('users', 'sale_headers.cashier_id', '=', 'users.id')
            ->leftJoin('customers', 'sale_headers.customer_id', '=', 'customers.id')
            ->select('sale_headers.*');

        if ($search !== '') {
            $term = strtolower($search);
            $query->where(function ($q) use ($term) {
                $q->whereRaw('LOWER(sale_headers.sale_number) like ?', ["%{$term}%"])
                    ->orWhereRaw('LOWER(users.name) like ?', ["%{$term}%"])
                    ->orWhereRaw('LOWER(customers.name) like ?', ["%{$term}%"]);
            });
        }
        if ($dateFrom) {
            $query->where('sale_headers.occurred_at', '>=', $dateFrom.' 00:00:00');
        }
        if ($dateTo) {
            $query->where('sale_headers.occurred_at', '<=', $dateTo.' 23:59:59');
        }
        if ($payMethod) {
            $query->where('sale_headers.payment_method', $payMethod);
        }
        if ($status) {
            $query->where('sale_headers.status', $status);
        }

        $ids = $this->allowedWarehouseIds();
        if (! empty($ids)) {
            $query->whereIn('sale_headers.warehouse_id', $ids);
        }

        $query->orderBy($sortColumn, $sortDir);

        $sales = $query->paginate($perPage)->withQueryString()->through(fn ($s) => [
            'id' => hid($s->id),
            'saleNumber' => $s->sale_number,
            'date' => $s->occurred_at?->toISOString(),
            'cashier' => $s->cashier?->name ?? '-',
            'customerName' => $s->customer?->name ?? 'Walk-in',
            'warehouseName' => $s->warehouse?->name ?? '-',
            'subtotal' => $s->subtotal,
            'discountAmount' => $s->discount_amount,
            'grandTotal' => $s->grand_total,
            'paymentMethod' => $s->payment_method,
            'paymentAmount' => $s->payment_amount,
            'changeAmount' => $s->change_amount,
            'status' => $s->status,
            'note' => $s->note,
            'itemCount' => $s->sale_items_count,
        ]);

        return Inertia::render('pos/Index', [
            'sales' => $sales,
            'filters' => array_merge(
                $request->only(['search', 'date_from', 'date_to', 'payment_method', 'status', 'per_page']),
                ['sort_by' => $sortKey, 'sort_dir' => $sortDir]
            ),
        ]);
    }

    /**
     * GET /pos/items?warehouse_id=X
     * Return items with outlet-resolved prices for a given warehouse.
     */
    public function items(Request $request)
    {
        $warehouseId = dhid((string) $request->get('warehouse_id', ''));

        $result = DB::table('items')
            ->where('items.harga_jual', '>', 0)
            ->leftJoin('warehouse_item_prices as wip', function ($join) use ($warehouseId) {
                $join->on('wip.item_id', '=', 'items.id')
                    ->where('wip.warehouse_id', $warehouseId);
            })
            ->select([
                'items.id',
                DB::raw('COALESCE(wip.harga_jual, items.harga_jual) as resolved_price'),
            ])
            ->get()
            ->mapWithKeys(fn ($r) => [hid($r->id) => (int) $r->resolved_price]);

        return response()->json($result);
    }

    /**
     * POS Terminal screen.
     */
    public function terminal(Request $request)
    {
        $warehouseQuery = Warehouse::where('is_active', true)
            ->orderBy('is_default', 'desc')->orderBy('name');
        $this->applyWarehouseFilter($warehouseQuery, 'id');
        $warehouses = $warehouseQuery->get()->map(fn ($w) => [
            'id' => hid($w->id),
            'name' => $w->name,
            'code' => $w->code,
            'isDefault' => (bool) $w->is_default,
        ]);

        // Auto-select: if user can only access one warehouse, lock them to it
        $autoWarehouseId = $warehouses->count() === 1 ? $warehouses->first()['id'] : null;

        $items = Item::with(['tags', 'variants'])->select('id', 'nama', 'kode_item', 'kategori', 'id_kategori', 'stok', 'harga_jual', 'image_path')
            ->where('harga_jual', '>', 0)
            ->orderBy('nama')->get()->map(fn ($i) => [
                'id' => hid($i->id),
                'name' => $i->nama,
                'code' => $i->kode_item,
                'category' => $i->kategori,
                'categoryId' => hid($i->id_kategori),
                'stock' => $i->stok,
                'price' => $i->harga_jual,
                'imageUrl' => $i->image_path ? Storage::url($i->image_path) : null,
                'tagIds' => $i->tags->map(fn ($t) => hid($t->id))->values()->all(),
                'variants' => $i->variants->map(fn ($v) => [
                    'id' => hid($v->id),
                    'name' => $v->name,
                    'priceModifier' => $v->price_modifier,
                ])->values()->all(),
            ]);

        $customers = Customer::where('is_active', true)
            ->orderBy('name')
            ->withCount(['installmentPlans as overdue_count' => fn ($q) => $q->where('status', 'overdue')])
            ->withCount(['installmentPlans as active_count' => fn ($q) => $q->whereIn('status', ['active', 'overdue'])])
            ->get()
            ->map(fn ($c) => [
                'id' => hid($c->id),
                'name' => $c->name,
                'code' => $c->code,
                'isBlocked' => $c->overdue_count > 0,
                'hasCredit' => $c->active_count > 0,
            ]);

        $promotions = Promotion::active()
            ->get()
            ->map(fn ($p) => [
                'id' => hid($p->id),
                'name' => $p->name,
                'type' => $p->type,
                'value' => $p->value,
                'appliesTo' => $p->applies_to,
                'appliesId' => hid($p->applies_id),
                'minPurchase' => $p->min_purchase,
                'maxDiscount' => $p->max_discount,
            ]);

        return Inertia::render('pos/Terminal', [
            'warehouses' => $warehouses,
            'items' => $items,
            'customers' => $customers,
            'promotions' => $promotions,
            'autoWarehouseId' => $autoWarehouseId,
        ]);
    }

    /**
     * Validate a promo code and return promo details.
     */
    public function validatePromo(Request $request)
    {
        $code = trim((string) $request->get('code', ''));
        if ($code === '') {
            return response()->json(['error' => 'Kode tidak boleh kosong'], 422);
        }

        $promo = Promotion::where('code', $code)->active()->first();
        if (! $promo) {
            return response()->json(['error' => 'Kode promo tidak valid atau sudah kadaluarsa'], 404);
        }

        return response()->json([
            'id' => hid($promo->id),
            'name' => $promo->name,
            'code' => $promo->code,
            'type' => $promo->type,
            'value' => $promo->value,
            'minPurchase' => $promo->min_purchase,
            'maxDiscount' => $promo->max_discount,
        ]);
    }

    /**
     * Process a sale.
     */
    public function store(Request $request)
    {
        $decodedItems = collect($request->items ?? [])->map(function ($i) {
            $i['item_id']   = dhid((string) ($i['item_id'] ?? ''));
            $i['variant_id'] = isset($i['variant_id']) && $i['variant_id'] !== null
                ? dhid((string) $i['variant_id']) : null;
            return $i;
        })->toArray();

        $request->merge([
            'warehouse_id' => dhid((string) ($request->warehouse_id ?? '')),
            'customer_id'  => $request->customer_id ? dhid((string) $request->customer_id) : null,
            'items'        => $decodedItems,
        ]);

        $validator = Validator::make($request->all(), [
            'warehouse_id' => 'required|integer|exists:warehouses,id',
            'customer_id' => 'nullable|integer|exists:customers,id|required_if:payment_method,credit',
            'occurred_at' => 'required|date',
            'payment_method' => 'required_without:payments|in:cash,transfer,qris,card,credit',
            'payment_amount' => 'required_without:payments|integer|min:0',
            'payments' => 'sometimes|array|min:1|max:5',
            'payments.*.method' => 'required_with:payments|in:cash,transfer,qris,card',
            'payments.*.amount' => 'required_with:payments|integer|min:1',
            'credit_schedule' => 'required_if:payment_method,credit|array|min:2',
            'credit_schedule.*.due_date' => 'required_if:payment_method,credit|date',
            'credit_schedule.*.amount_due' => 'required_if:payment_method,credit|integer|min:0',
            'credit_schedule.*.interest_amount' => 'nullable|integer|min:0',
            'credit_interest_rate' => 'nullable|numeric|min:0|max:100',
            'credit_late_fee' => 'nullable|integer|min:0',
            'discount_amount' => 'nullable|integer|min:0',
            'promo_code' => 'nullable|string|max:100',
            'note' => 'nullable|string|max:500',
            'idempotency_key' => 'nullable|string|size:36',
            'items' => 'required|array|min:1',
            'items.*.item_id' => 'required|integer|exists:items,id',
            'items.*.variant_id' => 'nullable|integer|exists:item_variants,id',
            'items.*.variant_name' => 'nullable|string|max:100',
            'items.*.quantity' => 'required|integer|min:1|max:9999',
            'items.*.unit_price' => 'required|integer|min:1',
            'items.*.discount_amount' => 'nullable|integer|min:0',
        ]);

        if ($validator->fails()) {
            return back()->withErrors($validator)->withInput();
        }

        $data = $validator->validated();
        $warehouseId = (int) $data['warehouse_id'];
        $cartItems = $data['items'];
        $discountAmount = (int) ($data['discount_amount'] ?? 0);
        $promoCodeUsed = ! empty($data['promo_code']) ? trim($data['promo_code']) : null;

        // Idempotency: return existing sale if this key was already processed
        if (! empty($data['idempotency_key'])) {
            $existing = SaleHeader::where('idempotency_key', $data['idempotency_key'])->first();
            if ($existing) {
                $result = [
                    'saleNumber' => $existing->sale_number,
                    'grandTotal' => $existing->grand_total,
                    'changeAmount' => $existing->change_amount,
                    'saleId' => hid($existing->id),
                ];
                if ($request->wantsJson()) {
                    return response()->json($result);
                }

                return redirect()->route('pos.show', $result['saleId'])
                    ->with('success', "Penjualan {$result['saleNumber']} sudah diproses sebelumnya.");
            }
        }

        // Block overdue customers from new credit purchases
        if ($data['payment_method'] === 'credit') {
            $creditCustomer = Customer::findOrFail($data['customer_id']);
            if ($creditCustomer->isBlockedForCredit()) {
                return back()->withErrors([
                    'customer_id' => 'Pelanggan ini memiliki cicilan jatuh tempo. Lunasi dulu sebelum mengajukan kredit baru.',
                ])->withInput();
            }
        }

        $result = null;

        try {
            DB::transaction(function () use ($data, $warehouseId, $cartItems, $discountAmount, $promoCodeUsed, &$result) {
                // 1. Validate stock and compute totals
                $subtotal = 0;
                $lineData = [];

                foreach ($cartItems as $ci) {
                    $itemId = (int) $ci['item_id'];
                    $variantId = isset($ci['variant_id']) ? (int) $ci['variant_id'] : null;
                    $variantName = $ci['variant_name'] ?? null;
                    $qty = (int) $ci['quantity'];
                    $price = (int) $ci['unit_price'];
                    $lineDisc = (int) ($ci['discount_amount'] ?? 0);
                    $lineTotal = ($price * $qty) - $lineDisc;

                    $item = Item::lockForUpdate()->findOrFail($itemId);

                    $wi = WarehouseItem::where('warehouse_id', $warehouseId)
                        ->where('item_id', $itemId)
                        ->lockForUpdate()->first();

                    // Auto-create WarehouseItem if missing (e.g. seeder didn't run fully)
                    if (! $wi) {
                        $wi = WarehouseItem::create([
                            'warehouse_id' => $warehouseId,
                            'item_id' => $itemId,
                            'stok' => $item->stok,
                            'stok_minimal' => $item->stok_minimal ?? 0,
                        ]);
                    }

                    $currentStock = $wi->stok;
                    if (($item->type ?? 'barang') === 'barang' && $currentStock < $qty) {
                        throw new \RuntimeException("Stok {$item->nama} tidak cukup. Tersedia: {$currentStock}");
                    }

                    $lineData[] = [
                        'item' => $item,
                        'wi' => $wi,
                        'qty' => $qty,
                        'price' => $price,
                        'lineDisc' => $lineDisc,
                        'lineTotal' => $lineTotal,
                        'variantId' => $variantId,
                        'variantName' => $variantName,
                    ];
                    $subtotal += $lineTotal;
                }

                $grandTotal = max(0, $subtotal - $discountAmount);

                // Determine payment method and amount (split or single)
                $isSplitPayment = !empty($data['payments']);
                if ($isSplitPayment) {
                    $splitPayments = $data['payments'];
                    $splitTotal = (int) array_sum(array_column($splitPayments, 'amount'));
                    if ($splitTotal !== $grandTotal) {
                        throw new \RuntimeException("Total bayar (Rp {$splitTotal}) tidak sesuai dengan total penjualan (Rp {$grandTotal}).");
                    }
                    $paymentMethodStored = count($splitPayments) > 1 ? 'multiple' : $splitPayments[0]['method'];
                    $paymentAmount = $grandTotal;
                    $changeAmount = 0;
                } else {
                    $splitPayments = null;
                    $paymentAmount = (int) $data['payment_amount'];
                    $changeAmount = max(0, $paymentAmount - $grandTotal);
                    $paymentMethodStored = $data['payment_method'];
                }

                // 2. Generate sale number
                $date = now()->format('Ymd');
                $last = SaleHeader::whereDate('occurred_at', now())->count();
                $saleNumber = 'POS-'.$date.'-'.str_pad($last + 1, 4, '0', STR_PAD_LEFT);

                // 3. Create sale header
                $sale = SaleHeader::create([
                    'sale_number' => $saleNumber,
                    'warehouse_id' => $warehouseId,
                    'customer_id' => $data['customer_id'] ?? null,
                    'cashier_id' => Auth::id(),
                    'occurred_at' => $data['occurred_at'],
                    'subtotal' => $subtotal,
                    'discount_amount' => $discountAmount,
                    'tax_amount' => 0,
                    'grand_total' => $grandTotal,
                    'payment_method' => $paymentMethodStored,
                    'payment_amount' => $paymentAmount,
                    'change_amount' => $changeAmount,
                    'status' => 'completed',
                    'note' => $data['note'] ?? null,
                    'idempotency_key' => $data['idempotency_key'] ?? null,
                    'promo_code_used' => $promoCodeUsed ?? null,
                ]);

                // 4. Deduct stock and create sale items
                foreach ($lineData as $ld) {
                    if (($ld['item']->type ?? 'barang') === 'barang' && $ld['wi']) {
                        $ld['wi']->stok -= $ld['qty'];
                        $ld['wi']->save();

                        $ld['item']->decrement('stok', $ld['qty']);
                    }

                    SaleItem::create([
                        'sale_header_id' => $sale->id,
                        'item_id' => $ld['item']->id,
                        'variant_id' => $ld['variantId'] ?? null,
                        'item_name_snapshot' => $ld['item']->nama,
                        'item_code_snapshot' => $ld['item']->kode_item,
                        'variant_name_snapshot' => $ld['variantName'] ?? null,
                        'unit_price' => $ld['price'],
                        'quantity' => $ld['qty'],
                        'cost_price_snapshot' => $ld['item']->harga_beli,
                        'discount_amount' => $ld['lineDisc'],
                        'line_total' => $ld['lineTotal'],
                    ]);
                }

                // 5. Create payment splits if multi-method
                if ($isSplitPayment) {
                    foreach ($splitPayments as $sp) {
                        \App\Models\SalePaymentSplit::create([
                            'sale_header_id' => $sale->id,
                            'payment_method' => $sp['method'],
                            'amount' => (int) $sp['amount'],
                        ]);
                    }
                }

                $result = [
                    'saleNumber' => $saleNumber,
                    'grandTotal' => $grandTotal,
                    'changeAmount' => $changeAmount,
                    'saleId' => hid($sale->id),
                ];

                // 6. For credit sales: create installment plan and payment schedule
                if (isset($data['payment_method']) && $data['payment_method'] === 'credit') {
                    $schedule = $data['credit_schedule'];
                    $interestRate = (float) ($data['credit_interest_rate'] ?? 0);
                    $lateFee = (int) ($data['credit_late_fee'] ?? 0);
                    $dpPaid = (int) $data['payment_amount'];

                    // Validate that schedule totals match grand total
                    $scheduleTotal = (int) array_sum(array_column($schedule, 'amount_due'));
                    if ($scheduleTotal !== $grandTotal) {
                        throw new \RuntimeException("Total jadwal cicilan (Rp {$scheduleTotal}) tidak sesuai dengan total penjualan (Rp {$grandTotal}). Periksa kembali jadwal cicilan.");
                    }

                    // Validate that DP paid matches the first scheduled installment amount
                    $firstDue = (int) $schedule[0]['amount_due'];
                    if ($dpPaid !== $firstDue) {
                        throw new \RuntimeException("Uang muka (Rp {$dpPaid}) harus sama dengan cicilan pertama dalam jadwal (Rp {$firstDue}).");
                    }

                    $plan = InstallmentPlan::create([
                        'sale_header_id' => $sale->id,
                        'customer_id' => $data['customer_id'],
                        'total_amount' => $grandTotal,
                        'paid_amount' => $dpPaid,
                        'installment_count' => count($schedule),
                        'interest_rate' => $interestRate,
                        'late_fee_amount' => $lateFee,
                        'status' => $dpPaid >= $grandTotal ? 'completed' : 'active',
                    ]);

                    foreach ($schedule as $i => $row) {
                        $isFirst = $i === 0;
                        $amountDue = (int) $row['amount_due'];
                        $interestAmt = (int) ($row['interest_amount'] ?? 0);
                        $firstPaid = $isFirst ? $dpPaid : 0;
                        $firstStatus = $isFirst
                            ? ($dpPaid >= $amountDue ? 'paid' : 'partial')
                            : 'pending';

                        InstallmentPayment::create([
                            'installment_plan_id' => $plan->id,
                            'due_date' => $row['due_date'],
                            'amount_due' => $amountDue,
                            'interest_amount' => $interestAmt,
                            'late_fee_applied' => 0,
                            'amount_paid' => $firstPaid,
                            'paid_at' => $isFirst && $dpPaid >= $amountDue ? now() : null,
                            'status' => $firstStatus,
                            'payment_method' => null,
                            'recorded_by' => Auth::id(),
                        ]);
                    }
                }
            });
        } catch (\RuntimeException $e) {
            if ($request->wantsJson()) {
                return response()->json(['message' => $e->getMessage()], 422);
            }

            return back()->withErrors(['items' => $e->getMessage()])->withInput();
        }

        if ($request->wantsJson()) {
            return response()->json($result);
        }

        return redirect()->route('pos.show', $result['saleId'])
            ->with('success', "Penjualan {$result['saleNumber']} berhasil diproses.");
    }

    /**
     * Show sale detail / receipt.
     */
    public function show(SaleHeader $saleHeader)
    {
        $saleHeader->load(['warehouse', 'customer', 'cashier', 'saleItems.item', 'paymentSplits']);

        $saleData = [
            'id' => hid($saleHeader->id),
            'saleNumber' => $saleHeader->sale_number,
            'date' => $saleHeader->occurred_at?->toISOString(),
            'cashier' => $saleHeader->cashier?->name ?? '-',
            'customerName' => $saleHeader->customer?->name ?? 'Walk-in',
            'customerPhone' => $saleHeader->customer?->phone ?? null,
            'warehouseName' => $saleHeader->warehouse?->name ?? '-',
            'warehouseCity' => $saleHeader->warehouse?->city,
            'warehousePhone' => $saleHeader->warehouse?->phone,
            'subtotal' => $saleHeader->subtotal,
            'discountAmount' => $saleHeader->discount_amount,
            'taxAmount' => $saleHeader->tax_amount,
            'grandTotal' => $saleHeader->grand_total,
            'paymentMethod' => $saleHeader->payment_method,
            'paymentAmount' => $saleHeader->payment_amount,
            'changeAmount' => $saleHeader->change_amount,
            'status' => $saleHeader->status,
            'note' => $saleHeader->note,
            'paymentSplits' => $saleHeader->paymentSplits->map(fn ($ps) => [
                'paymentMethod' => $ps->payment_method,
                'amount' => $ps->amount,
            ]),
            'items' => $saleHeader->saleItems->map(fn ($si) => [
                'id' => hid($si->id),
                'itemId' => hid($si->item_id),
                'itemName' => $si->item_name_snapshot,
                'itemCode' => $si->item_code_snapshot,
                'unitPrice' => $si->unit_price,
                'quantity' => $si->quantity,
                'discountAmount' => $si->discount_amount,
                'lineTotal' => $si->line_total,
            ]),
        ];

        return Inertia::render('pos/Show', ['sale' => $saleData]);
    }

    public function print(SaleHeader $saleHeader)
    {
        $saleHeader->load(['warehouse', 'customer', 'cashier', 'saleItems.item', 'paymentSplits']);

        return Inertia::render('pos/Print', [
            'sale' => [
                'id' => hid($saleHeader->id),
                'saleNumber' => $saleHeader->sale_number,
                'date' => $saleHeader->occurred_at?->toISOString(),
                'cashier' => $saleHeader->cashier?->name ?? '-',
                'customerName' => $saleHeader->customer?->name ?? 'Walk-in',
                'customerPhone' => $saleHeader->customer?->phone ?? null,
                'warehouseName' => $saleHeader->warehouse?->name ?? '-',
                'subtotal' => $saleHeader->subtotal,
                'discountAmount' => $saleHeader->discount_amount,
                'taxAmount' => $saleHeader->tax_amount,
                'grandTotal' => $saleHeader->grand_total,
                'paymentMethod' => $saleHeader->payment_method,
                'paymentAmount' => $saleHeader->payment_amount,
                'changeAmount' => $saleHeader->change_amount,
                'status' => $saleHeader->status,
                'note' => $saleHeader->note,
                'paymentSplits' => $saleHeader->paymentSplits->map(fn ($ps) => [
                    'paymentMethod' => $ps->payment_method,
                    'amount' => $ps->amount,
                ]),
                'items' => $saleHeader->saleItems->map(fn ($si) => [
                    'id' => hid($si->id),
                    'itemName' => $si->item_name_snapshot,
                    'itemCode' => $si->item_code_snapshot,
                    'unitPrice' => $si->unit_price,
                    'quantity' => $si->quantity,
                    'discountAmount' => $si->discount_amount,
                    'lineTotal' => $si->line_total,
                ]),
            ],
        ]);
    }

    public function invoice(SaleHeader $saleHeader)
    {
        abort_unless(auth()->user()->hasPermission('pos', 'can_view'), 403);

        $saleHeader->load(['warehouse', 'customer', 'cashier', 'saleItems', 'paymentSplits']);

        if (! $saleHeader->invoice_number) {
            $saleHeader->update([
                'invoice_number' => InvoiceNumber::generate(),
                'invoice_issued_at' => now(),
            ]);
            $saleHeader->refresh();
        }

        $plan = null;
        if ($saleHeader->payment_method === 'credit') {
            $plan = \App\Models\InstallmentPlan::where('sale_header_id', $saleHeader->id)
                ->with('payments')
                ->first();
        }

        return Inertia::render('pos/Invoice', [
            'invoice' => [
                'invoiceNumber' => $saleHeader->invoice_number,
                'issuedAt' => $saleHeader->invoice_issued_at->toISOString(),
                'saleNumber' => $saleHeader->sale_number,
                'date' => $saleHeader->occurred_at?->toISOString(),
                'cashier' => $saleHeader->cashier?->name ?? '-',
                'status' => $saleHeader->status,
                'paymentMethod' => $saleHeader->payment_method,
                'paymentAmount' => $saleHeader->payment_amount,
                'changeAmount' => $saleHeader->change_amount,
                'note' => $saleHeader->note,
                'paymentSplits' => $saleHeader->paymentSplits->map(fn ($ps) => [
                    'paymentMethod' => $ps->payment_method,
                    'amount' => $ps->amount,
                ]),
                'customer' => [
                    'name' => $saleHeader->customer?->name ?? 'Walk-in',
                    'phone' => $saleHeader->customer?->phone,
                    'address' => $saleHeader->customer?->address,
                ],
                'warehouse' => [
                    'name' => $saleHeader->warehouse?->name,
                    'address' => $saleHeader->warehouse?->location,
                    'phone' => $saleHeader->warehouse?->phone,
                ],
                'subtotal' => $saleHeader->subtotal,
                'discountAmount' => $saleHeader->discount_amount,
                'taxAmount' => $saleHeader->tax_amount,
                'grandTotal' => $saleHeader->grand_total,
                'items' => $saleHeader->saleItems->map(fn ($si) => [
                    'name' => $si->item_name_snapshot,
                    'code' => $si->item_code_snapshot,
                    'unitPrice' => $si->unit_price,
                    'quantity' => $si->quantity,
                    'discountAmount' => $si->discount_amount,
                    'lineTotal' => $si->line_total,
                ]),
                'schedule' => $plan ? $plan->payments->map(fn ($p) => [
                    'dueDate' => $p->due_date->toDateString(),
                    'amountDue' => $p->amount_due,
                    'interestAmount' => $p->interest_amount,
                    'lateFeeApplied' => $p->late_fee_applied,
                    'totalDue' => $p->totalDue(),
                    'status' => $p->status,
                ]) : null,
            ],
        ]);
    }

    public function invoicePdf(SaleHeader $saleHeader)
    {
        abort_unless(auth()->user()->hasPermission('pos', 'can_view'), 403);

        $saleHeader->load(['warehouse', 'customer', 'cashier', 'saleItems', 'paymentSplits']);

        if (! $saleHeader->invoice_number) {
            $saleHeader->update([
                'invoice_number'    => InvoiceNumber::generate(),
                'invoice_issued_at' => now(),
            ]);
            $saleHeader->refresh();
        }

        $plan = null;
        if ($saleHeader->payment_method === 'credit') {
            $plan = \App\Models\InstallmentPlan::where('sale_header_id', $saleHeader->id)
                ->with('payments')
                ->first();
        }

        $invoice = [
            'invoiceNumber'  => $saleHeader->invoice_number,
            'issuedAt'       => $saleHeader->invoice_issued_at->toISOString(),
            'saleNumber'     => $saleHeader->sale_number,
            'date'           => $saleHeader->occurred_at?->toISOString(),
            'cashier'        => $saleHeader->cashier?->name ?? '-',
            'status'         => $saleHeader->status,
            'paymentMethod'  => $saleHeader->payment_method,
            'paymentAmount'  => $saleHeader->payment_amount,
            'changeAmount'   => $saleHeader->change_amount,
            'note'           => $saleHeader->note,
            'paymentSplits'  => $saleHeader->paymentSplits->map(fn ($ps) => [
                'paymentMethod' => $ps->payment_method,
                'amount'        => $ps->amount,
            ])->toArray(),
            'customer'       => [
                'name'    => $saleHeader->customer?->name ?? 'Walk-in',
                'phone'   => $saleHeader->customer?->phone,
                'address' => $saleHeader->customer?->address,
            ],
            'warehouse'      => [
                'name'    => $saleHeader->warehouse?->name,
                'address' => $saleHeader->warehouse?->location,
                'phone'   => $saleHeader->warehouse?->phone,
            ],
            'subtotal'       => $saleHeader->subtotal,
            'discountAmount' => $saleHeader->discount_amount,
            'taxAmount'      => $saleHeader->tax_amount,
            'grandTotal'     => $saleHeader->grand_total,
            'items'          => $saleHeader->saleItems->map(fn ($si) => [
                'name'           => $si->item_name_snapshot,
                'code'           => $si->item_code_snapshot,
                'unitPrice'      => $si->unit_price,
                'quantity'       => $si->quantity,
                'discountAmount' => $si->discount_amount,
                'lineTotal'      => $si->line_total,
            ])->toArray(),
            'schedule'       => $plan ? $plan->payments->map(fn ($p) => [
                'dueDate'        => $p->due_date->toDateString(),
                'amountDue'      => $p->amount_due,
                'interestAmount' => $p->interest_amount,
                'lateFeeApplied' => $p->late_fee_applied,
                'totalDue'       => $p->totalDue(),
                'status'         => $p->status,
            ])->toArray() : null,
        ];

        $pdf = Pdf::loadView('invoices.sale', [
            'invoice'       => $invoice,
            'storeSettings' => AppSetting::allAsArray(),
        ])->setPaper('a4');

        return response()->streamDownload(
            fn () => print($pdf->output()),
            $saleHeader->invoice_number . '.pdf',
            ['Content-Type' => 'application/pdf']
        );
    }

    /**
     * Void a completed sale (reverse stock).
     */
    public function void(SaleHeader $saleHeader)
    {
        // Void is destructive — requires can_delete regardless of HTTP method
        abort_unless(auth()->user()->hasPermission('pos', 'can_delete'), 403);

        if ($saleHeader->status === 'void') {
            return back()->withErrors(['status' => 'Penjualan ini sudah di-void.']);
        }

        // Block void if credit sale has an active installment plan
        if ($saleHeader->payment_method === 'credit') {
            $activePlan = \App\Models\InstallmentPlan::where('sale_header_id', $saleHeader->id)
                ->whereIn('status', ['active', 'overdue'])
                ->exists();
            if ($activePlan) {
                return back()->withErrors(['status' => 'Tidak bisa di-void: penjualan kredit ini masih memiliki cicilan yang belum lunas.']);
            }
        }

        $saleHeader->load(['saleItems']);

        DB::transaction(function () use ($saleHeader) {
            $saleItems = $saleHeader->saleItems->filter(fn ($si) => $si->item_id);

            if ($saleItems->isNotEmpty()) {
                $itemIds = $saleItems->pluck('item_id')->unique();

                // Batch-lock all items and warehouse items in two queries instead of N×3
                $items = Item::lockForUpdate()->whereIn('id', $itemIds)->get()->keyBy('id');
                $warehouseItems = WarehouseItem::where('warehouse_id', $saleHeader->warehouse_id)
                    ->whereIn('item_id', $itemIds)
                    ->lockForUpdate()
                    ->get()
                    ->keyBy('item_id');

                foreach ($saleItems as $si) {
                    $item = $items->get($si->item_id);
                    if (! $item) {
                        continue;
                    }

                    $wi = $warehouseItems->get($si->item_id);
                    if ($wi) {
                        $wi->stok += $si->quantity;
                        $wi->save();
                    } else {
                        WarehouseItem::create([
                            'warehouse_id' => $saleHeader->warehouse_id,
                            'item_id' => $si->item_id,
                            'stok' => $si->quantity,
                            'stok_minimal' => 0,
                        ]);
                    }

                    // Atomic increment — avoids a separate SUM() query per item
                    $item->increment('stok', $si->quantity);
                }
            }

            $saleHeader->status = 'void';
            $saleHeader->save();
        });

        return redirect()->route('pos.index')->with('success', "Penjualan {$saleHeader->sale_number} berhasil di-void.");
    }
}
