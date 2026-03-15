<?php

namespace App\Http\Controllers;

use App\Models\StockAdjustment;
use App\Models\StockOpname;
use App\Models\StockOpnameItem;
use App\Models\Warehouse;
use App\Models\WarehouseItem;
use App\Traits\FiltersWarehouseByUser;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class StockOpnameController extends Controller
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
        $perPage = in_array((int) $request->get('per_page', 20), [10, 20, 50]) ? (int) $request->get('per_page', 20) : 20;

        $query = StockOpname::with('warehouse')
            ->orderBy('created_at', 'desc');

        $this->applyWarehouseFilter($query, 'warehouse_id');

        $opnames = $query->paginate($perPage)->withQueryString()->through(fn($o) => [
            'id'          => $o->id,
            'refNumber'   => $o->ref_number,
            'warehouseId' => $o->warehouse_id,
            'warehouse'   => $o->warehouse?->name ?? '-',
            'date'        => $o->date?->format('Y-m-d'),
            'status'      => $o->status,
            'createdBy'   => $o->created_by,
            'submittedAt' => $o->submitted_at?->format('d/m/Y H:i'),
            'itemCount'   => $o->items()->count(),
        ]);

        $warehouseQuery = Warehouse::where('is_active', true)->orderBy('name');
        $this->applyWarehouseFilter($warehouseQuery, 'id');
        $warehouses = $warehouseQuery->get()->map(fn($w) => ['id' => $w->id, 'name' => $w->name]);

        return Inertia::render('inventory/Stock_Opname', [
            'opnames'    => $opnames,
            'warehouses' => $warehouses,
            'filters'    => $request->only(['per_page']),
        ]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'warehouse_id' => 'required|integer|exists:warehouses,id',
            'date'         => 'required|date_format:Y-m-d',
            'note'         => 'nullable|string|max:1000',
        ]);

        $ref = 'OPN-' . now()->format('Ymd') . '-' . strtoupper(substr(uniqid(), -4));

        $opname = DB::transaction(function () use ($data, $ref) {
            $opname = StockOpname::create([
                'ref_number'   => $ref,
                'warehouse_id' => $data['warehouse_id'],
                'status'       => 'draft',
                'date'         => $data['date'],
                'note'         => $data['note'] ?? null,
                'created_by'   => Auth::user()?->name ?? 'System',
            ]);

            $warehouseItems = WarehouseItem::with('item')
                ->where('warehouse_id', $data['warehouse_id'])
                ->get();

            foreach ($warehouseItems as $wi) {
                if (!$wi->item) continue;
                StockOpnameItem::create([
                    'opname_id'          => $opname->id,
                    'item_id'            => $wi->item_id,
                    'item_name_snapshot' => $wi->item->nama,
                    'item_code_snapshot' => $wi->item->kode_item,
                    'system_qty'         => $wi->stok,
                    'actual_qty'         => null,
                    'variance'           => null,
                ]);
            }

            return $opname;
        });

        return redirect()->route('opname.show', $opname->id)
            ->with('success', "Sesi stock opname {$ref} dimulai.");
    }

    public function show(StockOpname $opname)
    {
        $opname->load(['warehouse', 'items.item']);

        $rows = $opname->items->sortBy('item_name_snapshot')->map(fn($oi) => [
            'id'        => $oi->id,
            'itemId'    => $oi->item_id,
            'name'      => $oi->item_name_snapshot,
            'code'      => $oi->item_code_snapshot,
            'systemQty' => $oi->system_qty,
            'actualQty' => $oi->actual_qty,
            'variance'  => $oi->variance,
            'note'      => $oi->note,
        ])->values()->all();

        return Inertia::render('inventory/Stock_Opname_Detail', [
            'opname' => [
                'id'        => $opname->id,
                'refNumber' => $opname->ref_number,
                'warehouse' => $opname->warehouse?->name,
                'date'      => $opname->date?->format('Y-m-d'),
                'status'    => $opname->status,
                'note'      => $opname->note,
                'createdBy' => $opname->created_by,
            ],
            'rows' => $rows,
        ]);
    }

    public function updateItems(Request $request, StockOpname $opname)
    {
        if ($opname->status !== 'draft') {
            return back()->with('error', 'Opname sudah disubmit, tidak dapat diubah.');
        }

        $data = $request->validate([
            'items'              => 'required|array',
            'items.*.id'         => 'required|integer|exists:stock_opname_items,id',
            'items.*.actual_qty' => 'nullable|integer|min:0',
            'items.*.note'       => 'nullable|string|max:500',
        ]);

        DB::transaction(function () use ($data) {
            foreach ($data['items'] as $row) {
                $oi = StockOpnameItem::findOrFail($row['id']);
                $actual = isset($row['actual_qty']) && $row['actual_qty'] !== null ? (int) $row['actual_qty'] : null;
                $oi->update([
                    'actual_qty' => $actual,
                    'variance'   => $actual !== null ? $actual - $oi->system_qty : null,
                    'note'       => $row['note'] ?? null,
                ]);
            }
        });

        return back()->with('success', 'Data hitungan disimpan.');
    }

    public function submit(StockOpname $opname)
    {
        if ($opname->status !== 'draft') {
            return back()->with('error', 'Opname sudah disubmit.');
        }

        $opname->load('items.item');
        $uncounted = $opname->items->whereNull('actual_qty');
        if ($uncounted->count() > 0) {
            return back()->with('error', "Masih ada {$uncounted->count()} item belum dihitung.");
        }

        DB::transaction(function () use ($opname) {
            foreach ($opname->items as $oi) {
                if ($oi->variance === 0 || $oi->item === null) continue;

                $wi = WarehouseItem::where('warehouse_id', $opname->warehouse_id)
                    ->where('item_id', $oi->item_id)
                    ->first();

                if ($wi) {
                    $wi->stok = $oi->actual_qty;
                    $wi->save();
                }

                $oi->item->stok = (int) WarehouseItem::where('item_id', $oi->item_id)->sum('stok');
                $oi->item->save();

                StockAdjustment::create([
                    'txn_id'       => 'OPN-' . strtoupper(substr(uniqid(), -8)),
                    'warehouse_id' => $opname->warehouse_id,
                    'item_id'      => $oi->item_id,
                    'old_quantity' => $oi->system_qty,
                    'new_quantity' => $oi->actual_qty,
                    'difference'   => $oi->variance,
                    'reason'       => 'Stok Opname',
                    'actor'        => $opname->created_by ?? Auth::user()?->name ?? 'System',
                    'occurred_at'  => $opname->date->toDateTimeString(),
                    'note'         => "Ref: {$opname->ref_number}",
                ]);
            }

            $opname->update([
                'status'       => 'submitted',
                'submitted_at' => now(),
            ]);
        });

        return redirect()->route('opname.index')
            ->with('success', "Opname {$opname->ref_number} disubmit. Stok diperbarui.");
    }

    public function destroy(StockOpname $opname)
    {
        if ($opname->status !== 'draft') {
            return back()->with('error', 'Hanya opname draft yang bisa dihapus.');
        }
        $opname->delete();
        return redirect()->route('opname.index')->with('success', 'Opname dihapus.');
    }
}
