<?php

namespace App\Http\Controllers;

use App\Helpers\AuditLogger;
use App\Models\Item;
use App\Models\StockAdjustment;
use App\Models\Warehouse;
use App\Models\WarehouseItem;
use App\Traits\FiltersWarehouseByUser;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Inertia\Inertia;

class StockAdjustmentController extends Controller
{
    use FiltersWarehouseByUser;

    public function __construct()
    {
        $this->middleware(function ($request, $next) {
            $user = $request->user();
            if (!$user) return redirect()->route('login');

            $method = $request->method();
            $action = match(true) {
                $method === 'DELETE'                         => 'can_delete',
                in_array($method, ['POST', 'PUT', 'PATCH']) => 'can_write',
                default                                      => 'can_view',
            };

            if (!$user->hasPermission('inventory', $action)) {
                return $request->wantsJson()
                    ? response()->json(['error' => 'Forbidden'], 403)
                    : abort(403);
            }

            return $next($request);
        });
    }
    public function index(Request $request)
    {
        $perPage  = in_array((int) $request->get('per_page', 20), [10, 20, 50, 100])
            ? (int) $request->get('per_page', 20) : 20;
        $search   = trim((string) $request->get('search', ''));
        $dateFrom = $request->get('date_from');
        $dateTo   = $request->get('date_to');
        $sortDir  = strtolower($request->get('sort_dir', 'desc')) === 'asc' ? 'asc' : 'desc';

        $allowedSort = [
            'date'      => 'stock_adjustments.occurred_at',
            'itemName'  => 'items.nama',
            'warehouse' => 'warehouses.name',
            'difference'=> 'stock_adjustments.difference',
        ];
        $sortKey    = $request->get('sort_by', 'date');
        $sortColumn = $allowedSort[$sortKey] ?? 'stock_adjustments.occurred_at';

        $query = StockAdjustment::with(['item', 'warehouse'])
            ->join('items',      'stock_adjustments.item_id',      '=', 'items.id')
            ->join('warehouses', 'stock_adjustments.warehouse_id', '=', 'warehouses.id')
            ->select('stock_adjustments.*');

        if ($search !== '') {
            $term = strtolower($search);
            $query->where(function ($q) use ($term) {
                $q->whereRaw('LOWER(items.nama) like ?', ["%{$term}%"])
                  ->orWhereRaw('LOWER(warehouses.name) like ?', ["%{$term}%"])
                  ->orWhereRaw('LOWER(stock_adjustments.reason) like ?', ["%{$term}%"])
                  ->orWhereRaw('LOWER(stock_adjustments.actor) like ?', ["%{$term}%"])
                  ->orWhereRaw('LOWER(stock_adjustments.note) like ?', ["%{$term}%"]);
            });
        }
        if ($dateFrom) $query->where('stock_adjustments.occurred_at', '>=', $dateFrom . ' 00:00:00');
        if ($dateTo)   $query->where('stock_adjustments.occurred_at', '<=', $dateTo   . ' 23:59:59');

        $this->applyWarehouseFilter($query, 'stock_adjustments.warehouse_id');

        $query->orderBy($sortColumn, $sortDir);

        $adjustments = $query->paginate($perPage)->withQueryString()->through(fn ($a) => [
            'id'           => $a->id,
            'txnId'        => $a->txn_id,
            'date'         => $a->occurred_at?->toISOString(),
            'itemId'       => $a->item_id,
            'itemName'     => $a->item?->nama ?? '(item deleted)',
            'warehouseId'  => $a->warehouse_id,
            'warehouseName'=> $a->warehouse?->name ?? '-',
            'oldQty'       => $a->old_quantity,
            'newQty'       => $a->new_quantity,
            'difference'   => $a->difference,
            'reason'       => $a->reason,
            'actor'        => $a->actor,
            'note'         => $a->note,
        ]);

        $warehouseQuery = Warehouse::where('is_active', true)->orderBy('is_default', 'desc')->orderBy('name');
        $this->applyWarehouseFilter($warehouseQuery, 'id');
        $warehouses = $warehouseQuery->get()->map(fn ($w) => ['id' => $w->id, 'name' => $w->name, 'code' => $w->code]);

        $items = Item::select('id', 'nama', 'kategori', 'stok')
            ->orderBy('nama')->get()->map(fn ($i) => [
                'id' => $i->id, 'name' => $i->nama, 'category' => $i->kategori, 'stock' => $i->stok,
            ]);

        $reasons = ['Koreksi Stok', 'Stok Opname', 'Barang Rusak / Hilang', 'Barang Kadaluarsa', 'Selisih Hitung', 'Lainnya'];

        return Inertia::render('inventory/Stock_Adjustment', [
            'adjustments' => $adjustments,
            'warehouses'  => $warehouses,
            'items'       => $items,
            'reasons'     => $reasons,
            'filters'     => array_merge(
                $request->only(['search', 'date_from', 'date_to', 'per_page']),
                ['sort_by' => $sortKey, 'sort_dir' => $sortDir]
            ),
        ]);
    }

