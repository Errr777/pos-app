<?php

namespace App\Http\Controllers;

use App\Helpers\AuditLogger;
use App\Models\Item;
use App\Models\Transaction;
use App\Models\Warehouse;
use App\Models\WarehouseItem;
use App\Traits\FiltersWarehouseByUser;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Inertia\Inertia;

class WarehouseController extends Controller
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

            if (!$user->hasPermission('warehouses', $action)) {
                return $request->wantsJson()
                    ? response()->json(['error' => 'Forbidden'], 403)
                    : abort(403);
            }

            return $next($request);
        });
    }

    // -------------------------------------------------------------------------
    // GET: Warehouse list
    // -------------------------------------------------------------------------

    public function index(Request $request)
    {
        $flash = $request->session()->get('success');

        $query = Warehouse::orderBy('is_default', 'desc')->orderBy('name');
        $this->applyWarehouseFilter($query, 'id');
        $warehouses = $query->get()
            ->map(function ($w) {
                $lowStockCount = WarehouseItem::where('warehouse_id', $w->id)
                    ->whereColumn('stok', '<', 'stok_minimal')
                    ->count();
                $totalStock = (int) WarehouseItem::where('warehouse_id', $w->id)->sum('stok');
                $itemCount  = WarehouseItem::where('warehouse_id', $w->id)->count();

                return [
                    'id'            => hid($w->id),
                    'code'          => $w->code,
                    'name'          => $w->name,
                    'location'      => $w->location,
                    'description'   => $w->description,
                    'is_active'     => $w->is_active,
                    'is_default'    => $w->is_default,
                    'phone'         => $w->phone,
                    'city'          => $w->city,
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
        if (!$this->canAccessWarehouse($warehouse->id)) {
            abort(403, 'Anda tidak memiliki akses ke gudang ini.');
        }

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

        // Count jasa items that have an outlet price set for this warehouse
        $jasaCount = !$warehouse->is_default
            ? DB::table('items')
                ->where('items.type', 'jasa')
                ->join('warehouse_item_prices as wip', function ($j) use ($warehouse) {
                    $j->on('wip.item_id', '=', 'items.id')->where('wip.warehouse_id', $warehouse->id);
                })
                ->count()
            : 0;

        $items         = null;
        $lowStockItems = null;
        $movements     = null;
        $jasaItems     = null;

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
                    'itemId'   => hid($wi->item_id),
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
                    'itemId'   => hid($wi->item_id),
                    'name'     => $wi->nama,
                    'qrcode'   => $wi->kode_item,
                    'category' => $wi->kategori,
                    'stock'    => (int) $wi->stok,
                    'stockMin' => (int) $wi->stok_minimal,
                    'shortage' => (int) $wi->stok_minimal - (int) $wi->stok,
                ]);

        } elseif ($tab === 'jasa' && !$warehouse->is_default) {
            $q = DB::table('items')
                ->where('items.type', 'jasa')
                ->join('warehouse_item_prices as wip', function ($j) use ($warehouse) {
                    $j->on('wip.item_id', '=', 'items.id')->where('wip.warehouse_id', $warehouse->id);
                })
                ->select('items.id', 'items.nama', 'items.kode_item', 'items.kategori',
                         'items.harga_jual as global_price', 'wip.harga_jual as outlet_price');

            if ($search !== '') {
                $term = strtolower($search);
                $q->where(function ($qu) use ($term) {
                    $qu->whereRaw('LOWER(items.nama) like ?', ["%{$term}%"])
                       ->orWhereRaw('LOWER(items.kode_item) like ?', ["%{$term}%"])
                       ->orWhereRaw('LOWER(items.kategori) like ?', ["%{$term}%"]);
                });
            }

            $jasaItems = $q->orderBy('items.nama')
                ->paginate($perPage)
                ->withQueryString()
                ->through(fn($i) => [
                    'itemId'      => hid($i->id),
                    'name'        => $i->nama,
                    'qrcode'      => $i->kode_item,
                    'category'    => $i->kategori,
                    'globalPrice' => (int) $i->global_price,
                    'outletPrice' => (int) $i->outlet_price,
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
                    'id'        => hid($t->id),
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
                'id'          => hid($warehouse->id),
                'code'        => $warehouse->code,
                'name'        => $warehouse->name,
                'location'    => $warehouse->location,
                'description' => $warehouse->description,
                'is_default'  => $warehouse->is_default,
                'is_active'   => $warehouse->is_active,
                'phone'       => $warehouse->phone,
                'city'        => $warehouse->city,
            ],
            'stats'         => array_merge($stats, ['jasaCount' => $jasaCount]),
            'tab'           => $tab,
            'items'         => $items,
            'lowStockItems' => $lowStockItems,
            'movements'     => $movements,
            'jasaItems'     => $jasaItems,
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
            'phone'       => 'nullable|string|max:20',
            'city'        => 'nullable|string|max:100',
        ]);

        if ($validator->fails()) {
            return back()->withErrors($validator)->withInput();
        }

        $warehouse = Warehouse::create($validator->validated());

        AuditLogger::log('outlet.created', $warehouse, null, [
            'name' => $warehouse->name,
            'code' => $warehouse->code,
        ]);

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
            'phone'       => 'nullable|string|max:20',
            'city'        => 'nullable|string|max:100',
        ]);

        if ($validator->fails()) {
            return back()->withErrors($validator)->withInput();
        }

        $data    = $validator->validated();
        $oldName = $warehouse->name;

        // Cannot deactivate the default warehouse
        if ($warehouse->is_default) {
            unset($data['is_active']);
        }

        $warehouse->update($data);

        AuditLogger::log('outlet.updated', $warehouse,
            ['name' => $oldName],
            ['name' => $warehouse->name]
        );

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

        AuditLogger::log('outlet.deleted', $warehouse, ['name' => $warehouse->name]);

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
