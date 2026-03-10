<?php

namespace App\Http\Controllers;

use App\Models\Item;
use App\Models\StockTransfer;
use App\Models\Warehouse;
use App\Models\WarehouseItem;
use App\Traits\FiltersWarehouseByUser;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Inertia\Inertia;

class StockTransferController extends Controller
{
    use FiltersWarehouseByUser;
    public function index(Request $request)
    {
        $perPage  = in_array((int) $request->get('per_page', 20), [10, 20, 50, 100])
            ? (int) $request->get('per_page', 20) : 20;
        $search   = trim((string) $request->get('search', ''));
        $dateFrom = $request->get('date_from');
        $dateTo   = $request->get('date_to');
        $sortDir  = strtolower($request->get('sort_dir', 'desc')) === 'asc' ? 'asc' : 'desc';

        $allowedSort = [
            'date'      => 'stock_transfers.occurred_at',
            'itemName'  => 'items.nama',
            'from'      => 'fw.name',
            'to'        => 'tw.name',
            'quantity'  => 'stock_transfers.quantity',
            'reference' => 'stock_transfers.reference',
        ];
        $sortKey    = $request->get('sort_by', 'date');
        $sortColumn = $allowedSort[$sortKey] ?? 'stock_transfers.occurred_at';

        $query = StockTransfer::with(['item', 'fromWarehouse', 'toWarehouse'])
            ->join('items', 'stock_transfers.item_id', '=', 'items.id')
            ->join('warehouses as fw', 'stock_transfers.from_warehouse_id', '=', 'fw.id')
            ->join('warehouses as tw', 'stock_transfers.to_warehouse_id',   '=', 'tw.id')
            ->select('stock_transfers.*');

        if ($search !== '') {
            $term = strtolower($search);
            $query->where(function ($q) use ($term) {
                $q->whereRaw('LOWER(items.nama) like ?', ["%{$term}%"])
                  ->orWhereRaw('LOWER(fw.name) like ?', ["%{$term}%"])
                  ->orWhereRaw('LOWER(tw.name) like ?', ["%{$term}%"])
                  ->orWhereRaw('LOWER(stock_transfers.reference) like ?', ["%{$term}%"])
                  ->orWhereRaw('LOWER(stock_transfers.actor) like ?', ["%{$term}%"])
                  ->orWhereRaw('LOWER(stock_transfers.note) like ?', ["%{$term}%"]);
            });
        }
        if ($dateFrom) $query->where('stock_transfers.occurred_at', '>=', $dateFrom . ' 00:00:00');
        if ($dateTo)   $query->where('stock_transfers.occurred_at', '<=', $dateTo   . ' 23:59:59');

        $ids = $this->allowedWarehouseIds();
        if (!empty($ids)) {
            $query->where(function ($q) use ($ids) {
                $q->whereIn('stock_transfers.from_warehouse_id', $ids)
                  ->orWhereIn('stock_transfers.to_warehouse_id', $ids);
            });
        }

        $query->orderBy($sortColumn, $sortDir);

        $transfers = $query->paginate($perPage)->withQueryString()->through(fn ($t) => [
            'id'            => $t->id,
            'txnId'         => $t->txn_id,
            'date'          => $t->occurred_at?->toISOString(),
            'itemId'        => $t->item_id,
            'itemName'      => $t->item?->nama ?? '(item deleted)',
            'fromId'        => $t->from_warehouse_id,
            'fromName'      => $t->fromWarehouse?->name ?? '-',
            'toId'          => $t->to_warehouse_id,
            'toName'        => $t->toWarehouse?->name ?? '-',
            'quantity'      => $t->quantity,
            'reference'     => $t->reference,
            'actor'         => $t->actor,
            'note'          => $t->note,
            'status'        => $t->status,
        ]);

        // Warehouses dropdown
        $warehouseQuery = Warehouse::where('is_active', true)
            ->orderBy('is_default', 'desc')->orderBy('name');
        $this->applyWarehouseFilter($warehouseQuery, 'id');
        $warehouses = $warehouseQuery->get()->map(fn ($w) => [
                'id'         => $w->id,
                'code'       => $w->code,
                'name'       => $w->name,
                'is_default' => $w->is_default,
            ]);

        // Items dropdown with per-warehouse stock
        $items = Item::select('id', 'nama', 'kategori', 'stok', 'kode_item')
            ->orderBy('nama')->get()->map(fn ($i) => [
                'id'       => $i->id,
                'name'     => $i->nama,
                'category' => $i->kategori,
                'stock'    => $i->stok,
            ]);

        return Inertia::render('inventory/Stock_Transfer', [
            'transfers'  => $transfers,
            'warehouses' => $warehouses,
            'items'      => $items,
            'filters'    => array_merge(
                $request->only(['search', 'date_from', 'date_to', 'per_page']),
                ['sort_by' => $sortKey, 'sort_dir' => $sortDir]
            ),
        ]);
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'from_warehouse_id' => 'required|integer|exists:warehouses,id',
            'to_warehouse_id'   => 'required|integer|exists:warehouses,id|different:from_warehouse_id',
            'item_id'           => 'required|integer|exists:items,id',
            'quantity'          => 'required|integer|min:1|max:99999',
            'date'              => 'required|date_format:Y-m-d',
            'reference'         => 'nullable|string|max:255',
            'note'              => 'nullable|string|max:1000',
        ]);

        if ($validator->fails()) {
            return back()->withErrors($validator)->withInput();
        }

        $data   = $validator->validated();
        $qty    = (int) $data['quantity'];
        $fromId = (int) $data['from_warehouse_id'];
        $toId   = (int) $data['to_warehouse_id'];

        $errorResponse = null;

        DB::transaction(function () use ($data, $qty, $fromId, $toId, &$errorResponse) {
            $item = Item::lockForUpdate()->findOrFail($data['item_id']);

            // Check source warehouse has enough stock
            $fromWi = WarehouseItem::where('warehouse_id', $fromId)
                ->where('item_id', $item->id)
                ->lockForUpdate()
                ->first();

            $fromStock = $fromWi ? $fromWi->stok : 0;

            if ($fromStock < $qty) {
                $errorResponse = ['quantity' => ["Stok di gudang asal tidak mencukupi. Stok tersedia: {$fromStock}"]];
                return;
            }

            // Deduct from source
            if ($fromWi) {
                $fromWi->stok -= $qty;
                $fromWi->save();
            }

            // Add to destination (create if needed)
            $toWi = WarehouseItem::where('warehouse_id', $toId)
                ->where('item_id', $item->id)
                ->lockForUpdate()
                ->first();

            if (!$toWi) {
                $toWi = WarehouseItem::create([
                    'warehouse_id' => $toId,
                    'item_id'      => $item->id,
                    'stok'         => 0,
                    'stok_minimal' => 0,
                ]);
            }
            $toWi->stok += $qty;
            $toWi->save();

            // Global stock stays the same (just moved) but recalc to be safe
            $item->stok = (int) WarehouseItem::where('item_id', $item->id)->sum('stok');
            $item->save();

            StockTransfer::create([
                'txn_id'            => 'TRF-' . strtoupper(Str::random(10)),
                'from_warehouse_id' => $fromId,
                'to_warehouse_id'   => $toId,
                'item_id'           => $item->id,
                'quantity'          => $qty,
                'occurred_at'       => $data['date'] . ' 00:00:00',
                'reference'         => $data['reference'] ?? null,
                'actor'             => Auth::user()?->name ?? 'System',
                'note'              => $data['note'] ?? null,
                'status'            => 'completed',
            ]);
        });

        if ($errorResponse) {
            return back()->withErrors($errorResponse)->withInput();
        }

        return redirect()->route('stock_transfer.index')->with('success', 'Transfer berhasil dicatat.');
    }

    public function destroy(Request $request, StockTransfer $stockTransfer)
    {
        $qty    = $stockTransfer->quantity;
        $fromId = $stockTransfer->from_warehouse_id;
        $toId   = $stockTransfer->to_warehouse_id;

        $errorResponse = null;

        DB::transaction(function () use ($stockTransfer, $qty, $fromId, $toId, &$errorResponse) {
            $item = Item::lockForUpdate()->find($stockTransfer->item_id);

            if ($item) {
                // Reverse: add back to source, deduct from destination
                $toWi = WarehouseItem::where('warehouse_id', $toId)
                    ->where('item_id', $item->id)
                    ->lockForUpdate()
                    ->first();

                $toStock = $toWi ? $toWi->stok : 0;

                if ($toStock < $qty) {
                    $errorResponse = ['general' => "Tidak bisa dibatalkan. Stok di gudang tujuan sudah berkurang ({$toStock} tersisa, butuh {$qty})."];
                    return;
                }

                if ($toWi) {
                    $toWi->stok -= $qty;
                    $toWi->save();
                }

                $fromWi = WarehouseItem::where('warehouse_id', $fromId)
                    ->where('item_id', $item->id)
                    ->lockForUpdate()
                    ->first();

                if ($fromWi) {
                    $fromWi->stok += $qty;
                    $fromWi->save();
                } else {
                    WarehouseItem::create([
                        'warehouse_id' => $fromId,
                        'item_id'      => $item->id,
                        'stok'         => $qty,
                        'stok_minimal' => 0,
                    ]);
                }

                $item->stok = (int) WarehouseItem::where('item_id', $item->id)->sum('stok');
                $item->save();
            }

            $stockTransfer->delete();
        });

        if ($errorResponse) {
            return back()->withErrors($errorResponse);
        }

        return redirect()->route('stock_transfer.index')->with('success', 'Transfer berhasil dibatalkan.');
    }
}
