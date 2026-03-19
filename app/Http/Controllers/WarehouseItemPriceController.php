<?php

namespace App\Http\Controllers;

use App\Helpers\AuditLogger;
use App\Models\Item;
use App\Models\Warehouse;
use App\Models\WarehouseItem;
use App\Models\WarehouseItemPrice;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class WarehouseItemPriceController extends Controller
{
    public function __construct()
    {
        $this->middleware(function ($request, $next) {
            $user = $request->user();
            if (! $user) return redirect()->route('login');

            $action = match(true) {
                $request->isMethod('DELETE')                                         => 'can_delete',
                in_array($request->method(), ['POST', 'PUT', 'PATCH'])               => 'can_write',
                default                                                               => 'can_view',
            };

            if (! $user->hasPermission('warehouses', $action)) {
                return $request->wantsJson()
                    ? response()->json(['error' => 'Forbidden'], 403)
                    : abort(403);
            }

            return $next($request);
        });
    }

    /**
     * GET /warehouses/{warehouse}/prices
     * Show per-outlet price list for a warehouse.
     */
    public function index(Request $request, Warehouse $warehouse)
    {
        $search  = trim((string) $request->get('search', ''));
        $perPage = 25;

        $query = DB::table('warehouse_items')
            ->where('warehouse_items.warehouse_id', $warehouse->id)
            ->join('items', 'items.id', '=', 'warehouse_items.item_id')
            ->leftJoin('warehouse_item_prices as wip', function ($join) use ($warehouse) {
                $join->on('wip.item_id', '=', 'items.id')
                     ->where('wip.warehouse_id', $warehouse->id);
            })
            ->select([
                'items.id as item_id',
                'items.kode_item',
                'items.nama',
                'items.kategori',
                'items.harga_jual as global_price',
                DB::raw('COALESCE(wip.harga_jual, items.harga_jual) as outlet_price'),
                'warehouse_items.stok',
            ]);

        if ($search !== '') {
            $term = strtolower($search);
            $query->where(function ($q) use ($term) {
                $q->whereRaw('LOWER(items.nama) like ?', ["%{$term}%"])
                  ->orWhereRaw('LOWER(items.kode_item) like ?', ["%{$term}%"])
                  ->orWhereRaw('LOWER(items.kategori) like ?', ["%{$term}%"]);
            });
        }

        $items = $query->orderBy('items.nama')->paginate($perPage)->withQueryString();

        return Inertia::render('warehouse/Prices', [
            'warehouse' => [
                'id'         => $warehouse->id,
                'code'       => $warehouse->code,
                'name'       => $warehouse->name,
                'is_default' => (bool) $warehouse->is_default,
            ],
            'items'   => $items,
            'filters' => ['search' => $search],
        ]);
    }

    /**
     * PUT /warehouses/{warehouse}/items/{item}/price
     * Upsert outlet-specific price for one item.
     */
    public function update(Request $request, Warehouse $warehouse, Item $item)
    {
        $request->validate([
            'harga_jual' => 'required|integer|min:0',
        ]);

        $oldPrice = WarehouseItemPrice::where('warehouse_id', $warehouse->id)
            ->where('item_id', $item->id)
            ->value('harga_jual') ?? $item->harga_jual;

        WarehouseItemPrice::updateOrCreate(
            ['warehouse_id' => $warehouse->id, 'item_id' => $item->id],
            ['harga_jual'   => (int) $request->harga_jual]
        );

        AuditLogger::log('outlet_price.updated', $warehouse, [
            'item'      => $item->nama,
            'old_price' => $oldPrice,
        ], [
            'item'      => $item->nama,
            'new_price' => $request->harga_jual,
        ]);

        if ($request->wantsJson()) {
            return response()->json(['message' => 'Harga berhasil diperbarui.']);
        }

        return back()->with('success', 'Harga outlet berhasil diperbarui.');
    }

    /**
     * POST /warehouses/{warehouse}/prices/sync
     * Reset all outlet prices to global harga_jual.
     */
    public function sync(Warehouse $warehouse)
    {
        // For each item in this warehouse, reset outlet price to global price
        $updated = DB::table('warehouse_item_prices')
            ->where('warehouse_id', $warehouse->id)
            ->join('items', 'items.id', '=', 'warehouse_item_prices.item_id')
            ->update(['warehouse_item_prices.harga_jual' => DB::raw('items.harga_jual')]);

        AuditLogger::log('outlet_price.synced', $warehouse, null, [
            'warehouse' => $warehouse->name,
            'items_updated' => $updated,
        ]);

        return back()->with('success', "Harga semua produk di {$warehouse->name} berhasil disinkronkan ke harga global.");
    }

    /**
     * POST /inventory/jasa-prices
     * Batch-set outlet prices for multiple service (jasa) items.
     */
    public function batchJasaPrices(Request $request)
    {
        $request->validate([
            'warehouse_id'              => 'required|integer|exists:warehouses,id',
            'services'                  => 'required|array|min:1',
            'services.*.item_id'        => 'required|integer|exists:items,id',
            'services.*.outlet_price'   => 'required|integer|min:0',
        ]);

        $warehouseId = (int) $request->warehouse_id;
        $warehouse   = Warehouse::findOrFail($warehouseId);

        foreach ($request->services as $s) {
            $item = Item::find($s['item_id']);
            if (! $item || $item->type !== 'jasa') continue;

            $old = WarehouseItemPrice::where('warehouse_id', $warehouseId)
                ->where('item_id', $item->id)->value('harga_jual') ?? $item->harga_jual;

            WarehouseItemPrice::updateOrCreate(
                ['warehouse_id' => $warehouseId, 'item_id' => $item->id],
                ['harga_jual'   => (int) $s['outlet_price']]
            );

            AuditLogger::log('outlet_price.updated', $warehouse, ['item' => $item->nama, 'old_price' => $old], [
                'item' => $item->nama, 'new_price' => $s['outlet_price'], 'source' => 'jasa_transfer',
            ]);
        }

        return redirect()->route('stock_transfer.index')
            ->with('success', 'Harga jasa untuk ' . $warehouse->name . ' berhasil diperbarui.');
    }

    /**
     * DELETE /warehouses/{warehouse}/items/{item}/jasa-price
     * Remove outlet-specific jasa price (only for jasa items, non-default warehouses).
     */
    public function destroyJasaPrice(Warehouse $warehouse, Item $item)
    {
        if ($warehouse->is_default) {
            return back()->withErrors(['general' => 'Tidak dapat menghapus harga dari gudang utama.']);
        }

        if ($item->type !== 'jasa') {
            return back()->withErrors(['general' => 'Item ini bukan jasa.']);
        }

        $deleted = WarehouseItemPrice::where('warehouse_id', $warehouse->id)
            ->where('item_id', $item->id)
            ->delete();

        if ($deleted) {
            AuditLogger::log('outlet_price.deleted', $warehouse,
                ['item' => $item->nama, 'warehouse' => $warehouse->name],
                null
            );
        }

        return back()->with('success', 'Harga jasa berhasil dihapus dari outlet ini.');
    }

    /**
     * POST /warehouses/{warehouse}/items/{item}/price/sync
     * Reset ONE item's outlet price to global.
     */
    public function syncOne(Warehouse $warehouse, Item $item)
    {
        WarehouseItemPrice::updateOrCreate(
            ['warehouse_id' => $warehouse->id, 'item_id' => $item->id],
            ['harga_jual'   => $item->harga_jual]
        );

        if (request()->wantsJson()) {
            return response()->json(['message' => 'Harga berhasil direset ke harga global.', 'price' => $item->harga_jual]);
        }

        return back()->with('success', 'Harga berhasil direset ke harga global.');
    }
}
