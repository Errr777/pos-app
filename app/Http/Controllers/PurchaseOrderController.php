<?php

namespace App\Http\Controllers;

use App\Helpers\AuditLogger;
use App\Models\Item;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderItem;
use App\Models\Supplier;
use App\Models\Warehouse;
use App\Models\WarehouseItem;
use App\Traits\FiltersWarehouseByUser;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Inertia\Inertia;

class PurchaseOrderController extends Controller
{
    use FiltersWarehouseByUser;
    public function index(Request $request)
    {
        $perPage = in_array((int) $request->get('per_page', 20), [10, 20, 50, 100])
            ? (int) $request->get('per_page', 20) : 20;
        $search   = trim((string) $request->get('search', ''));
        $status   = $request->get('status', '');
        $dateFrom = $request->get('date_from');
        $dateTo   = $request->get('date_to');
        $sortDir  = strtolower($request->get('sort_dir', 'desc')) === 'asc' ? 'asc' : 'desc';

        $allowedSort = [
            'date'         => 'purchase_orders.created_at',
            'poNumber'     => 'purchase_orders.po_number',
            'supplierName' => 'suppliers.name',
            'grandTotal'   => 'purchase_orders.grand_total',
            'status'       => 'purchase_orders.status',
        ];
        $sortKey    = $request->get('sort_by', 'date');
        $sortColumn = $allowedSort[$sortKey] ?? 'purchase_orders.created_at';

        $query = PurchaseOrder::with(['supplier', 'warehouse', 'orderedBy', 'items'])
            ->leftJoin('suppliers', 'purchase_orders.supplier_id', '=', 'suppliers.id')
            ->select('purchase_orders.*');

        if ($search !== '') {
            $term = strtolower($search);
            $query->where(function ($q) use ($term) {
                $q->whereRaw('LOWER(purchase_orders.po_number) like ?', ["%{$term}%"])
                  ->orWhereRaw('LOWER(suppliers.name) like ?', ["%{$term}%"]);
            });
        }
        if ($status)   $query->where('purchase_orders.status', $status);
        if ($dateFrom) $query->where('purchase_orders.created_at', '>=', $dateFrom . ' 00:00:00');
        if ($dateTo)   $query->where('purchase_orders.created_at', '<=', $dateTo   . ' 23:59:59');

        $this->applyWarehouseFilter($query, 'purchase_orders.warehouse_id');

        $query->orderBy($sortColumn, $sortDir);

        $pos = $query->paginate($perPage)->withQueryString()->through(fn ($po) => [
            'id'           => $po->id,
            'poNumber'     => $po->po_number,
            'supplierName' => $po->supplier?->name ?? '-',
            'warehouseName'=> $po->warehouse?->name ?? '-',
            'orderedBy'    => $po->orderedBy?->name ?? '-',
            'status'       => $po->status,
            'orderedAt'    => $po->ordered_at?->toISOString(),
            'expectedAt'   => $po->expected_at?->toDateString(),
            'receivedAt'   => $po->received_at?->toISOString(),
            'grandTotal'   => $po->grand_total,
            'itemCount'    => $po->items->count(),
            'note'         => $po->note,
        ]);

        $suppliers  = Supplier::where('is_active', true)->orderBy('name')
            ->get()->map(fn ($s) => ['id' => $s->id, 'name' => $s->name]);
        $warehouseQuery = Warehouse::where('is_active', true)->orderBy('is_default', 'desc')->orderBy('name');
        $this->applyWarehouseFilter($warehouseQuery, 'id');
        $warehouses = $warehouseQuery->get()->map(fn ($w) => ['id' => $w->id, 'name' => $w->name]);
        $items = Item::select('id', 'nama', 'kode_item', 'harga_beli')->orderBy('nama')
            ->get()->map(fn ($i) => ['id' => $i->id, 'name' => $i->nama, 'code' => $i->kode_item, 'costPrice' => $i->harga_beli]);

        return Inertia::render('purchase-orders/Index', [
            'pos'        => $pos,
            'suppliers'  => $suppliers,
            'warehouses' => $warehouses,
            'items'      => $items,
            'filters'    => array_merge(
                $request->only(['search', 'status', 'date_from', 'date_to', 'per_page']),
                ['sort_by' => $sortKey, 'sort_dir' => $sortDir]
            ),
        ]);
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'supplier_id'            => 'nullable|integer|exists:suppliers,id',
            'warehouse_id'           => 'required|integer|exists:warehouses,id',
            'expected_at'            => 'nullable|date',
            'note'                   => 'nullable|string|max:1000',
            'items'                  => 'required|array|min:1',
            'items.*.item_id'        => 'required|integer|exists:items,id',
            'items.*.ordered_qty'    => 'required|integer|min:1',
            'items.*.unit_price'     => 'required|integer|min:0',
        ]);

        if ($validator->fails()) {
            return back()->withErrors($validator)->withInput();
        }

        $data = $validator->validated();

        $subtotal = array_sum(array_map(fn ($i) => $i['ordered_qty'] * $i['unit_price'], $data['items']));

        $date     = now()->format('Ymd');
        $last     = PurchaseOrder::whereDate('created_at', now())->count();
        $poNumber = 'PO-' . $date . '-' . str_pad($last + 1, 4, '0', STR_PAD_LEFT);

        DB::transaction(function () use ($data, $subtotal, $poNumber) {
            $po = PurchaseOrder::create([
                'po_number'    => $poNumber,
                'supplier_id'  => $data['supplier_id'] ?? null,
                'warehouse_id' => $data['warehouse_id'],
                'ordered_by'   => Auth::id(),
                'status'       => 'draft',
                'expected_at'  => $data['expected_at'] ?? null,
                'subtotal'     => $subtotal,
                'grand_total'  => $subtotal,
                'note'         => $data['note'] ?? null,
            ]);

            foreach ($data['items'] as $ci) {
                $item = Item::find($ci['item_id']);
                PurchaseOrderItem::create([
                    'purchase_order_id'  => $po->id,
                    'item_id'            => $ci['item_id'],
                    'item_name_snapshot' => $item?->nama ?? 'Unknown',
                    'ordered_qty'        => $ci['ordered_qty'],
                    'unit_price'         => $ci['unit_price'],
                    'line_total'         => $ci['ordered_qty'] * $ci['unit_price'],
                ]);
            }
        });

        return redirect()->route('po.index')->with('success', "PO {$poNumber} berhasil dibuat.");
    }

    public function show(PurchaseOrder $purchaseOrder)
    {
        $purchaseOrder->load(['supplier', 'warehouse', 'orderedBy', 'receivedBy', 'items.item']);

        $poData = [
            'id'           => $purchaseOrder->id,
            'poNumber'     => $purchaseOrder->po_number,
            'supplierName' => $purchaseOrder->supplier?->name ?? '-',
            'warehouseName'=> $purchaseOrder->warehouse?->name ?? '-',
            'orderedBy'    => $purchaseOrder->orderedBy?->name ?? '-',
            'receivedBy'   => $purchaseOrder->receivedBy?->name ?? null,
            'status'       => $purchaseOrder->status,
            'orderedAt'    => $purchaseOrder->ordered_at?->toISOString(),
            'expectedAt'   => $purchaseOrder->expected_at?->toDateString(),
            'receivedAt'   => $purchaseOrder->received_at?->toISOString(),
            'subtotal'     => $purchaseOrder->subtotal,
            'grandTotal'   => $purchaseOrder->grand_total,
            'note'         => $purchaseOrder->note,
            'items'        => $purchaseOrder->items->map(fn ($pi) => [
                'id'             => $pi->id,
                'itemId'         => $pi->item_id,
                'itemName'       => $pi->item_name_snapshot,
                'orderedQty'     => $pi->ordered_qty,
                'receivedQty'    => $pi->received_qty,
                'pendingQty'     => $pi->ordered_qty - $pi->received_qty,
                'unitPrice'      => $pi->unit_price,
                'lineTotal'      => $pi->line_total,
            ]),
        ];

        return Inertia::render('purchase-orders/Show', ['po' => $poData]);
    }

    public function updateStatus(Request $request, PurchaseOrder $purchaseOrder)
    {
        $validator = Validator::make($request->all(), [
            'status' => 'required|in:ordered,cancelled',
        ]);

        if ($validator->fails()) {
            return back()->withErrors($validator)->withInput();
        }

        if (!in_array($purchaseOrder->status, ['draft', 'ordered'])) {
            return back()->withErrors(['status' => 'Status PO tidak bisa diubah.']);
        }

        $oldStatus = $purchaseOrder->status;
        $purchaseOrder->status = $request->status;
        if ($request->status === 'ordered') {
            $purchaseOrder->ordered_at = now();
        }
        $purchaseOrder->save();

        AuditLogger::log('po.status_changed', $purchaseOrder,
            ['status' => $oldStatus],
            ['status' => $purchaseOrder->status]
        );

        return redirect()->route('po.index')->with('success', 'Status PO berhasil diperbarui.');
    }

    public function receive(Request $request, PurchaseOrder $purchaseOrder)
    {
        if (!in_array($purchaseOrder->status, ['ordered', 'partial'])) {
            return back()->withErrors(['status' => 'PO hanya bisa diterima saat status ordered atau partial.']);
        }

        $validator = Validator::make($request->all(), [
            'items'                        => 'required|array|min:1',
            'items.*.purchase_order_item_id' => 'required|integer|exists:purchase_order_items,id',
            'items.*.received_qty'         => 'required|integer|min:0',
        ]);

        if ($validator->fails()) {
            return back()->withErrors($validator)->withInput();
        }

        $purchaseOrder->load('items');

        DB::transaction(function () use ($request, $purchaseOrder) {
            $warehouseId = $purchaseOrder->warehouse_id;

            foreach ($request->items as $ri) {
                $poItem = PurchaseOrderItem::find($ri['purchase_order_item_id']);
                if (!$poItem || $poItem->purchase_order_id !== $purchaseOrder->id) continue;

                $receiveQty = (int) $ri['received_qty'];
                if ($receiveQty <= 0) continue;

                $maxReceivable = $poItem->ordered_qty - $poItem->received_qty;
                $receiveQty    = min($receiveQty, $maxReceivable);
                if ($receiveQty <= 0) continue;

                // Update stock
                $item = Item::lockForUpdate()->find($poItem->item_id);
                if ($item) {
                    $wi = WarehouseItem::where('warehouse_id', $warehouseId)
                        ->where('item_id', $item->id)->lockForUpdate()->first();

                    if ($wi) {
                        $wi->stok += $receiveQty;
                        $wi->save();
                    } else {
                        WarehouseItem::create([
                            'warehouse_id' => $warehouseId,
                            'item_id'      => $item->id,
                            'stok'         => $receiveQty,
                            'stok_minimal' => 0,
                        ]);
                    }

                    $item->stok = (int) WarehouseItem::where('item_id', $item->id)->sum('stok');
                    $item->save();
                }

                $poItem->received_qty += $receiveQty;
                $poItem->save();
            }

            // Determine new status
            $purchaseOrder->refresh();
            $allReceived = $purchaseOrder->items->every(fn ($pi) => $pi->received_qty >= $pi->ordered_qty);
            $anyReceived = $purchaseOrder->items->some(fn ($pi) => $pi->received_qty > 0);

            if ($allReceived) {
                $purchaseOrder->status      = 'received';
                $purchaseOrder->received_at = now();
                $purchaseOrder->received_by = Auth::id();
            } elseif ($anyReceived) {
                $purchaseOrder->status = 'partial';
            }
            $purchaseOrder->save();
        });

        if ($purchaseOrder->status === 'received') {
            $purchaseOrder->load('supplier');
            AuditLogger::log('po.received', $purchaseOrder, null, [
                'po_number'   => $purchaseOrder->po_number,
                'supplier'    => $purchaseOrder->supplier?->name,
                'grand_total' => $purchaseOrder->grand_total,
            ]);
        }

        return redirect()->route('po.show', $purchaseOrder)->with('success', 'Penerimaan barang berhasil dicatat.');
    }

    public function destroy(PurchaseOrder $purchaseOrder)
    {
        if (!in_array($purchaseOrder->status, ['draft', 'cancelled'])) {
            return back()->withErrors(['status' => 'Hanya PO berstatus draft atau cancelled yang bisa dihapus.']);
        }

        $purchaseOrder->delete();

        return redirect()->route('po.index')->with('success', 'PO berhasil dihapus.');
    }

    // ── Reorder Suggestions ──────────────────────────────────────────────────

    public function suggestions()
    {
        $allowedIds = $this->allowedWarehouseIds();

        // Items below minimum, per warehouse, joined to item + supplier
        $rows = WarehouseItem::query()
            ->whereColumn('warehouse_items.stok', '<', 'warehouse_items.stok_minimal')
            ->where('warehouse_items.stok_minimal', '>', 0)
            ->join('warehouses', 'warehouses.id', '=', 'warehouse_items.warehouse_id')
            ->join('items',      'items.id',      '=', 'warehouse_items.item_id')
            ->where('items.type', 'barang')
            ->leftJoin('suppliers', 'suppliers.id', '=', 'items.preferred_supplier_id')
            ->where('warehouses.is_active', true)
            ->when(!empty($allowedIds), fn($q) => $q->whereIn('warehouse_items.warehouse_id', $allowedIds))
            ->select(
                'items.id as item_id',
                'items.nama as item_name',
                'items.harga_beli as unit_price',
                'items.preferred_supplier_id',
                'suppliers.name as supplier_name',
                'warehouses.id as warehouse_id',
                'warehouses.name as warehouse_name',
                'warehouse_items.stok as current_stock',
                'warehouse_items.stok_minimal as stock_min',
            )
            ->orderBy('warehouses.name')
            ->orderByRaw('warehouse_items.stok_minimal - warehouse_items.stok DESC')
            ->get()
            ->map(fn($r) => [
                'itemId'      => $r->item_id,
                'itemName'    => $r->item_name,
                'unitPrice'   => (int) $r->unit_price,
                'supplierId'  => $r->preferred_supplier_id,
                'supplierName'=> $r->supplier_name,
                'warehouseId' => $r->warehouse_id,
                'warehouseName'=> $r->warehouse_name,
                'currentStock'=> (int) $r->current_stock,
                'stockMin'    => (int) $r->stock_min,
                'deficit'     => (int) $r->stock_min - (int) $r->current_stock,
                // suggested qty = fill to 2× minimum
                'suggestedQty'=> max((int) $r->stock_min * 2 - (int) $r->current_stock, (int) $r->stock_min - (int) $r->current_stock),
            ])->all();

        $suppliers = Supplier::orderBy('name')->get(['id', 'name']);
        $warehouses = Warehouse::where('is_active', true)
            ->when(!empty($allowedIds), fn($q) => $q->whereIn('id', $allowedIds))
            ->orderBy('name')->get(['id', 'name']);

        return Inertia::render('purchase-orders/Suggestions', [
            'suggestions' => $rows,
            'suppliers'   => $suppliers,
            'warehouses'  => $warehouses,
        ]);
    }

    public function createFromSuggestions(Request $request)
    {
        $validated = $request->validate([
            'items'                => 'required|array|min:1',
            'items.*.item_id'      => 'required|integer|exists:items,id',
            'items.*.warehouse_id' => 'required|integer|exists:warehouses,id',
            'items.*.supplier_id'  => 'required|integer|exists:suppliers,id',
            'items.*.qty'          => 'required|integer|min:1',
        ]);

        // Group by supplier_id + warehouse_id → one PO per combination
        $groups = [];
        foreach ($validated['items'] as $row) {
            $key = $row['supplier_id'] . '_' . $row['warehouse_id'];
            $groups[$key][] = $row;
        }

        $createdIds = [];

        DB::transaction(function () use ($groups, &$createdIds) {
            foreach ($groups as $rows) {
                $supplierId  = $rows[0]['supplier_id'];
                $warehouseId = $rows[0]['warehouse_id'];

                $subtotal = 0;
                foreach ($rows as $r) {
                    $item = Item::find($r['item_id']);
                    $subtotal += ($item->harga_beli ?? 0) * $r['qty'];
                }

                $po = PurchaseOrder::create([
                    'po_number'    => 'PO-' . strtoupper(uniqid()),
                    'supplier_id'  => $supplierId,
                    'warehouse_id' => $warehouseId,
                    'ordered_by'   => Auth::id(),
                    'status'       => 'draft',
                    'ordered_at'   => now(),
                    'subtotal'     => $subtotal,
                    'tax_amount'   => 0,
                    'grand_total'  => $subtotal,
                    'note'         => 'Dibuat dari saran reorder otomatis.',
                ]);

                foreach ($rows as $r) {
                    $item = Item::find($r['item_id']);
                    $lineTotal = ($item->harga_beli ?? 0) * $r['qty'];

                    PurchaseOrderItem::create([
                        'purchase_order_id'  => $po->id,
                        'item_id'            => $r['item_id'],
                        'item_name_snapshot' => $item->nama,
                        'ordered_qty'        => $r['qty'],
                        'received_qty'       => 0,
                        'unit_price'         => $item->harga_beli ?? 0,
                        'line_total'         => $lineTotal,
                    ]);
                }

                AuditLogger::log('po.status_changed', $po,
                    ['status' => null],
                    ['status' => 'draft', 'source' => 'reorder_suggestion']
                );

                $createdIds[] = $po->id;
            }
        });

        $count = count($createdIds);
        return redirect()->route('po.index')
            ->with('success', "{$count} draft PO berhasil dibuat dari saran reorder.");
    }
}
