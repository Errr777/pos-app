<?php

namespace App\Http\Controllers;

use App\Models\Customer;
use App\Models\Item;
use App\Models\SaleHeader;
use App\Models\SaleItem;
use App\Models\Warehouse;
use App\Models\WarehouseItem;
use App\Traits\FiltersWarehouseByUser;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Inertia\Inertia;

class PosController extends Controller
{
    use FiltersWarehouseByUser;
    /**
     * Sale history (index).
     */
    public function index(Request $request)
    {
        $perPage = in_array((int) $request->get('per_page', 20), [10, 20, 50, 100])
            ? (int) $request->get('per_page', 20) : 20;
        $search     = trim((string) $request->get('search', ''));
        $dateFrom   = $request->get('date_from');
        $dateTo     = $request->get('date_to');
        $payMethod  = $request->get('payment_method', '');
        $status     = $request->get('status', '');
        $sortDir    = strtolower($request->get('sort_dir', 'desc')) === 'asc' ? 'asc' : 'desc';

        $allowedSort = [
            'date'          => 'sale_headers.occurred_at',
            'saleNumber'    => 'sale_headers.sale_number',
            'grandTotal'    => 'sale_headers.grand_total',
            'paymentMethod' => 'sale_headers.payment_method',
            'cashier'       => 'users.name',
            'customer'      => 'customers.name',
        ];
        $sortKey    = $request->get('sort_by', 'date');
        $sortColumn = $allowedSort[$sortKey] ?? 'sale_headers.occurred_at';

        $query = SaleHeader::with(['warehouse', 'customer', 'cashier', 'saleItems'])
            ->leftJoin('users',     'sale_headers.cashier_id',  '=', 'users.id')
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
        if ($dateFrom)  $query->where('sale_headers.occurred_at', '>=', $dateFrom . ' 00:00:00');
        if ($dateTo)    $query->where('sale_headers.occurred_at', '<=', $dateTo   . ' 23:59:59');
        if ($payMethod) $query->where('sale_headers.payment_method', $payMethod);
        if ($status)    $query->where('sale_headers.status', $status);

        $ids = $this->allowedWarehouseIds();
        if (!empty($ids)) {
            $query->whereIn('sale_headers.warehouse_id', $ids);
        }

        $query->orderBy($sortColumn, $sortDir);

        $sales = $query->paginate($perPage)->withQueryString()->through(fn ($s) => [
            'id'            => $s->id,
            'saleNumber'    => $s->sale_number,
            'date'          => $s->occurred_at?->toISOString(),
            'cashier'       => $s->cashier?->name ?? '-',
            'customerName'  => $s->customer?->name ?? 'Walk-in',
            'warehouseName' => $s->warehouse?->name ?? '-',
            'subtotal'      => $s->subtotal,
            'discountAmount'=> $s->discount_amount,
            'grandTotal'    => $s->grand_total,
            'paymentMethod' => $s->payment_method,
            'paymentAmount' => $s->payment_amount,
            'changeAmount'  => $s->change_amount,
            'status'        => $s->status,
            'note'          => $s->note,
            'itemCount'     => $s->saleItems->count(),
        ]);

        return Inertia::render('pos/Index', [
            'sales'   => $sales,
            'filters' => array_merge(
                $request->only(['search', 'date_from', 'date_to', 'payment_method', 'status', 'per_page']),
                ['sort_by' => $sortKey, 'sort_dir' => $sortDir]
            ),
        ]);
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
                'id'      => $w->id,
                'name'    => $w->name,
                'code'    => $w->code,
                'isDefault' => (bool) $w->is_default,
            ]);

        $items = Item::select('id', 'nama', 'kode_item', 'kategori', 'id_kategori', 'stok', 'harga_jual')
            ->orderBy('nama')->get()->map(fn ($i) => [
                'id'         => $i->id,
                'name'       => $i->nama,
                'code'       => $i->kode_item,
                'category'   => $i->kategori,
                'categoryId' => $i->id_kategori,
                'stock'      => $i->stok,
                'price'      => $i->harga_jual,
            ]);

        $customers = Customer::where('is_active', true)
            ->orderBy('name')
            ->get()->map(fn ($c) => ['id' => $c->id, 'name' => $c->name, 'code' => $c->code]);

        $promotions = \App\Models\Promotion::active()
            ->get()
            ->map(fn ($p) => [
                'id'          => $p->id,
                'name'        => $p->name,
                'type'        => $p->type,
                'value'       => $p->value,
                'appliesTo'   => $p->applies_to,
                'appliesId'   => $p->applies_id,
                'minPurchase' => $p->min_purchase,
                'maxDiscount' => $p->max_discount,
            ]);

        return Inertia::render('pos/Terminal', [
            'warehouses' => $warehouses,
            'items'      => $items,
            'customers'  => $customers,
            'promotions' => $promotions,
        ]);
    }

    /**
     * Process a sale.
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'warehouse_id'          => 'required|integer|exists:warehouses,id',
            'customer_id'           => 'nullable|integer|exists:customers,id',
            'occurred_at'           => 'required|date',
            'payment_method'        => 'required|in:cash,transfer,qris,card',
            'payment_amount'        => 'required|integer|min:0',
            'discount_amount'       => 'nullable|integer|min:0',
            'note'                  => 'nullable|string|max:500',
            'items'                 => 'required|array|min:1',
            'items.*.item_id'       => 'required|integer|exists:items,id',
            'items.*.quantity'      => 'required|integer|min:1|max:9999',
            'items.*.unit_price'    => 'required|integer|min:0',
            'items.*.discount_amount' => 'nullable|integer|min:0',
        ]);

        if ($validator->fails()) {
            return back()->withErrors($validator)->withInput();
        }

        $data        = $validator->validated();
        $warehouseId = (int) $data['warehouse_id'];
        $cartItems   = $data['items'];
        $discountAmount = (int) ($data['discount_amount'] ?? 0);

        $result = null;

        DB::transaction(function () use ($data, $warehouseId, $cartItems, $discountAmount, &$result) {
            // 1. Validate stock and compute totals
            $subtotal = 0;
            $lineData = [];

            foreach ($cartItems as $ci) {
                $itemId  = (int) $ci['item_id'];
                $qty     = (int) $ci['quantity'];
                $price   = (int) $ci['unit_price'];
                $lineDisc= (int) ($ci['discount_amount'] ?? 0);
                $lineTotal = ($price * $qty) - $lineDisc;

                $item = Item::lockForUpdate()->findOrFail($itemId);

                $wi = WarehouseItem::where('warehouse_id', $warehouseId)
                    ->where('item_id', $itemId)
                    ->lockForUpdate()->first();

                $currentStock = $wi ? $wi->stok : 0;
                if ($currentStock < $qty) {
                    throw new \RuntimeException("Stok {$item->nama} tidak cukup. Tersedia: {$currentStock}");
                }

                $lineData[] = [
                    'item'      => $item,
                    'wi'        => $wi,
                    'qty'       => $qty,
                    'price'     => $price,
                    'lineDisc'  => $lineDisc,
                    'lineTotal' => $lineTotal,
                ];
                $subtotal += $lineTotal;
            }

            $grandTotal    = max(0, $subtotal - $discountAmount);
            $paymentAmount = (int) $data['payment_amount'];
            $changeAmount  = max(0, $paymentAmount - $grandTotal);

            // 2. Generate sale number
            $date       = now()->format('Ymd');
            $last       = SaleHeader::whereDate('occurred_at', now())->count();
            $saleNumber = 'POS-' . $date . '-' . str_pad($last + 1, 4, '0', STR_PAD_LEFT);

            // 3. Create sale header
            $sale = SaleHeader::create([
                'sale_number'    => $saleNumber,
                'warehouse_id'   => $warehouseId,
                'customer_id'    => $data['customer_id'] ?? null,
                'cashier_id'     => Auth::id(),
                'occurred_at'    => $data['occurred_at'],
                'subtotal'       => $subtotal,
                'discount_amount'=> $discountAmount,
                'tax_amount'     => 0,
                'grand_total'    => $grandTotal,
                'payment_method' => $data['payment_method'],
                'payment_amount' => $paymentAmount,
                'change_amount'  => $changeAmount,
                'status'         => 'completed',
                'note'           => $data['note'] ?? null,
            ]);

            // 4. Deduct stock and create sale items
            foreach ($lineData as $ld) {
                $ld['wi']->stok -= $ld['qty'];
                $ld['wi']->save();

                $ld['item']->stok = (int) WarehouseItem::where('item_id', $ld['item']->id)->sum('stok');
                $ld['item']->save();

                SaleItem::create([
                    'sale_header_id'     => $sale->id,
                    'item_id'            => $ld['item']->id,
                    'item_name_snapshot' => $ld['item']->nama,
                    'item_code_snapshot' => $ld['item']->kode_item,
                    'unit_price'         => $ld['price'],
                    'quantity'           => $ld['qty'],
                    'discount_amount'    => $ld['lineDisc'],
                    'line_total'         => $ld['lineTotal'],
                ]);
            }

            $result = [
                'saleNumber'   => $saleNumber,
                'grandTotal'   => $grandTotal,
                'changeAmount' => $changeAmount,
                'saleId'       => $sale->id,
            ];
        });

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
        $saleHeader->load(['warehouse', 'customer', 'cashier', 'saleItems.item']);

        $saleData = [
            'id'            => $saleHeader->id,
            'saleNumber'    => $saleHeader->sale_number,
            'date'          => $saleHeader->occurred_at?->toISOString(),
            'cashier'       => $saleHeader->cashier?->name ?? '-',
            'customerName'  => $saleHeader->customer?->name ?? 'Walk-in',
            'customerPhone' => $saleHeader->customer?->phone ?? null,
            'warehouseName' => $saleHeader->warehouse?->name ?? '-',
            'subtotal'      => $saleHeader->subtotal,
            'discountAmount'=> $saleHeader->discount_amount,
            'taxAmount'     => $saleHeader->tax_amount,
            'grandTotal'    => $saleHeader->grand_total,
            'paymentMethod' => $saleHeader->payment_method,
            'paymentAmount' => $saleHeader->payment_amount,
            'changeAmount'  => $saleHeader->change_amount,
            'status'        => $saleHeader->status,
            'note'          => $saleHeader->note,
            'items'         => $saleHeader->saleItems->map(fn ($si) => [
                'id'             => $si->id,
                'itemId'         => $si->item_id,
                'itemName'       => $si->item_name_snapshot,
                'itemCode'       => $si->item_code_snapshot,
                'unitPrice'      => $si->unit_price,
                'quantity'       => $si->quantity,
                'discountAmount' => $si->discount_amount,
                'lineTotal'      => $si->line_total,
            ]),
        ];

        return Inertia::render('pos/Show', ['sale' => $saleData]);
    }

    /**
     * Void a completed sale (reverse stock).
     */
    public function void(SaleHeader $saleHeader)
    {
        if ($saleHeader->status === 'void') {
            return back()->withErrors(['status' => 'Penjualan ini sudah di-void.']);
        }

        $saleHeader->load(['saleItems']);

        DB::transaction(function () use ($saleHeader) {
            foreach ($saleHeader->saleItems as $si) {
                if (!$si->item_id) continue;

                $item = Item::lockForUpdate()->find($si->item_id);
                if (!$item) continue;

                $wi = WarehouseItem::where('warehouse_id', $saleHeader->warehouse_id)
                    ->where('item_id', $si->item_id)
                    ->lockForUpdate()->first();

                if ($wi) {
                    $wi->stok += $si->quantity;
                    $wi->save();
                } else {
                    WarehouseItem::create([
                        'warehouse_id' => $saleHeader->warehouse_id,
                        'item_id'      => $si->item_id,
                        'stok'         => $si->quantity,
                        'stok_minimal' => 0,
                    ]);
                }

                $item->stok = (int) WarehouseItem::where('item_id', $item->id)->sum('stok');
                $item->save();
            }

            $saleHeader->status = 'void';
            $saleHeader->save();
        });

        return redirect()->route('pos.index')->with('success', "Penjualan {$saleHeader->sale_number} berhasil di-void.");
    }
}
