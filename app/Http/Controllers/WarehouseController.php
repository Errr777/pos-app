<?php

namespace App\Http\Controllers;

use App\Models\Item;
use App\Models\Transaction;
use App\Models\Warehouse;
use App\Models\WarehouseItem;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Inertia\Inertia;

class WarehouseController extends Controller
{
    // -------------------------------------------------------------------------
    // GET: Warehouse list
    // -------------------------------------------------------------------------

    public function index(Request $request)
    {
        $flash = $request->session()->get('success');

        $warehouses = Warehouse::orderBy('is_default', 'desc')->orderBy('name')->get()
            ->map(function ($w) {
                $lowStockCount = WarehouseItem::where('warehouse_id', $w->id)
                    ->whereColumn('stok', '<', 'stok_minimal')
                    ->count();
                $totalStock = (int) WarehouseItem::where('warehouse_id', $w->id)->sum('stok');
                $itemCount  = WarehouseItem::where('warehouse_id', $w->id)->count();

                return [
                    'id'            => $w->id,
                    'code'          => $w->code,
                    'name'          => $w->name,
                    'location'      => $w->location,
                    'description'   => $w->description,
                    'is_active'     => $w->is_active,
                    'is_default'    => $w->is_default,
                    'itemCount'     => $itemCount,
                    'totalStock'    => $totalStock,
                    'lowStockCount' => $lowStockCount,
                ];
            });

        return Inertia::render('warehouse/Index', [
            'warehouses' => $warehouses,
        ]);
    }

    // -------------------------------------------------------------------------
    // GET: Warehouse detail (tabbed)
    // -------------------------------------------------------------------------

    public function show(Request $request, Warehouse $warehouse)
    {
        $tab     = $request->get('tab', 'items');
        $search  = trim((string) $request->get('search', ''));
        $perPage = 20;

        $stats = [
            'itemCount'     => WarehouseItem::where('warehouse_id', $warehouse->id)->count(),
            'lowStockCount' => WarehouseItem::where('warehouse_id', $warehouse->id)
                ->whereColumn('stok', '<', 'stok_minimal')
                ->count(),
            'totalStock' => (int) WarehouseItem::where('warehouse_id', $warehouse->id)->sum('stok'),
        ];

        $items         = null;
        $lowStockItems = null;
        $movements     = null;

        if ($tab === 'items') {
            $q = WarehouseItem::where('warehouse_items.warehouse_id', $warehouse->id)
                ->join('items', 'items.id', '=', 'warehouse_items.item_id')
                ->select('warehouse_items.*', 'items.nama', 'items.kode_item', 'items.kategori');

            if ($search !== '') {
                $term = strtolower($search);
                $q->where(function ($qu) use ($term) {
                    $qu->whereRaw('LOWER(items.nama) like ?', ["%{$term}%"])
                       ->orWhereRaw('LOWER(items.kode_item) like ?', ["%{$term}%"])
                       ->orWhereRaw('LOWER(items.kategori) like ?', ["%{$term}%"]);
                });
            }

            $items = $q->orderBy('items.nama')
                ->paginate($perPage)
                ->withQueryString()
                ->through(fn($wi) => [
                    'itemId'   => $wi->item_id,
                    'name'     => $wi->nama,
                    'qrcode'   => $wi->kode_item,
                    'category' => $wi->kategori,
                    'stock'    => (int) $wi->stok,
                    'stockMin' => (int) $wi->stok_minimal,
                    'isLow'    => $wi->stok < $wi->stok_minimal && $wi->stok_minimal > 0,
                ]);

        } elseif ($tab === 'low_stock') {
            $q = WarehouseItem::where('warehouse_items.warehouse_id', $warehouse->id)
                ->whereColumn('warehouse_items.stok', '<', 'warehouse_items.stok_minimal')
                ->where('warehouse_items.stok_minimal', '>', 0)
                ->join('items', 'items.id', '=', 'warehouse_items.item_id')
                ->select('warehouse_items.*', 'items.nama', 'items.kode_item', 'items.kategori');

            if ($search !== '') {
                $term = strtolower($search);
                $q->where(function ($qu) use ($term) {
                    $qu->whereRaw('LOWER(items.nama) like ?', ["%{$term}%"])
                       ->orWhereRaw('LOWER(items.kategori) like ?', ["%{$term}%"]);
                });
            }

            $lowStockItems = $q->orderBy('items.nama')
                ->paginate($perPage)
                ->withQueryString()
                ->through(fn($wi) => [
                    'itemId'   => $wi->item_id,
                    'name'     => $wi->nama,
                    'qrcode'   => $wi->kode_item,
                    'category' => $wi->kategori,
                    'stock'    => (int) $wi->stok,
                    'stockMin' => (int) $wi->stok_minimal,
                    'shortage' => (int) $wi->stok_minimal - (int) $wi->stok,
                ]);

        } elseif ($tab === 'log') {
            $q = Transaction::with('item')
                ->where('transactions.warehouse_id', $warehouse->id)
                ->whereIn('transactions.type', ['stock_in', 'stock_out'])
                ->where('transactions.status', 'completed');

            if ($search !== '') {
                $term = strtolower($search);
                $q->where(function ($qu) use ($term) {
                    $qu->whereRaw('LOWER(transactions.party) like ?', ["%{$term}%"])
                       ->orWhereRaw('LOWER(transactions.reference) like ?', ["%{$term}%"])
                       ->orWhereHas('item', fn($iq) => $iq->whereRaw('LOWER(nama) like ?', ["%{$term}%"]));
                });
            }

            $movements = $q->orderBy('transactions.occurred_at', 'desc')
                ->paginate($perPage)
                ->withQueryString()
                ->through(fn($t) => [
                    'id'        => $t->id,
                    'date'      => $t->occurred_at?->toISOString(),
                    'itemName'  => $t->item?->nama ?? '(deleted)',
                    'direction' => $t->type === 'stock_in' ? 'IN' : 'OUT',
                    'quantity'  => (int) abs($t->amount),
                    'party'     => $t->party,
                    'reference' => $t->reference,
                    'actor'     => $t->actor,
                    'note'      => $t->note,
                ]);
        }

        return Inertia::render('warehouse/Show', [
            'warehouse' => [
                'id'          => $warehouse->id,
                'code'        => $warehouse->code,
                'name'        => $warehouse->name,
                'location'    => $warehouse->location,
                'description' => $warehouse->description,
                'is_default'  => $warehouse->is_default,
                'is_active'   => $warehouse->is_active,
            ],
            'stats'         => $stats,
            'tab'           => $tab,
            'items'         => $items,
            'lowStockItems' => $lowStockItems,
            'movements'     => $movements,
            'filters'       => ['search' => $search],
        ]);
    }

