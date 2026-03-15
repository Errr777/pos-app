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
        if (!request()->user()->hasPermission('dashboard', 'can_view')) {
            abort(403);
        }

        $now        = now();
        $todayStart = $now->copy()->startOfDay();
        $todayEnd   = $now->copy()->endOfDay();

        // ── Month filter ─────────────────────────────────────────────────
        $requestedMonth = request('month', $now->format('Y-m'));
        if (!preg_match('/^\d{4}-\d{2}$/', $requestedMonth)) {
            $requestedMonth = $now->format('Y-m');
        }
        $selectedDate   = \Carbon\Carbon::createFromFormat('Y-m', $requestedMonth)->startOfMonth();
        $monthStart     = $selectedDate->copy()->startOfMonth();
        $monthEnd       = $selectedDate->copy()->endOfMonth();
        $isCurrentMonth = $requestedMonth === $now->format('Y-m');

        // Build list of available months (from first sale up to now)
        $minSaleDate = SaleHeader::min('occurred_at');
        $minMonth    = $minSaleDate
            ? \Carbon\Carbon::parse($minSaleDate)->startOfMonth()
            : $now->copy()->subMonths(12)->startOfMonth();
        $availableMonths = [];
        $cursor = $minMonth->copy();
        while ($cursor->lte($now->copy()->startOfMonth())) {
            $availableMonths[] = [
                'value' => $cursor->format('Y-m'),
                'label' => $cursor->format('M Y'),
            ];
            $cursor->addMonth();
        }
        $availableMonths = array_reverse($availableMonths);

        $allowedIds = $this->allowedWarehouseIds(); // empty = all warehouses

        // ── KPI ─────────────────────────────────────────────────────────────
        $totalItems      = Item::count();
        $lowStockCount   = Item::where('type', 'barang')->whereColumn('stok', '<', 'stok_minimal')->count();
        $itemsWithNoMinimum = Item::where('type', 'barang')->where('stok_minimal', 0)->count();
        $categoriesCount = Kategori::count();

        $salesToday = $isCurrentMonth
            ? (int) SaleHeader::where('status', 'completed')
                ->whereBetween('occurred_at', [$todayStart, $todayEnd])
                ->when(!empty($allowedIds), fn($q) => $q->whereIn('warehouse_id', $allowedIds))
                ->sum('grand_total')
            : 0;

        $transactionCountMonth = (int) SaleHeader::where('status', 'completed')
            ->whereBetween('occurred_at', [$monthStart, $monthEnd])
            ->when(!empty($allowedIds), fn($q) => $q->whereIn('warehouse_id', $allowedIds))
            ->count();

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

        // ── Chart: daily sales ────────────────────────────────────────────
        // Current month → last 7 days; past month → full month daily
        if ($isCurrentMonth) {
            $chartStart = $now->copy()->subDays(6)->startOfDay();
            $chartEnd   = $todayEnd;
        } else {
            $chartStart = $monthStart->copy();
            $chartEnd   = $monthEnd->copy();
        }

        $dailySalesRaw = SaleHeader::where('status', 'completed')
            ->whereBetween('occurred_at', [$chartStart, $chartEnd])
            ->when(!empty($allowedIds), fn($q) => $q->whereIn('warehouse_id', $allowedIds))
            ->selectRaw("DATE(occurred_at) as date, SUM(grand_total) as total, COUNT(*) as count")
            ->groupBy('date')
            ->orderBy('date')
            ->get()
            ->keyBy('date');

        $salesChart = [];
        $cursor = $chartStart->copy()->startOfDay();
        while ($cursor->lte($chartEnd)) {
            $date = $cursor->format('Y-m-d');
            $salesChart[] = [
                'date'  => $cursor->format('d/m'),
                'total' => (int) ($dailySalesRaw[$date]->total ?? 0),
                'count' => (int) ($dailySalesRaw[$date]->count ?? 0),
            ];
            $cursor->addDay();
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

        // ── Recent sales (within selected month) ─────────────────────────
        $recentSales = SaleHeader::with('cashier')
            ->where('status', 'completed')
            ->whereBetween('occurred_at', [$monthStart, $monthEnd])
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

        // ── Top 5 Products (today if current month, else full month) ──────
        $topProductsPeriod = $isCurrentMonth
            ? [$todayStart, $todayEnd]
            : [$monthStart, $monthEnd];

        $topProducts = SaleItem::whereHas('saleHeader', fn($q) =>
            $q->where('status', 'completed')
              ->whereBetween('occurred_at', $topProductsPeriod)
              ->when(!empty($allowedIds), fn($q2) => $q2->whereIn('warehouse_id', $allowedIds))
        )->selectRaw('item_name_snapshot as name, SUM(quantity) as qty_sold, SUM(line_total) as revenue')
         ->groupBy('item_name_snapshot')
         ->orderByDesc('qty_sold')
         ->limit(5)
         ->get()
         ->map(fn($r) => [
             'name'    => $r->name,
             'qtySold' => (int) $r->qty_sold,
             'revenue' => (int) $r->revenue,
         ])->toArray();

        // ── Recent Transactions (last 5 within selected month) ───────────
        $recentTransactions = SaleHeader::with('cashier')
            ->where('status', 'completed')
            ->whereBetween('occurred_at', [$monthStart, $monthEnd])
            ->when(!empty($allowedIds), fn($q) => $q->whereIn('warehouse_id', $allowedIds))
            ->orderByDesc('occurred_at')
            ->limit(5)
            ->get()
            ->map(fn($s) => [
                'id'          => $s->id,
                'saleNumber'  => $s->sale_number,
                'occurredAt'  => $s->occurred_at?->format('d/m H:i'),
                'cashierName' => $s->cashier?->name ?? '-',
                'grandTotal'  => $s->grand_total,
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

        // ── Stock Alerts (count + first 5 with outlet name) ───────────────
        if (!empty($allowedIds)) {
            $stockAlertCount = WarehouseItem::whereIn('warehouse_id', $allowedIds)
                ->whereColumn('warehouse_items.stok', '<', 'warehouse_items.stok_minimal')
                ->where('warehouse_items.stok_minimal', '>', 0)
                ->count();

            $stockAlertItems = WarehouseItem::whereIn('warehouse_id', $allowedIds)
                ->whereColumn('warehouse_items.stok', '<', 'warehouse_items.stok_minimal')
                ->where('warehouse_items.stok_minimal', '>', 0)
                ->join('items',      'items.id',      '=', 'warehouse_items.item_id')
                ->join('warehouses', 'warehouses.id', '=', 'warehouse_items.warehouse_id')
                ->select('items.nama', 'warehouse_items.stok', 'warehouse_items.stok_minimal', 'warehouses.name as outlet_name')
                ->orderByRaw('warehouse_items.stok_minimal - warehouse_items.stok DESC')
                ->limit(5)
                ->get()
                ->map(fn($i) => [
                    'name'       => $i->nama,
                    'stock'      => (int) $i->stok,
                    'stockMin'   => (int) $i->stok_minimal,
                    'outletName' => $i->outlet_name,
                ])->toArray();
        } else {
            $stockAlertCount = Item::whereColumn('stok', '<', 'stok_minimal')
                ->where('stok_minimal', '>', 0)->count();

            $stockAlertItems = Item::whereColumn('stok', '<', 'stok_minimal')
                ->where('stok_minimal', '>', 0)
                ->select('nama', 'stok', 'stok_minimal')
                ->orderByRaw('stok_minimal - stok DESC')
                ->limit(5)
                ->get()
                ->map(fn($i) => [
                    'name'       => $i->nama,
                    'stock'      => (int) $i->stok,
                    'stockMin'   => (int) $i->stok_minimal,
                    'outletName' => null,
                ])->toArray();
        }

        $stockAlerts = ['count' => $stockAlertCount, 'items' => $stockAlertItems];

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
                'totalItems'            => $totalItems,
                'lowStockCount'         => $lowStockCount,
                'itemsWithNoMinimum'    => $itemsWithNoMinimum,
                'categoriesCount'       => $categoriesCount,
                'salesToday'            => $salesToday,
                'salesThisMonth'        => $salesThisMonth,
                'netRevenueThisMonth'   => $netRevenueThisMonth,
                'transactionCountMonth' => $transactionCountMonth,
            ],
            'salesChart'          => $salesChart,
            'topItems'            => $topItems,
            'recentSales'         => $recentSales,
            'lowStockItems'       => $lowStockItems,
            'revenueTrend'        => array_map(fn($p) => ['date' => $p['date'], 'revenue' => $p['total']], $salesChart),
            'topProducts'         => $topProducts,
            'recentTransactions'  => $recentTransactions,
            'stockAlerts'         => $stockAlerts,
            'warehouseContext' => !empty($allowedIds)
                ? \App\Models\Warehouse::whereIn('id', $allowedIds)->pluck('name')->implode(', ')
                : null,
            'branchStats'         => $branchStats,
            'selectedMonth'       => $requestedMonth,
            'isCurrentMonth'      => $isCurrentMonth,
            'availableMonths'     => $availableMonths,
        ]);
    }
}
