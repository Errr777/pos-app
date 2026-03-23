<?php

namespace App\Http\Controllers;

use App\Models\Item;
use App\Models\Supplier;
use App\Models\Transaction;
use App\Models\User;
use App\Models\Warehouse;
use App\Models\WarehouseItem;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Inertia\Inertia;

class StockMovementController extends Controller
{
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

    // -------------------------------------------------------------------------
    // Shared helpers
    // -------------------------------------------------------------------------

    private function allowedPerPage(): array
    {
        return [10, 20, 50, 100];
    }

    private function sanitizePerPage(Request $request, int $default = 20): int
    {
        $pp = (int) $request->get('per_page', $default);
        return in_array($pp, $this->allowedPerPage(), true) ? $pp : $default;
    }

    private function sanitizeSortDir(Request $request): string
    {
        return strtolower($request->get('sort_dir', 'desc')) === 'asc' ? 'asc' : 'desc';
    }

    /** Apply search + date range to a Transaction query. */
    private function applySearch($query, string $search, ?string $dateFrom, ?string $dateTo)
    {
        if ($search !== '') {
            $term = strtolower($search);
            $query->where(function ($q) use ($term) {
                $q->whereRaw('LOWER(transactions.reference) like ?', ["%{$term}%"])
                  ->orWhereRaw('LOWER(transactions.party) like ?', ["%{$term}%"])
                  ->orWhereRaw('LOWER(transactions.note) like ?', ["%{$term}%"])
                  ->orWhereRaw('LOWER(transactions.actor) like ?', ["%{$term}%"])
                  ->orWhereRaw('LOWER(transactions.source) like ?', ["%{$term}%"])
                  ->orWhereHas('item', fn($iq) =>
                      $iq->whereRaw('LOWER(nama) like ?', ["%{$term}%"])
                  );
            });
        }
        if ($dateFrom) {
            $query->where('transactions.occurred_at', '>=', $dateFrom . ' 00:00:00');
        }
        if ($dateTo) {
            $query->where('transactions.occurred_at', '<=', $dateTo . ' 23:59:59');
        }
        return $query;
    }

    /** Return the list of items for the dropdown in add/edit modals. */
    /** Return items with stock > 0 for a specific warehouse (used by Stock Out form). */
    public function stockOutItems(Request $request): \Illuminate\Http\JsonResponse
    {
        $warehouseId = (int) $request->get('warehouse_id', 0);

        $items = WarehouseItem::where('warehouse_items.warehouse_id', $warehouseId)
            ->where('warehouse_items.stok', '>', 0)
            ->join('items', 'items.id', '=', 'warehouse_items.item_id')
            ->select('items.id', 'items.nama', 'items.kategori', 'items.kode_item', 'items.image_path', 'warehouse_items.stok')
            ->orderBy('items.nama')
            ->get()
            ->map(fn($row) => [
                'id'        => $row->id,
                'name'      => $row->nama,
                'category'  => $row->kategori,
                'stock'     => (int) $row->stok,
                'kode'      => $row->kode_item,
                'image_url' => $row->image_path ? Storage::url($row->image_path) : null,
            ]);

        return response()->json($items);
    }

    private function itemOptions(): \Illuminate\Support\Collection
    {
        return Item::select('id', 'nama', 'kategori', 'stok', 'kode_item', 'image_path')
            ->orderBy('nama')
            ->get()
            ->map(fn($i) => [
                'id'        => $i->id,
                'name'      => $i->nama,
                'category'  => $i->kategori,
                'stock'     => $i->stok,
                'kode'      => $i->kode_item,
                'image_url' => $i->image_path ? Storage::url($i->image_path) : null,
            ]);
    }

