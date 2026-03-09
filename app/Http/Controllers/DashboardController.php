<?php

namespace App\Http\Controllers;

use App\Models\Item;
use App\Models\Kategori;
use App\Models\SaleHeader;
use App\Models\SaleItem;
use App\Models\Transaction;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class DashboardController extends Controller
{
    public function index()
    {
        $now        = now();
        $todayStart = $now->copy()->startOfDay();
        $todayEnd   = $now->copy()->endOfDay();
        $monthStart = $now->copy()->startOfMonth();
        $monthEnd   = $now->copy()->endOfMonth();

        // ── KPI ─────────────────────────────────────────────────────────────
        $totalItems      = Item::count();
        $lowStockCount   = Item::whereColumn('stok', '<', 'stok_minimal')->count();
        $categoriesCount = Kategori::count();

        $salesToday = (int) SaleHeader::where('status', 'completed')
            ->whereBetween('occurred_at', [$todayStart, $todayEnd])
            ->sum('grand_total');

        $salesThisMonth = (int) SaleHeader::where('status', 'completed')
            ->whereBetween('occurred_at', [$monthStart, $monthEnd])
            ->sum('grand_total');

        // Net revenue = sales - purchase cost of items sold this month
        $costThisMonth = (int) SaleItem::whereHas('saleHeader', fn($q) =>
            $q->where('status', 'completed')
              ->whereBetween('occurred_at', [$monthStart, $monthEnd])
        )->join('items', 'items.id', '=', 'sale_items.item_id')
         ->sum(DB::raw('sale_items.quantity * items.harga_beli'));

        $netRevenueThisMonth = $salesThisMonth - $costThisMonth;

        // ── Chart: daily sales last 7 days ────────────────────────────────
        $sevenDaysAgo = $now->copy()->subDays(6)->startOfDay();
        $dailySales = SaleHeader::where('status', 'completed')
            ->whereBetween('occurred_at', [$sevenDaysAgo, $todayEnd])
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

        return Inertia::render('dashboard', [
            'stats' => [
                'totalItems'         => $totalItems,
                'lowStockCount'      => $lowStockCount,
                'categoriesCount'    => $categoriesCount,
                'salesToday'         => $salesToday,
                'salesThisMonth'     => $salesThisMonth,
                'netRevenueThisMonth'=> $netRevenueThisMonth,
            ],
            'salesChart'    => $salesChart,
            'topItems'      => $topItems,
            'recentSales'   => $recentSales,
            'lowStockItems' => $lowStockItems,
        ]);
    }
}
