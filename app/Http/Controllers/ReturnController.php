<?php

namespace App\Http\Controllers;

use App\Models\Customer;
use App\Models\Item;
use App\Models\ReturnHeader;
use App\Models\ReturnItem;
use App\Models\Supplier;
use App\Models\Warehouse;
use App\Models\WarehouseItem;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Inertia\Inertia;

class ReturnController extends Controller
{
    public function index(Request $request)
    {
        $perPage  = in_array((int) $request->get('per_page', 20), [10, 20, 50, 100])
            ? (int) $request->get('per_page', 20) : 20;
        $search   = trim((string) $request->get('search', ''));
        $type     = $request->get('type', '');
        $status   = $request->get('status', '');
        $dateFrom = $request->get('date_from');
        $dateTo   = $request->get('date_to');
        $sortDir  = strtolower($request->get('sort_dir', 'desc')) === 'asc' ? 'asc' : 'desc';

        $allowedSort = [
            'date'         => 'return_headers.occurred_at',
            'returnNumber' => 'return_headers.return_number',
            'totalAmount'  => 'return_headers.total_amount',
            'type'         => 'return_headers.type',
            'status'       => 'return_headers.status',
        ];
        $sortKey    = $request->get('sort_by', 'date');
        $sortColumn = $allowedSort[$sortKey] ?? 'return_headers.occurred_at';

        $query = ReturnHeader::with(['customer', 'supplier', 'warehouse', 'processedBy', 'returnItems'])
            ->leftJoin('customers', 'return_headers.customer_id', '=', 'customers.id')
            ->leftJoin('suppliers', 'return_headers.supplier_id', '=', 'suppliers.id')
            ->select('return_headers.*');

        if ($search !== '') {
            $term = strtolower($search);
            $query->where(function ($q) use ($term) {
                $q->whereRaw('LOWER(return_headers.return_number) like ?', ["%{$term}%"])
                  ->orWhereRaw('LOWER(customers.name) like ?', ["%{$term}%"])
                  ->orWhereRaw('LOWER(suppliers.name) like ?', ["%{$term}%"]);
            });
        }

        if ($type)     $query->where('return_headers.type', $type);
        if ($status)   $query->where('return_headers.status', $status);
        if ($dateFrom) $query->where('return_headers.occurred_at', '>=', $dateFrom . ' 00:00:00');
        if ($dateTo)   $query->where('return_headers.occurred_at', '<=', $dateTo   . ' 23:59:59');

        $query->orderBy($sortColumn, $sortDir);

        $returns = $query->paginate($perPage)->withQueryString()->through(fn ($r) => [
            'id'           => $r->id,
            'returnNumber' => $r->return_number,
            'type'         => $r->type,
            'partyName'    => $r->type === 'customer_return'
                ? ($r->customer?->name ?? 'Walk-in')
                : ($r->supplier?->name ?? '-'),
            'warehouseName'=> $r->warehouse?->name ?? '-',
            'processedBy'  => $r->processedBy?->name ?? '-',
            'occurredAt'   => $r->occurred_at?->toISOString(),
            'status'       => $r->status,
            'totalAmount'  => $r->total_amount,
            'reason'       => $r->reason,
            'itemCount'    => $r->returnItems->count(),
        ]);

        $warehouses = Warehouse::where('is_active', true)->orderBy('name')
            ->get()->map(fn ($w) => ['id' => $w->id, 'name' => $w->name]);

        $customers = Customer::where('is_active', true)->orderBy('name')
            ->get()->map(fn ($c) => ['id' => $c->id, 'name' => $c->name]);

        $suppliers = Supplier::where('is_active', true)->orderBy('name')
            ->get()->map(fn ($s) => ['id' => $s->id, 'name' => $s->name]);

        $items = Item::orderBy('nama')->get()->map(fn ($i) => [
            'id'    => $i->id,
            'name'  => $i->nama,
            'code'  => $i->kode_item,
            'price' => $i->harga_jual,
        ]);

        return Inertia::render('returns/Index', [
            'returns'    => $returns,
            'warehouses' => $warehouses,
            'customers'  => $customers,
            'suppliers'  => $suppliers,
            'items'      => $items,
            'filters'    => array_merge(
                $request->only(['search', 'type', 'status', 'date_from', 'date_to', 'per_page']),
                ['sort_by' => $sortKey, 'sort_dir' => $sortDir]
            ),
        ]);
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'type'                => 'required|in:customer_return,supplier_return',
            'warehouse_id'        => 'required|integer|exists:warehouses,id',
            'customer_id'         => 'nullable|integer|exists:customers,id',
            'supplier_id'         => 'nullable|integer|exists:suppliers,id',
            'occurred_at'         => 'required|date',
            'reason'              => 'nullable|string|max:255',
            'note'                => 'nullable|string|max:1000',
            'items'               => 'required|array|min:1',
            'items.*.item_id'     => 'required|integer|exists:items,id',
            'items.*.quantity'    => 'required|integer|min:1',
            'items.*.unit_price'  => 'required|integer|min:0',
            'items.*.condition'   => 'nullable|in:good,damaged,defective',
        ]);

        if ($validator->fails()) {
            return back()->withErrors($validator)->withInput();
        }

        $data        = $validator->validated();
        $warehouseId = (int) $data['warehouse_id'];
        $isCustomer  = $data['type'] === 'customer_return';
        $cartItems   = $data['items'];
        $result      = null;

        DB::transaction(function () use ($data, $warehouseId, $isCustomer, $cartItems, &$result) {
            $totalAmount = 0;
            $lineData    = [];

            foreach ($cartItems as $ci) {
                $itemId    = (int) $ci['item_id'];
                $qty       = (int) $ci['quantity'];
                $price     = (int) $ci['unit_price'];
                $lineTotal = $price * $qty;

                $item = Item::lockForUpdate()->findOrFail($itemId);

                $wi = WarehouseItem::where('warehouse_id', $warehouseId)
                    ->where('item_id', $itemId)
                    ->lockForUpdate()->first();

                // Supplier return: check sufficient stock to send back
                if (!$isCustomer) {
                    $currentStock = $wi ? $wi->stok : 0;
                    if ($currentStock < $qty) {
                        throw new \RuntimeException("Stok {$item->nama} tidak cukup untuk diretur. Tersedia: {$currentStock}");
                    }
                }

                $lineData[] = [
                    'item'      => $item,
                    'wi'        => $wi,
                    'qty'       => $qty,
                    'price'     => $price,
                    'lineTotal' => $lineTotal,
                    'condition' => $ci['condition'] ?? 'good',
                ];
                $totalAmount += $lineTotal;
            }

            $date         = now()->format('Ymd');
            $last         = ReturnHeader::whereDate('occurred_at', now())->count();
            $returnNumber = 'RET-' . $date . '-' . str_pad($last + 1, 4, '0', STR_PAD_LEFT);

            $header = ReturnHeader::create([
                'return_number' => $returnNumber,
                'type'          => $data['type'],
                'customer_id'   => $data['customer_id'] ?? null,
                'supplier_id'   => $data['supplier_id'] ?? null,
                'warehouse_id'  => $warehouseId,
                'processed_by'  => Auth::id(),
                'occurred_at'   => $data['occurred_at'],
                'status'        => 'completed',
                'total_amount'  => $totalAmount,
                'reason'        => $data['reason'] ?? null,
                'note'          => $data['note'] ?? null,
            ]);

            foreach ($lineData as $ld) {
                ReturnItem::create([
                    'return_header_id'   => $header->id,
                    'item_id'            => $ld['item']->id,
                    'item_name_snapshot' => $ld['item']->nama,
                    'quantity'           => $ld['qty'],
                    'unit_price'         => $ld['price'],
                    'line_total'         => $ld['lineTotal'],
                    'condition'          => $ld['condition'],
                ]);

                if ($isCustomer) {
                    // Customer return: items come back into warehouse
                    if ($ld['wi']) {
                        $ld['wi']->stok += $ld['qty'];
                        $ld['wi']->save();
                    } else {
                        WarehouseItem::create([
                            'warehouse_id' => $warehouseId,
                            'item_id'      => $ld['item']->id,
                            'stok'         => $ld['qty'],
                            'stok_minimal' => 0,
                        ]);
                    }
                } else {
                    // Supplier return: items go out of warehouse
                    $ld['wi']->stok -= $ld['qty'];
                    $ld['wi']->save();
                }

                // Sync aggregate stock on Item
                $ld['item']->stok = (int) WarehouseItem::where('item_id', $ld['item']->id)->sum('stok');
                $ld['item']->save();
            }

            $result = ['returnNumber' => $returnNumber, 'returnId' => $header->id];
        });

        if ($request->wantsJson()) {
            return response()->json($result);
        }

        return redirect()->route('returns.show', $result['returnId'])
            ->with('success', "Retur {$result['returnNumber']} berhasil diproses.");
    }

    public function show(ReturnHeader $returnHeader)
    {
        $returnHeader->load(['customer', 'supplier', 'warehouse', 'processedBy', 'returnItems.item']);

        return Inertia::render('returns/Show', [
            'returnData' => [
                'id'            => $returnHeader->id,
                'returnNumber'  => $returnHeader->return_number,
                'type'          => $returnHeader->type,
                'customerName'  => $returnHeader->customer?->name,
                'supplierName'  => $returnHeader->supplier?->name,
                'warehouseName' => $returnHeader->warehouse?->name ?? '-',
                'processedBy'   => $returnHeader->processedBy?->name ?? '-',
                'occurredAt'    => $returnHeader->occurred_at?->toISOString(),
                'status'        => $returnHeader->status,
                'totalAmount'   => $returnHeader->total_amount,
                'reason'        => $returnHeader->reason,
                'note'          => $returnHeader->note,
                'items'         => $returnHeader->returnItems->map(fn ($ri) => [
                    'id'        => $ri->id,
                    'itemId'    => $ri->item_id,
                    'itemName'  => $ri->item_name_snapshot,
                    'quantity'  => $ri->quantity,
                    'unitPrice' => $ri->unit_price,
                    'lineTotal' => $ri->line_total,
                    'condition' => $ri->condition,
                ]),
            ],
        ]);
    }

    public function void(ReturnHeader $returnHeader)
    {
        if ($returnHeader->status === 'void') {
            return back()->withErrors(['status' => 'Retur ini sudah di-void.']);
        }

        $returnHeader->load(['returnItems']);
        $isCustomer = $returnHeader->type === 'customer_return';

        DB::transaction(function () use ($returnHeader, $isCustomer) {
            foreach ($returnHeader->returnItems as $ri) {
                if (!$ri->item_id) continue;

                $item = Item::lockForUpdate()->find($ri->item_id);
                if (!$item) continue;

                $wi = WarehouseItem::where('warehouse_id', $returnHeader->warehouse_id)
                    ->where('item_id', $ri->item_id)
                    ->lockForUpdate()->first();

                if ($isCustomer) {
                    // Reverse customer return: items go back out
                    if ($wi) {
                        $wi->stok = max(0, $wi->stok - $ri->quantity);
                        $wi->save();
                    }
                } else {
                    // Reverse supplier return: items come back in
                    if ($wi) {
                        $wi->stok += $ri->quantity;
                        $wi->save();
                    } else {
                        WarehouseItem::create([
                            'warehouse_id' => $returnHeader->warehouse_id,
                            'item_id'      => $ri->item_id,
                            'stok'         => $ri->quantity,
                            'stok_minimal' => 0,
                        ]);
                    }
                }

                $item->stok = (int) WarehouseItem::where('item_id', $item->id)->sum('stok');
                $item->save();
            }

            $returnHeader->status = 'void';
            $returnHeader->save();
        });

        return redirect()->route('returns.index')
            ->with('success', "Retur {$returnHeader->return_number} berhasil di-void.");
    }
}