    /**
     * GET: return current warehouse stock for an item (JSON, called via axios-like fetch from frontend).
     */
    public function warehouseStock(Request $request)
    {
        $warehouseId = (int) $request->get('warehouse_id');
        $itemId      = (int) $request->get('item_id');

        $wi = WarehouseItem::where('warehouse_id', $warehouseId)
            ->where('item_id', $itemId)
            ->first();

        return response()->json(['stock' => $wi ? $wi->stok : 0]);
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'warehouse_id' => 'required|integer|exists:warehouses,id',
            'item_id'      => 'required|integer|exists:items,id',
            'new_quantity' => 'required|integer|min:0|max:9999999',
            'date'         => 'required|date_format:Y-m-d',
            'reason'       => 'nullable|string|max:255',
            'note'         => 'nullable|string|max:1000',
        ]);

        if ($validator->fails()) {
            return back()->withErrors($validator)->withInput();
        }

        $data        = $validator->validated();
        $warehouseId = (int) $data['warehouse_id'];
        $newQty      = (int) $data['new_quantity'];

        DB::transaction(function () use ($data, $warehouseId, $newQty, $request) {
            $item = Item::lockForUpdate()->findOrFail($data['item_id']);

            $wi = WarehouseItem::where('warehouse_id', $warehouseId)
                ->where('item_id', $item->id)
                ->lockForUpdate()
                ->first();

            $oldQty = $wi ? $wi->stok : 0;
            $diff   = $newQty - $oldQty;

            if ($wi) {
                $wi->stok = $newQty;
                $wi->save();
            } else {
                WarehouseItem::create([
                    'warehouse_id' => $warehouseId,
                    'item_id'      => $item->id,
                    'stok'         => $newQty,
                    'stok_minimal' => 0,
                ]);
            }

            // Recalculate global stock
            $item->stok = (int) WarehouseItem::where('item_id', $item->id)->sum('stok');
            $item->save();

            $warehouse = Warehouse::find($warehouseId);

            StockAdjustment::create([
                'txn_id'       => 'ADJ-' . strtoupper(Str::random(10)),
                'warehouse_id' => $warehouseId,
                'item_id'      => $item->id,
                'old_quantity' => $oldQty,
                'new_quantity' => $newQty,
                'difference'   => $diff,
                'reason'       => $data['reason'] ?? null,
                'actor'        => Auth::user()?->name ?? 'System',
                'occurred_at'  => $data['date'] . ' 00:00:00',
                'note'         => $data['note'] ?? null,
            ]);

            AuditLogger::log('stock.adjusted', $item,
                ['old_qty' => $oldQty],
                ['new_qty' => $newQty, 'reason' => $data['reason'] ?? null, 'outlet_name' => $warehouse?->name]
            );
        });

        return redirect()->route('stock_adjustment.index')->with('success', 'Penyesuaian stok berhasil dicatat.');
    }
}
