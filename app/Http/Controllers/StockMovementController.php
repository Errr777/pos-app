<?php

namespace App\Http\Controllers;

use App\Models\Item;
use App\Models\Transaction;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Inertia\Inertia;

class StockMovementController extends Controller
{
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
    private function itemOptions(): \Illuminate\Support\Collection
    {
        return Item::select('id', 'nama', 'kategori', 'stok', 'kode_item')
            ->orderBy('nama')
            ->get()
            ->map(fn($i) => [
                'id'       => $i->id,
                'name'     => $i->nama,
                'category' => $i->kategori,
                'stock'    => $i->stok,
                'kode'     => $i->kode_item,
            ]);
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
            'supplier'  => 'transactions.party',
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
                'id'        => $t->id,
                'date'      => $t->occurred_at?->toISOString(),
                'itemId'    => $t->item_id,
                'itemName'  => $t->item?->nama ?? '(item deleted)',
                'quantity'  => (int) abs($t->amount),
                'supplier'  => $t->party,
                'reference' => $t->reference,
                'qrcode'    => $t->qrcode,
                'note'      => $t->note,
            ]);

        return Inertia::render('inventory/Stock_In', [
            'movements' => $movements,
            'items'     => $this->itemOptions(),
            'totalQty'  => (int) $totalQty,
            'filters'   => array_merge(
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
            'receiver'  => 'transactions.party',
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
                'id'        => $t->id,
                'date'      => $t->occurred_at?->toISOString(),
                'itemId'    => $t->item_id,
                'itemName'  => $t->item?->nama ?? '(item deleted)',
                'quantity'  => (int) abs($t->amount),
                'receiver'  => $t->party,
                'reference' => $t->reference,
                'qrcode'    => $t->qrcode,
                'note'      => $t->note,
            ]);

        return Inertia::render('inventory/Stock_Out', [
            'movements' => $movements,
            'items'     => $this->itemOptions(),
            'totalQty'  => (int) $totalQty,
            'filters'   => array_merge(
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
            'type'      => 'required|in:stock_in,stock_out',
            'item_id'   => 'required|integer|exists:items,id',
            'quantity'  => 'required|integer|min:1|max:99999',
            'date'      => 'required|date_format:Y-m-d',
            'party'     => 'nullable|string|max:255',
            'reference' => 'nullable|string|max:255',
            'source'    => 'nullable|string|max:100',
            'category'  => 'nullable|string|max:100',
            'qrcode'    => 'nullable|string|max:255',
            'note'      => 'nullable|string|max:1000',
        ]);

        if ($validator->fails()) {
            return $request->wantsJson()
                ? response()->json(['errors' => $validator->errors()], 422)
                : back()->withErrors($validator)->withInput();
        }

        $data = $validator->validated();
        $qty  = (int) $data['quantity'];
        $type = $data['type'];

        $errorResponse = null;

        DB::transaction(function () use ($data, $qty, $type, $request, &$errorResponse) {
            $item = Item::lockForUpdate()->findOrFail($data['item_id']);

            if ($type === 'stock_out' && $item->stok < $qty) {
                $errorResponse = ['quantity' => ["Stok tidak mencukupi. Stok saat ini: {$item->stok}"]];
                return;
            }

            $newBalance = $type === 'stock_in' ? $item->stok + $qty : $item->stok - $qty;

            Transaction::create([
                'txn_id'      => 'STK-' . strtoupper(Str::random(10)),
                'item_id'     => $item->id,
                'occurred_at' => $data['date'] . ' 00:00:00',
                'amount'      => $qty,
                'currency'    => 'unit',
                'status'      => 'completed',
                'type'        => $type,
                'actor'       => Auth::user()?->name ?? 'System',
                'source'      => $data['source'] ?? 'Manual',
                'party'       => $data['party'] ?? null,
                'reference'   => $data['reference'] ?? null,
                'category'    => $data['category'] ?? null,
                'qrcode'      => $data['qrcode'] ?? null,
                'note'        => $data['note'] ?? null,
                'metadata'    => ['balance_after' => $newBalance],
            ]);

            $item->stok = $newBalance;
            $item->save();
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
            'item_id'   => 'required|integer|exists:items,id',
            'quantity'  => 'required|integer|min:1|max:99999',
            'date'      => 'required|date_format:Y-m-d',
            'party'     => 'nullable|string|max:255',
            'reference' => 'nullable|string|max:255',
            'source'    => 'nullable|string|max:100',
            'category'  => 'nullable|string|max:100',
            'qrcode'    => 'nullable|string|max:255',
            'note'      => 'nullable|string|max:1000',
        ]);

        if ($validator->fails()) {
            return $request->wantsJson()
                ? response()->json(['errors' => $validator->errors()], 422)
                : back()->withErrors($validator)->withInput();
        }

        $data   = $validator->validated();
        $newQty = (int) $data['quantity'];
        $oldQty = (int) abs($transaction->amount);
        $type   = $transaction->type;

        $errorResponse = null;

        DB::transaction(function () use ($transaction, $data, $newQty, $oldQty, $type, &$errorResponse) {
            $item = Item::lockForUpdate()->findOrFail($data['item_id']);

            // Reverse old effect
            $stockAfterReversal = $type === 'stock_in'
                ? $item->stok - $oldQty
                : $item->stok + $oldQty;

            // Validate new effect
            if ($type === 'stock_out' && $stockAfterReversal < $newQty) {
                $errorResponse = ['quantity' => ['Stok tidak mencukupi setelah penyesuaian.']];
                return;
            }

            $newBalance = $type === 'stock_in'
                ? $stockAfterReversal + $newQty
                : $stockAfterReversal - $newQty;

            $existingMeta = is_array($transaction->metadata) ? $transaction->metadata : [];

            $transaction->update([
                'item_id'     => $data['item_id'],
                'occurred_at' => $data['date'] . ' 00:00:00',
                'amount'      => $newQty,
                'party'       => $data['party'] ?? null,
                'reference'   => $data['reference'] ?? null,
                'source'      => $data['source'] ?? null,
                'category'    => $data['category'] ?? null,
                'qrcode'      => $data['qrcode'] ?? null,
                'note'        => $data['note'] ?? null,
                'metadata'    => array_merge($existingMeta, ['balance_after' => $newBalance]),
            ]);

            $item->stok = $newBalance;
            $item->save();
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

        $type = $transaction->type;
        $qty  = (int) abs($transaction->amount);

        DB::transaction(function () use ($transaction, $type, $qty) {
            if ($transaction->item_id) {
                $item = Item::lockForUpdate()->find($transaction->item_id);
                if ($item) {
                    $item->stok = $type === 'stock_in'
                        ? max(0, $item->stok - $qty)
                        : $item->stok + $qty;
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
