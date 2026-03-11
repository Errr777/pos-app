<?php

namespace App\Http\Controllers;

use App\Models\Item;
use App\Models\Kategori;
use App\Models\SaleHeader;
use App\Models\SaleItem;
use App\Models\Transaction;
use App\Models\WarehouseItem;
use App\Traits\FiltersWarehouseByUser;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class DashboardController extends Controller
{
    use FiltersWarehouseByUser;

    public function index()
    {
        $now        = now();
        $todayStart = $now->copy()->startOfDay();
        $todayEnd   = $now->copy()->endOfDay();
        $monthStart = $now->copy()->startOfMonth();
        $monthEnd   = $now->copy()->endOfMonth();

        $allowedIds = $this->allowedWarehouseIds(); // empty = all warehouses

        // ── KPI ─────────────────────────────────────────────────────────────
        $totalItems      = Item::count();
        $lowStockCount   = Item::whereColumn('stok', '<', 'stok_minimal')->count();
        $itemsWithNoMinimum = Item::where('stok_minimal', 0)->count();
        $categoriesCount = Kategori::count();

        $salesToday = (int) SaleHeader::where('status', 'completed')
            ->whereBetween('occurred_at', [$todayStart, $todayEnd])
            ->when(!empty($allowedIds), fn($q) => $q->whereIn('warehouse_id', $allowedIds))
            ->sum('grand_total');

        $salesThisMonth = (int) SaleHeader::where('status', 'completed')
            ->whereBetween('occurred_at', [$monthStart, $monthEnd])
            ->when(!empty($allowedIds), fn($q) => $q->whereIn('warehouse_id', $allowedIds))
            ->sum('grand_total');

        // Net revenue = sales - purchase cost of items sold this month
        $costThisMonth = (int) SaleItem::whereHas('saleHeader', fn($q) =>
            $q->where('status', 'completed')
              ->whereBetween('occurred_at', [$monthStart, $monthEnd])
              ->when(!empty($allowedIds), fn($q2) => $q2->whereIn('warehouse_id', $allowedIds))
        )->join('items', 'items.id', '=', 'sale_items.item_id')
         ->sum(DB::raw('sale_items.quantity * items.harga_beli'));

        $netRevenueThisMonth = $salesThisMonth - $costThisMonth;

        // ── Chart: daily sales last 7 days ────────────────────────────────
        $sevenDaysAgo = $now->copy()->subDays(6)->startOfDay();
        $dailySales = SaleHeader::where('status', 'completed')
            ->whereBetween('occurred_at', [$sevenDaysAgo, $todayEnd])
            ->when(!empty($allowedIds), fn($q) => $q->whereIn('warehouse_id', $allowedIds))
            ->selectRaw("DATE(occurred_at) as date, SUM(grand_total) as total, COUNT(*) as count")
            ->groupBy('date')
            ->orderBy('date')
            ->get()
            ->keyBy('date');

        $salesChart = [];
        for ($i = 6; $i >= 0; $i--) {
            $date = $now->copy()->subDays($i)->format('Y-m-d');
            $salesChart[] = [
                'date'  => $now->copy()->subDays($i)->format('d/m'),
                'total' => (int) ($dailySales[$date]->total ?? 0),
                'count' => (int) ($dailySales[$date]->count ?? 0),
            ];
        }

        // ── Chart: top 5 items sold this month ───────────────────────────
        $topItems = SaleItem::whereHas('saleHeader', fn($q) =>
            $q->where('status', 'completed')
              ->whereBetween('occurred_at', [$monthStart, $monthEnd])
              ->when(!empty($allowedIds), fn($q2) => $q2->whereIn('warehouse_id', $allowedIds))
        )->selectRaw('item_name_snapshot as name, SUM(quantity) as qty')
         ->groupBy('item_name_snapshot')
         ->orderByDesc('qty')
         ->limit(5)
         ->get()
         ->map(fn($r) => ['name' => $r->name, 'qty' => (int) $r->qty])
         ->toArray();

        // ── Recent sales ─────────────────────────────────────────────────
        $recentSales = SaleHeader::with('cashier')
            ->where('status', 'completed')
            ->when(!empty($allowedIds), fn($q) => $q->whereIn('warehouse_id', $allowedIds))
            ->orderByDesc('occurred_at')
            ->limit(8)
            ->get()
            ->map(fn($s) => [
                'id'          => $s->id,
                'saleNumber'  => $s->sale_number,
                'cashier'     => $s->cashier?->name ?? '-',
                'grandTotal'  => $s->grand_total,
                'occurredAt'  => $s->occurred_at?->format('d/m H:i'),
            ]);

        // ── Low stock alert ──────────────────────────────────────────────
        if (!empty($allowedIds)) {
            $lowStockItems = WarehouseItem::whereIn('warehouse_id', $allowedIds)
                ->whereColumn('warehouse_items.stok', '<', 'warehouse_items.stok_minimal')
                ->where('warehouse_items.stok_minimal', '>', 0)
                ->join('items', 'items.id', '=', 'warehouse_items.item_id')
                ->select('items.id', 'items.nama', 'warehouse_items.stok', 'warehouse_items.stok_minimal')
                ->orderByRaw('warehouse_items.stok_minimal - warehouse_items.stok DESC')
                ->limit(8)
                ->get()
                ->map(fn($i) => [
                    'id'      => $i->id,
                    'name'    => $i->nama,
                    'stock'   => (int) $i->stok,
                    'minimum' => (int) $i->stok_minimal,
                    'deficit' => (int) $i->stok_minimal - (int) $i->stok,
                ]);
        } else {
            $lowStockItems = Item::whereColumn('stok', '<', 'stok_minimal')
                ->select('id', 'nama', 'stok', 'stok_minimal')
                ->orderByRaw('stok_minimal - stok DESC')
                ->limit(8)
                ->get()
                ->map(fn($i) => [
                    'id'      => $i->id,
                    'name'    => $i->nama,
                    'stock'   => $i->stok,
                    'minimum' => $i->stok_minimal,
                    'deficit' => $i->stok_minimal - $i->stok,
                ]);
        }

        // Per-branch stats — only for admins (no warehouse restriction)
        $branchStats = null;
        if (empty($allowedIds)) {
            $branchStats = \App\Models\Warehouse::where('is_active', true)
                ->orderBy('is_default', 'desc')
                ->orderBy('name')
                ->get()
                ->map(function ($w) use ($todayStart, $todayEnd, $monthStart, $monthEnd) {
                    return [
                        'id'         => $w->id,
                        'name'       => $w->name,
                        'city'       => $w->city,
                        'salesToday' => (int) SaleHeader::where('warehouse_id', $w->id)
                            ->where('status', 'completed')
                            ->whereBetween('occurred_at', [$todayStart, $todayEnd])
                            ->sum('grand_total'),
                        'salesMonth' => (int) SaleHeader::where('warehouse_id', $w->id)
                            ->where('status', 'completed')
                            ->whereBetween('occurred_at', [$monthStart, $monthEnd])
                            ->sum('grand_total'),
                        'trxToday'   => (int) SaleHeader::where('warehouse_id', $w->id)
                            ->where('status', 'completed')
                            ->whereBetween('occurred_at', [$todayStart, $todayEnd])
                            ->count(),
                    ];
                })->all();
        }

        return Inertia::render('dashboard', [
            'stats' => [
                'totalItems'         => $totalItems,
                'lowStockCount'      => $lowStockCount,
                'itemsWithNoMinimum' => $itemsWithNoMinimum,
                'categoriesCount'    => $categoriesCount,
                'salesToday'         => $salesToday,
                'salesThisMonth'     => $salesThisMonth,
                'netRevenueThisMonth'=> $netRevenueThisMonth,
            ],
            'salesChart'      => $salesChart,
            'topItems'        => $topItems,
            'recentSales'     => $recentSales,
            'lowStockItems'   => $lowStockItems,
            'warehouseContext' => !empty($allowedIds)
                ? \App\Models\Warehouse::whereIn('id', $allowedIds)->pluck('name')->implode(', ')
                : null,
            'branchStats' => $branchStats,
        ]);
    }
}