    private function supplierOptions(): \Illuminate\Support\Collection
    {
        return Supplier::where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'name']);
    }

    private function staffOptions(): \Illuminate\Support\Collection
    {
        return User::orderBy('name')
            ->get(['id', 'name']);
    }

    /** Return active warehouses for the dropdown. */
    private function warehouseOptions(): \Illuminate\Support\Collection
    {
        return Warehouse::where('is_active', true)
            ->orderBy('is_default', 'desc')
            ->orderBy('name')
            ->get()
            ->map(fn($w) => [
                'id'         => $w->id,
                'code'       => $w->code,
                'name'       => $w->name,
                'is_default' => $w->is_default,
            ]);
    }

    /** Resolve warehouse_id: use provided value or fall back to default warehouse. */
    private function resolveWarehouseId(?int $warehouseId): int
    {
        if ($warehouseId) {
            return $warehouseId;
        }
        return (int) (Warehouse::where('is_default', true)->value('id')
            ?? Warehouse::first()->value('id'));
    }

    // -------------------------------------------------------------------------
    // GET: Stock In page
    // -------------------------------------------------------------------------

    public function stockIn(Request $request)
    {
        $perPage  = $this->sanitizePerPage($request);
        $search   = trim((string) $request->get('search', ''));
        $dateFrom = $request->get('date_from');
        $dateTo   = $request->get('date_to');
        $sortDir  = $this->sanitizeSortDir($request);

        $clientToDb = [
            'date'      => 'transactions.occurred_at',
            'itemName'  => 'items.nama',
            'quantity'  => 'transactions.amount',
            'party'     => 'transactions.party',
            'reference' => 'transactions.reference',
        ];
        $requestedSort = (string) $request->get('sort_by', 'date');
        $sortColumn    = $clientToDb[$requestedSort] ?? 'transactions.occurred_at';

        $query = Transaction::with('item')
            ->where('transactions.type', 'stock_in')
            ->where('transactions.status', 'completed');

        $this->applySearch($query, $search, $dateFrom, $dateTo);

        // Total qty for the entire filtered set (before pagination)
        $totalQty = (clone $query)->sum(DB::raw('ABS(transactions.amount)'));

        if ($sortColumn === 'items.nama') {
            $query->leftJoin('items', 'transactions.item_id', '=', 'items.id')
                  ->select('transactions.*')
                  ->orderBy('items.nama', $sortDir);
        } else {
            $query->orderBy($sortColumn, $sortDir);
        }

        $movements = $query
            ->paginate($perPage)
            ->withQueryString()
            ->through(fn($t) => [
                'id'          => $t->id,
                'date'        => $t->occurred_at?->toISOString(),
                'itemId'      => $t->item_id,
                'itemName'    => $t->item?->nama ?? '(item deleted)',
                'quantity'    => (int) abs($t->amount),
                'party'       => $t->party,
                'reference'   => $t->reference,
                'qrcode'      => $t->qrcode,
                'image_url'   => $t->item?->image_path ? Storage::url($t->item->image_path) : null,
                'note'        => $t->note,
                'warehouseId' => $t->warehouse_id,
            ]);

        return Inertia::render('inventory/Stock_In', [
            'movements'  => $movements,
            'items'      => $this->itemOptions(),
            'warehouses' => $this->warehouseOptions(),
            'suppliers'  => $this->supplierOptions(),
            'totalQty'   => (int) $totalQty,
            'filters'    => array_merge(
                $request->only(['search', 'date_from', 'date_to', 'per_page']),
                ['sort_by' => $requestedSort, 'sort_dir' => $sortDir]
            ),
        ]);
    }

    // -------------------------------------------------------------------------
    // GET: Stock Out page
    // -------------------------------------------------------------------------

    public function stockOut(Request $request)
    {
        $perPage  = $this->sanitizePerPage($request);
        $search   = trim((string) $request->get('search', ''));
        $dateFrom = $request->get('date_from');
        $dateTo   = $request->get('date_to');
        $sortDir  = $this->sanitizeSortDir($request);

        $clientToDb = [
            'date'      => 'transactions.occurred_at',
            'itemName'  => 'items.nama',
            'quantity'  => 'transactions.amount',
            'party'     => 'transactions.party',
            'reference' => 'transactions.reference',
        ];
        $requestedSort = (string) $request->get('sort_by', 'date');
        $sortColumn    = $clientToDb[$requestedSort] ?? 'transactions.occurred_at';

        $query = Transaction::with('item')
            ->where('transactions.type', 'stock_out')
            ->where('transactions.status', 'completed');

        $this->applySearch($query, $search, $dateFrom, $dateTo);

        $totalQty = (clone $query)->sum(DB::raw('ABS(transactions.amount)'));

        if ($sortColumn === 'items.nama') {
            $query->leftJoin('items', 'transactions.item_id', '=', 'items.id')
                  ->select('transactions.*')
                  ->orderBy('items.nama', $sortDir);
        } else {
            $query->orderBy($sortColumn, $sortDir);
        }

        $movements = $query
            ->paginate($perPage)
            ->withQueryString()
            ->through(fn($t) => [
                'id'          => $t->id,
                'date'        => $t->occurred_at?->toISOString(),
                'itemId'      => $t->item_id,
                'itemName'    => $t->item?->nama ?? '(item deleted)',
                'quantity'    => (int) abs($t->amount),
                'party'       => $t->party,
                'reference'   => $t->reference,
                'qrcode'      => $t->qrcode,
                'image_url'   => $t->item?->image_path ? Storage::url($t->item->image_path) : null,
                'note'        => $t->note,
                'warehouseId' => $t->warehouse_id,
            ]);

        return Inertia::render('inventory/Stock_Out', [
            'movements'  => $movements,
            'warehouses' => $this->warehouseOptions(),
            'staffList'  => $this->staffOptions(),
            'totalQty'   => (int) $totalQty,
            'filters'    => array_merge(
                $request->only(['search', 'date_from', 'date_to', 'per_page']),
                ['sort_by' => $requestedSort, 'sort_dir' => $sortDir]
            ),
        ]);
    }

    // -------------------------------------------------------------------------
    // GET: Stock History page (IN + OUT combined)
    // -------------------------------------------------------------------------

    public function history(Request $request)
    {
        $perPage  = $this->sanitizePerPage($request);
        $search   = trim((string) $request->get('search', ''));
        $dateFrom = $request->get('date_from');
        $dateTo   = $request->get('date_to');
        $sortDir  = $this->sanitizeSortDir($request);

        $clientToDb = [
            'date'      => 'transactions.occurred_at',
            'itemName'  => 'items.nama',
            'direction' => 'transactions.type',
            'quantity'  => 'transactions.amount',
            'party'     => 'transactions.party',
            'reference' => 'transactions.reference',
        ];
        $requestedSort = (string) $request->get('sort_by', 'date');
        $sortColumn    = $clientToDb[$requestedSort] ?? 'transactions.occurred_at';

        $query = Transaction::with('item')
            ->whereIn('transactions.type', ['stock_in', 'stock_out'])
            ->where('transactions.status', 'completed');

        $this->applySearch($query, $search, $dateFrom, $dateTo);

        // Stats from entire filtered set
        $statsQuery = Transaction::whereIn('transactions.type', ['stock_in', 'stock_out'])
            ->where('transactions.status', 'completed');
        $this->applySearch($statsQuery, $search, $dateFrom, $dateTo);

        $totalIn  = (int) (clone $statsQuery)->where('transactions.type', 'stock_in')->sum(DB::raw('ABS(transactions.amount)'));
        $totalOut = (int) (clone $statsQuery)->where('transactions.type', 'stock_out')->sum(DB::raw('ABS(transactions.amount)'));

        if ($sortColumn === 'items.nama') {
            $query->leftJoin('items', 'transactions.item_id', '=', 'items.id')
                  ->select('transactions.*')
                  ->orderBy('items.nama', $sortDir);
        } else {
            $query->orderBy($sortColumn, $sortDir);
        }

        $movements = $query
            ->paginate($perPage)
            ->withQueryString()
            ->through(fn($t) => [
                'id'        => $t->id,
                'date'      => $t->occurred_at?->toISOString(),
                'itemId'    => $t->item_id,
                'itemName'  => $t->item?->nama ?? '(item deleted)',
                'direction' => $t->type === 'stock_in' ? 'IN' : 'OUT',
                'quantity'  => $t->type === 'stock_in' ? (int) abs($t->amount) : -(int) abs($t->amount),
                'party'     => $t->party,
                'reference' => $t->reference,
                'category'  => $t->category,
                'qrcode'    => $t->qrcode,
                'note'      => $t->note,
            ]);

        return Inertia::render('inventory/Stock_History', [
            'movements' => $movements,
            'stats'     => [
                'totalIn'  => $totalIn,
                'totalOut' => $totalOut,
                'net'      => $totalIn - $totalOut,
            ],
            'filters' => array_merge(
                $request->only(['search', 'date_from', 'date_to', 'per_page']),
                ['sort_by' => $requestedSort, 'sort_dir' => $sortDir]
            ),
        ]);
    }

    // -------------------------------------------------------------------------
    // GET: Stock Log page (audit trail)
    // -------------------------------------------------------------------------

    public function log(Request $request)
    {
        $perPage  = $this->sanitizePerPage($request);
        $search   = trim((string) $request->get('search', ''));
        $dateFrom = $request->get('date_from');
        $dateTo   = $request->get('date_to');
        $sortDir  = $this->sanitizeSortDir($request);

        $clientToDb = [
            'date'      => 'transactions.occurred_at',
            'itemName'  => 'items.nama',
            'direction' => 'transactions.type',
            'quantity'  => 'transactions.amount',
            'actor'     => 'transactions.actor',
            'source'    => 'transactions.source',
        ];
        $requestedSort = (string) $request->get('sort_by', 'date');
        $sortColumn    = $clientToDb[$requestedSort] ?? 'transactions.occurred_at';

        $query = Transaction::with('item')
            ->whereIn('transactions.type', ['stock_in', 'stock_out'])
            ->where('transactions.status', 'completed');

        $this->applySearch($query, $search, $dateFrom, $dateTo);

        if ($sortColumn === 'items.nama') {
            $query->leftJoin('items', 'transactions.item_id', '=', 'items.id')
                  ->select('transactions.*')
                  ->orderBy('items.nama', $sortDir);
        } else {
            $query->orderBy($sortColumn, $sortDir);
        }

        $movements = $query
            ->paginate($perPage)
            ->withQueryString()
            ->through(function ($t) {
                $meta = is_array($t->metadata) ? $t->metadata : [];
                return [
                    'id'           => $t->id,
                    'date'         => $t->occurred_at?->toISOString(),
                    'itemId'       => $t->item_id,
                    'itemName'     => $t->item?->nama ?? '(item deleted)',
                    'direction'    => $t->type === 'stock_in' ? 'IN' : 'OUT',
                    'quantity'     => $t->type === 'stock_in' ? (int) abs($t->amount) : -(int) abs($t->amount),
                    'balanceAfter' => isset($meta['balance_after']) ? (int) $meta['balance_after'] : null,
                    'actor'        => $t->actor,
                    'source'       => $t->source,
                    'party'        => $t->party,
                    'reference'    => $t->reference,
                    'category'     => $t->category,
                    'qrcode'       => $t->qrcode,
                    'note'         => $t->note,
                ];
            });

        return Inertia::render('inventory/Stock_Log', [
            'movements' => $movements,
            'filters'   => array_merge(
                $request->only(['search', 'date_from', 'date_to', 'per_page']),
                ['sort_by' => $requestedSort, 'sort_dir' => $sortDir]
            ),
        ]);
    }

    // -------------------------------------------------------------------------
    // POST: Store a new stock movement
    // -------------------------------------------------------------------------

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'type'         => 'required|in:stock_in,stock_out',
            'item_id'      => 'required|integer|exists:items,id',
            'warehouse_id' => 'nullable|integer|exists:warehouses,id',
            'quantity'     => 'required|integer|min:1|max:99999',
            'date'         => 'required|date_format:Y-m-d',
            'party'        => 'nullable|string|max:255',
            'reference'    => 'nullable|string|max:255',
            'source'       => 'nullable|string|max:100',
            'category'     => 'nullable|string|max:100',
            'qrcode'       => 'nullable|string|max:255',
            'note'         => 'nullable|string|max:1000',
        ]);

        if ($validator->fails()) {
            return $request->wantsJson()
                ? response()->json(['errors' => $validator->errors()], 422)
                : back()->withErrors($validator)->withInput();
        }

        $data        = $validator->validated();
        $qty         = (int) $data['quantity'];
        $type        = $data['type'];
        $warehouseId = $this->resolveWarehouseId($data['warehouse_id'] ?? null);

        $errorResponse = null;

        DB::transaction(function () use ($data, $qty, $type, $warehouseId, &$errorResponse) {
            // Lock item for global stock recalculation
            $item = Item::lockForUpdate()->findOrFail($data['item_id']);

            // Get or create the warehouse-specific stock record
            $wi = WarehouseItem::where('warehouse_id', $warehouseId)
                ->where('item_id', $item->id)
                ->lockForUpdate()
                ->first();

            if (!$wi) {
                $wi = WarehouseItem::create([
                    'warehouse_id' => $warehouseId,
                    'item_id'      => $item->id,
                    'stok'         => 0,
                    'stok_minimal' => 0,
                ]);
            }

            if ($type === 'stock_out' && $wi->stok < $qty) {
                $errorResponse = ['quantity' => ["Stok di gudang tidak mencukupi. Stok saat ini: {$wi->stok}"]];
                return;
            }

            $warehouseBalance = $type === 'stock_in' ? $wi->stok + $qty : $wi->stok - $qty;
            $wi->stok = $warehouseBalance;
            $wi->save();

            // Recalculate global item stock as sum of all warehouses
            $globalStock = (int) WarehouseItem::where('item_id', $item->id)->sum('stok');
            $item->stok  = $globalStock;
            $item->save();

            Transaction::create([
                'txn_id'       => 'STK-' . strtoupper(Str::random(10)),
                'item_id'      => $item->id,
                'warehouse_id' => $warehouseId,
                'occurred_at'  => $data['date'] . ' 00:00:00',
                'amount'       => $qty,
                'currency'     => 'unit',
                'status'       => 'completed',
                'type'         => $type,
                'actor'        => Auth::user()?->name ?? 'System',
                'source'       => $data['source'] ?? 'Manual',
                'party'        => $data['party'] ?? null,
                'reference'    => $data['reference'] ?? null,
                'category'     => $data['category'] ?? null,
                'qrcode'       => $data['qrcode'] ?? null,
                'note'         => $data['note'] ?? null,
                'metadata'     => [
                    'balance_after'        => $warehouseBalance,
                    'global_balance_after' => $globalStock,
                ],
            ]);
        });

        if ($errorResponse) {
            return $request->wantsJson()
                ? response()->json(['errors' => $errorResponse], 422)
                : back()->withErrors($errorResponse)->withInput();
        }

        if ($request->wantsJson()) {
            return response()->json(['message' => 'Stock movement recorded'], 201);
        }

        $route = $type === 'stock_in' ? 'Stock_In' : 'Stock_Out';
        return redirect()->route($route)->with('success', 'Data berhasil disimpan.');
    }

    // -------------------------------------------------------------------------
    // PUT: Update an existing stock movement
    // -------------------------------------------------------------------------

    public function update(Request $request, Transaction $transaction)
    {
        if (!in_array($transaction->type, ['stock_in', 'stock_out'])) {
            abort(403, 'Tipe transaksi ini tidak dapat diedit di sini.');
        }

        $validator = Validator::make($request->all(), [
            'item_id'      => 'required|integer|exists:items,id',
            'warehouse_id' => 'nullable|integer|exists:warehouses,id',
            'quantity'     => 'required|integer|min:1|max:99999',
            'date'         => 'required|date_format:Y-m-d',
            'party'        => 'nullable|string|max:255',
            'reference'    => 'nullable|string|max:255',
            'source'       => 'nullable|string|max:100',
            'category'     => 'nullable|string|max:100',
            'qrcode'       => 'nullable|string|max:255',
            'note'         => 'nullable|string|max:1000',
        ]);

        if ($validator->fails()) {
            return $request->wantsJson()
                ? response()->json(['errors' => $validator->errors()], 422)
                : back()->withErrors($validator)->withInput();
        }

        $data           = $validator->validated();
        $newQty         = (int) $data['quantity'];
        $oldQty         = (int) abs($transaction->amount);
        $type           = $transaction->type;
        $oldWarehouseId = $this->resolveWarehouseId($transaction->warehouse_id);
        $newWarehouseId = $this->resolveWarehouseId($data['warehouse_id'] ?? null);
        $warehouseChanged = $oldWarehouseId !== $newWarehouseId;

        $errorResponse = null;

        DB::transaction(function () use (
            $transaction, $data, $newQty, $oldQty, $type,
            $oldWarehouseId, $newWarehouseId, $warehouseChanged, &$errorResponse
        ) {
            $item = Item::lockForUpdate()->findOrFail($data['item_id']);

            // ── Step 1: Validate reversal on the old warehouse ───────────────
            $oldWi = WarehouseItem::where('warehouse_id', $oldWarehouseId)
                ->where('item_id', $item->id)
                ->lockForUpdate()
                ->first();

            $oldStok = $oldWi ? $oldWi->stok : 0;

            // For stock_in: reversing means removing stock from old warehouse.
            // If old warehouse stock < old qty, it means that stock was already
            // consumed by other stock_outs — cannot move the warehouse.
            if ($warehouseChanged && $type === 'stock_in' && $oldStok < $oldQty) {
                $errorResponse = ['warehouse_id' => [
                    "Gudang tidak bisa dipindah. Stok di gudang lama sudah terpakai (tersisa: {$oldStok}, dibutuhkan: {$oldQty} untuk pembalikan)."
                ]];
                return;
            }

            // ── Step 2: Apply the reversal on the old warehouse ──────────────
            if ($oldWi) {
                $oldWi->stok = $type === 'stock_in'
                    ? $oldWi->stok - $oldQty
                    : $oldWi->stok + $oldQty;
                $oldWi->save();
            }

            // ── Step 3: Apply the new transaction on the new warehouse ────────
            $newWi = $warehouseChanged
                ? WarehouseItem::where('warehouse_id', $newWarehouseId)
                    ->where('item_id', $item->id)
                    ->lockForUpdate()
                    ->first()
                : $oldWi; // same warehouse — reuse the already-updated record

            if (!$newWi) {
                $newWi = WarehouseItem::create([
                    'warehouse_id' => $newWarehouseId,
                    'item_id'      => $item->id,
                    'stok'         => 0,
                    'stok_minimal' => 0,
                ]);
            }

            // Re-read stok after reversal (in case $newWi === $oldWi)
            $stockAvailable = $warehouseChanged ? $newWi->stok : $newWi->fresh()->stok;

            // For stock_out: new warehouse must have enough stock
            if ($type === 'stock_out' && $stockAvailable < $newQty) {
                $errorResponse = ['quantity' => ["Stok di gudang tidak mencukupi. Stok tersedia: {$stockAvailable}"]];
                return;
            }

            $newWarehouseBalance = $type === 'stock_in'
                ? $stockAvailable + $newQty
                : $stockAvailable - $newQty;

            $newWi->stok = $newWarehouseBalance;
            $newWi->save();

            // ── Step 4: Recalculate global item stock ─────────────────────────
            $globalStock = (int) WarehouseItem::where('item_id', $item->id)->sum('stok');
            $item->stok  = $globalStock;
            $item->save();

            // ── Step 5: Update the transaction record ─────────────────────────
            $existingMeta = is_array($transaction->metadata) ? $transaction->metadata : [];
            $transaction->update([
                'item_id'      => $data['item_id'],
                'warehouse_id' => $newWarehouseId,
                'occurred_at'  => $data['date'] . ' 00:00:00',
                'amount'       => $newQty,
                'party'        => $data['party'] ?? null,
                'reference'    => $data['reference'] ?? null,
                'source'       => $data['source'] ?? null,
                'category'     => $data['category'] ?? null,
                'qrcode'       => $data['qrcode'] ?? null,
                'note'         => $data['note'] ?? null,
                'metadata'     => array_merge($existingMeta, [
                    'balance_after'        => $newWarehouseBalance,
                    'global_balance_after' => $globalStock,
                ]),
            ]);
        });

        if ($errorResponse) {
            return $request->wantsJson()
                ? response()->json(['errors' => $errorResponse], 422)
                : back()->withErrors($errorResponse)->withInput();
        }

        if ($request->wantsJson()) {
            return response()->json(['message' => 'Stock movement updated'], 200);
        }

        $route = $type === 'stock_in' ? 'Stock_In' : 'Stock_Out';
        return redirect()->route($route)->with('success', 'Data berhasil diperbarui.');
    }

    // -------------------------------------------------------------------------
    // DELETE: Remove a stock movement and reverse the stock change
    // -------------------------------------------------------------------------

    public function destroy(Request $request, Transaction $transaction)
    {
        if (!in_array($transaction->type, ['stock_in', 'stock_out'])) {
            abort(403, 'Tipe transaksi ini tidak dapat dihapus di sini.');
        }

        $type        = $transaction->type;
        $qty         = (int) abs($transaction->amount);
        $warehouseId = $transaction->warehouse_id;

        DB::transaction(function () use ($transaction, $type, $qty, $warehouseId) {
            if ($transaction->item_id) {
                $item = Item::lockForUpdate()->find($transaction->item_id);
                if ($item) {
                    if ($warehouseId) {
                        $wi = WarehouseItem::where('warehouse_id', $warehouseId)
                            ->where('item_id', $item->id)
                            ->lockForUpdate()
                            ->first();
                        if ($wi) {
                            $wi->stok = $type === 'stock_in'
                                ? max(0, $wi->stok - $qty)
                                : $wi->stok + $qty;
                            $wi->save();
                        }
                        $item->stok = (int) WarehouseItem::where('item_id', $item->id)->sum('stok');
                    } else {
                        // Legacy: resolve to default warehouse and sync
                        $fallbackWhId = $this->resolveWarehouseId(null);
                        $wi = WarehouseItem::where('warehouse_id', $fallbackWhId)
                            ->where('item_id', $item->id)
                            ->lockForUpdate()
                            ->first();
                        if ($wi) {
                            $wi->stok = $type === 'stock_in'
                                ? max(0, $wi->stok - $qty)
                                : $wi->stok + $qty;
                            $wi->save();
                            $item->stok = (int) WarehouseItem::where('item_id', $item->id)->sum('stok');
                        } else {
                            $item->stok = $type === 'stock_in'
                                ? max(0, $item->stok - $qty)
                                : $item->stok + $qty;
                        }
                    }
                    $item->save();
                }
            }
            $transaction->delete();
        });

        if ($request->wantsJson()) {
            return response()->json(['message' => 'Stock movement deleted'], 200);
        }

        $route = $type === 'stock_in' ? 'Stock_In' : 'Stock_Out';
        return redirect()->route($route)->with('success', 'Data berhasil dihapus.');
    }
}