    // -------------------------------------------------------------------------
    // POST: Create warehouse
    // -------------------------------------------------------------------------

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'code'        => ['required', 'string', 'max:20', 'unique:warehouses,code', 'regex:/^[A-Z0-9\-]+$/'],
            'name'        => 'required|string|max:100',
            'location'    => 'nullable|string|max:255',
            'description' => 'nullable|string|max:1000',
        ]);

        if ($validator->fails()) {
            return back()->withErrors($validator)->withInput();
        }

        Warehouse::create($validator->validated());

        return redirect()->route('warehouses.index')->with('success', 'Gudang berhasil ditambahkan.');
    }

    // -------------------------------------------------------------------------
    // PUT: Update warehouse
    // -------------------------------------------------------------------------

    public function update(Request $request, Warehouse $warehouse)
    {
        $validator = Validator::make($request->all(), [
            'name'        => 'required|string|max:100',
            'location'    => 'nullable|string|max:255',
            'description' => 'nullable|string|max:1000',
            'is_active'   => 'boolean',
        ]);

        if ($validator->fails()) {
            return back()->withErrors($validator)->withInput();
        }

        $data = $validator->validated();

        // Cannot deactivate the default warehouse
        if ($warehouse->is_default) {
            unset($data['is_active']);
        }

        $warehouse->update($data);

        return redirect()->route('warehouses.index')->with('success', 'Gudang berhasil diperbarui.');
    }

    // -------------------------------------------------------------------------
    // DELETE: Remove warehouse
    // -------------------------------------------------------------------------

    public function destroy(Warehouse $warehouse)
    {
        if ($warehouse->is_default) {
            return back()->withErrors(['general' => 'Gudang utama tidak dapat dihapus.']);
        }

        $hasTransactions = Transaction::where('warehouse_id', $warehouse->id)->exists();
        if ($hasTransactions) {
            $warehouse->update(['is_active' => false]);
            return redirect()->route('warehouses.index')
                ->with('success', 'Gudang dinonaktifkan (memiliki riwayat transaksi).');
        }

        $warehouse->delete();
        return redirect()->route('warehouses.index')->with('success', 'Gudang berhasil dihapus.');
    }

    // -------------------------------------------------------------------------
    // PUT: Update per-warehouse minimum stock for an item
    // -------------------------------------------------------------------------

    public function updateItemMin(Request $request, Warehouse $warehouse, Item $item)
    {
        $validator = Validator::make($request->all(), [
            'stok_minimal' => 'required|integer|min:0',
        ]);

        if ($validator->fails()) {
            return back()->withErrors($validator)->withInput();
        }

        WarehouseItem::where('warehouse_id', $warehouse->id)
            ->where('item_id', $item->id)
            ->update(['stok_minimal' => $validator->validated()['stok_minimal']]);

        return back()->with('success', 'Stok minimum berhasil diperbarui.');
    }
}
