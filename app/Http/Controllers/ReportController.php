<?php

namespace App\Http\Controllers;

use App\Exports\AbcAnalysisExport;
use App\Exports\BranchComparisonExport;
use App\Exports\CashflowExport;
use App\Exports\PeakHoursExport;
use App\Exports\SalesReportExport;
use App\Exports\StockReportExport;
use App\Models\Expense;
use App\Models\Item;
use App\Models\ReturnHeader;
use App\Models\SaleHeader;
use App\Models\SaleItem;
use App\Traits\FiltersWarehouseByUser;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Maatwebsite\Excel\Facades\Excel;

class ReportController extends Controller
{
    use FiltersWarehouseByUser;

    public function __construct()
    {
        $this->middleware(function ($request, $next) {
            if (! $request->user()->hasPermission('reports', 'can_view')) {
                abort(403);
            }

            return $next($request);
        });
    }

    private function allowedPerPage(): array
    {
        return [10, 20, 50, 100];
    }

    private function sanitizePerPage(Request $request, int $default = 20): int
    {
        $pp = (int) $request->get('per_page', $default);

        return in_array($pp, $this->allowedPerPage(), true) ? $pp : $default;
    }

    private function sanitizeSortDir(Request $request, string $default = 'asc'): string
    {
        return strtolower($request->get('sort_dir', $default)) === 'desc' ? 'desc' : 'asc';
    }

    /** Returns active warehouses as [{id, name}] arrays, cached for 5 minutes. */
    private function getActiveWarehouses(array $allowedIds = []): \Illuminate\Support\Collection
    {
        $sortedIds = $allowedIds;
        sort($sortedIds);
        $cacheKey = 'active_warehouses_mapped'.(empty($sortedIds) ? '' : '_'.implode('_', $sortedIds));

        return \Illuminate\Support\Facades\Cache::remember($cacheKey, 300, function () use ($sortedIds) {
            $q = \App\Models\Warehouse::where('is_active', true)->orderBy('name');
            if (! empty($sortedIds)) {
                $q->whereIn('id', $sortedIds);
            }

            return $q->get(['id', 'name'])->map(fn ($w) => ['id' => hid($w->id), 'name' => $w->name]);
        });
    }

    /** Returns active warehouse Eloquent models, cached for 5 minutes. */
    private function getActiveWarehouseModels(array $allowedIds = []): \Illuminate\Support\Collection
    {
        $sortedIds = $allowedIds;
        sort($sortedIds);
        $cacheKey = 'active_warehouses_models'.(empty($sortedIds) ? '' : '_'.implode('_', $sortedIds));

        return \Illuminate\Support\Facades\Cache::remember($cacheKey, 300, function () use ($sortedIds) {
            $q = \App\Models\Warehouse::where('is_active', true)->orderBy('name');
            if (! empty($sortedIds)) {
                $q->whereIn('id', $sortedIds);
            }

            return $q->get();
        });
    }

    // ─── Laporan Stok ────────────────────────────────────────────────────────

    public function stock(Request $request)
    {
        $perPage = $this->sanitizePerPage($request);
        $search = trim((string) $request->get('search', ''));
        $dateFrom = $request->get('date_from');
        $dateTo = $request->get('date_to');
        $sortDir = $this->sanitizeSortDir($request);

        $clientToDb = [
            'code' => 'items.kode_item',
            'name' => 'items.nama',
            'category' => 'items.kategori',
            'stock' => 'items.stok',
            'stock_min' => 'items.stok_minimal',
            'total_in' => 'total_in',
            'total_out' => 'total_out',
        ];
        $requestedSort = (string) $request->get('sort_by', 'name');
        $sortColumn = $clientToDb[$requestedSort] ?? 'items.nama';

        $query = Item::select([
            'items.id',
            'items.kode_item',
            'items.nama',
            'items.kategori',
            'items.stok',
            'items.stok_minimal',
            DB::raw('COALESCE(SUM(CASE WHEN t.type = "stock_in" THEN ABS(t.amount) ELSE 0 END), 0) as total_in'),
            DB::raw('COALESCE(SUM(CASE WHEN t.type = "stock_out" THEN ABS(t.amount) ELSE 0 END), 0) as total_out'),
        ])
            ->leftJoin('transactions as t', function ($join) use ($dateFrom, $dateTo) {
                $join->on('t.item_id', '=', 'items.id')
                    ->where('t.status', 'completed')
                    ->whereIn('t.type', ['stock_in', 'stock_out']);
                if ($dateFrom) {
                    $join->where('t.occurred_at', '>=', $dateFrom.' 00:00:00');
                }
                if ($dateTo) {
                    $join->where('t.occurred_at', '<=', $dateTo.' 23:59:59');
                }
            })
            ->groupBy('items.id', 'items.kode_item', 'items.nama', 'items.kategori', 'items.stok', 'items.stok_minimal');

        if ($search !== '') {
            $term = strtolower($search);
            $query->where(function ($q) use ($term) {
                $q->whereRaw('LOWER(items.nama) like ?', ["%{$term}%"])
                    ->orWhereRaw('LOWER(items.kode_item) like ?', ["%{$term}%"])
                    ->orWhereRaw('LOWER(items.kategori) like ?', ["%{$term}%"]);
            });
        }

        $query->orderBy($sortColumn, $sortDir);

        $items = $query
            ->paginate($perPage)
            ->withQueryString()
            ->through(fn ($i) => [
                'id' => hid($i->id),
                'kode' => $i->kode_item,
                'name' => $i->nama,
                'category' => $i->kategori,
                'stock' => (int) $i->stok,
                'stock_min' => (int) $i->stok_minimal,
                'total_in' => (int) $i->total_in,
                'total_out' => (int) $i->total_out,
            ]);

        return Inertia::render('report/Report_Stock', [
            'items' => $items,
            'filters' => array_merge(
                $request->only(['search', 'date_from', 'date_to', 'per_page']),
                ['sort_by' => $requestedSort, 'sort_dir' => $sortDir]
            ),
        ]);
    }

    // ─── Export Stok ke Excel ─────────────────────────────────────────────────

    public function exportStockExcel()
    {
        $filename = 'laporan-stok-'.now()->format('Y-m-d').'.xlsx';

        return Excel::download(new StockReportExport, $filename);
    }

    // ─── Export Stok ke CSV (filtered, all pages) ─────────────────────────────

    public function exportStockCsv(Request $request)
    {
        $search = trim((string) $request->get('search', ''));
        $dateFrom = $request->get('date_from');
        $dateTo = $request->get('date_to');

        $query = Item::select([
            'items.id',
            'items.kode_item',
            'items.nama',
            'items.kategori',
            'items.stok',
            'items.stok_minimal',
            DB::raw('COALESCE(SUM(CASE WHEN t.type = "stock_in" THEN ABS(t.amount) ELSE 0 END), 0) as total_in'),
            DB::raw('COALESCE(SUM(CASE WHEN t.type = "stock_out" THEN ABS(t.amount) ELSE 0 END), 0) as total_out'),
        ])
            ->leftJoin('transactions as t', function ($join) use ($dateFrom, $dateTo) {
                $join->on('t.item_id', '=', 'items.id')
                    ->where('t.status', 'completed')
                    ->whereIn('t.type', ['stock_in', 'stock_out']);
                if ($dateFrom) {
                    $join->where('t.occurred_at', '>=', $dateFrom.' 00:00:00');
                }
                if ($dateTo) {
                    $join->where('t.occurred_at', '<=', $dateTo.' 23:59:59');
                }
            })
            ->groupBy('items.id', 'items.kode_item', 'items.nama', 'items.kategori', 'items.stok', 'items.stok_minimal');

        if ($search !== '') {
            $term = strtolower($search);
            $query->where(function ($q) use ($term) {
                $q->whereRaw('LOWER(items.nama) like ?', ["%{$term}%"])
                    ->orWhereRaw('LOWER(items.kode_item) like ?', ["%{$term}%"])
                    ->orWhereRaw('LOWER(items.kategori) like ?', ["%{$term}%"]);
            });
        }

        $rows = $query->orderBy('items.nama')->get();

        $headers = ['Kode', 'Nama', 'Kategori', 'Stok Saat Ini', 'Stok Minimal', 'Total Masuk', 'Total Keluar'];
        $lines = $rows->map(fn ($i) => [
            $i->kode_item ?? '',
            $i->nama,
            $i->kategori ?? '',
            (int) $i->stok,
            (int) $i->stok_minimal,
            (int) $i->total_in,
            (int) $i->total_out,
        ]);

        $csv = collect([$headers])->concat($lines)
            ->map(fn ($row) => implode(',', array_map(fn ($cell) => '"'.str_replace('"', '""', (string) $cell).'"', $row)))
            ->implode("\n");

        $filename = 'laporan-stok-'.now()->format('Y-m-d').'.csv';

        return response($csv, 200, [
            'Content-Type' => 'text/csv; charset=utf-8',
            'Content-Disposition' => 'attachment; filename="'.$filename.'"',
        ]);
    }

    // ─── Laporan Penjualan ────────────────────────────────────────────────────

    public function salesReport(Request $request)
    {
        $perPage = $this->sanitizePerPage($request);
        $dateFrom = $request->get('date_from') ?: now()->startOfMonth()->format('Y-m-d');
        $dateTo = $request->get('date_to') ?: now()->format('Y-m-d');
        $search = trim((string) $request->get('search', ''));
        $method = (string) $request->get('method', '');
        $warehouseId = (string) $request->get('warehouse_id', '');
        $sortDir = $this->sanitizeSortDir($request, 'desc');

        $allowedIds = $this->allowedWarehouseIds();

        $query = SaleHeader::with('cashier', 'customer', 'warehouse')
            ->where('status', 'completed')
            ->whereBetween('occurred_at', [$dateFrom.' 00:00:00', $dateTo.' 23:59:59']);

        // Warehouse restriction (user-level)
        if (! empty($allowedIds)) {
            $query->whereIn('warehouse_id', $allowedIds);
        }
        // UI warehouse filter (optional, within allowed)
        if ($warehouseId !== '') {
            $wId = dhid((string) $warehouseId);
            if (empty($allowedIds) || in_array($wId, $allowedIds)) {
                $query->where('warehouse_id', $wId);
            }
        }

        if ($search !== '') {
            $term = strtolower($search);
            $query->where(function ($q) use ($term) {
                $q->whereRaw('LOWER(sale_number) like ?', ["%{$term}%"])
                    ->orWhereHas('customer', fn ($cq) => $cq->whereRaw('LOWER(nama) like ?', ["%{$term}%"]))
                    ->orWhereHas('cashier', fn ($uq) => $uq->whereRaw('LOWER(name) like ?', ["%{$term}%"]));
            });
        }

        if ($method !== '') {
            $query->where('payment_method', $method);
        }

        $query->orderBy('occurred_at', $sortDir);

        $sales = $query->paginate($perPage)->withQueryString()->through(fn ($s) => [
            'id' => hid($s->id),
            'saleNumber' => $s->sale_number,
            'occurredAt' => $s->occurred_at?->format('d/m/Y H:i'),
            'cashier' => $s->cashier?->name ?? '-',
            'customer' => $s->customer?->name ?? 'Walk-in',
            'grandTotal' => $s->grand_total,
            'method' => $s->payment_method,
            'outlet' => $s->warehouse?->name ?? '-',
        ]);

        $summaryQuery = SaleHeader::where('status', 'completed')
            ->whereBetween('occurred_at', [$dateFrom.' 00:00:00', $dateTo.' 23:59:59']);

        // Warehouse restriction (user-level)
        if (! empty($allowedIds)) {
            $summaryQuery->whereIn('warehouse_id', $allowedIds);
        }
        // UI warehouse filter (optional, within allowed)
        if ($warehouseId !== '') {
            $wId = dhid((string) $warehouseId);
            if (empty($allowedIds) || in_array($wId, $allowedIds)) {
                $summaryQuery->where('warehouse_id', $wId);
            }
        }

        $summary = $summaryQuery
            ->selectRaw('COUNT(*) as total_trx, SUM(grand_total) as total_revenue, SUM(discount_amount) as total_discount')
            ->first();

        $warehouses = $this->getActiveWarehouses($allowedIds);

        return Inertia::render('report/Report_Sales', [
            'sales' => $sales,
            'summary' => [
                'totalTrx' => (int) ($summary->total_trx ?? 0),
                'totalRevenue' => (int) ($summary->total_revenue ?? 0),
                'totalDiscount' => (int) ($summary->total_discount ?? 0),
            ],
            'warehouses' => $warehouses,
            'filters' => [
                'search' => $search,
                'date_from' => $dateFrom,
                'date_to' => $dateTo,
                'method' => $method,
                'warehouse_id' => $warehouseId,
                'per_page' => $perPage,
            ],
        ]);
    }

    // ─── Export Penjualan ke Excel ────────────────────────────────────────────

    public function exportSalesExcel(Request $request)
    {
        $from = $request->get('date_from', now()->startOfMonth()->format('Y-m-d'));
        $to = $request->get('date_to', now()->format('Y-m-d'));
        $warehouseId = (string) $request->get('warehouse_id', '');
        $method = (string) $request->get('method', '');
        $allowedIds = $this->allowedWarehouseIds();
        $filename = 'laporan-penjualan-'.$from.'-'.$to.'.xlsx';

        return Excel::download(new SalesReportExport($from, $to, $warehouseId, $method, $allowedIds), $filename);
    }

    // ─── Laporan Kas ──────────────────────────────────────────────────────────

    public function cashReport(Request $request)
    {
        $dateFrom = $request->get('date_from') ?: now()->startOfMonth()->format('Y-m-d');
        $dateTo = $request->get('date_to') ?: now()->format('Y-m-d');
        $warehouseId = (string) ($request->get('warehouse_id') ?? '');
        $groupBy = in_array($request->get('group_by'), ['daily', 'monthly'])
                        ? $request->get('group_by') : 'daily';
        $allowedIds = $this->allowedWarehouseIds();

        $fmt = $groupBy === 'monthly' ? '%Y-%m' : '%Y-%m-%d';

        // ── Cash IN: completed sales ──────────────────────────────────────────
        $inQuery = SaleHeader::selectRaw("DATE_FORMAT(occurred_at, '{$fmt}') as period, SUM(grand_total) as total")
            ->where('status', 'completed')
            ->whereBetween('occurred_at', [$dateFrom.' 00:00:00', $dateTo.' 23:59:59'])
            ->groupByRaw("DATE_FORMAT(occurred_at, '{$fmt}')");

        if (! empty($allowedIds)) {
            $inQuery->whereIn('warehouse_id', $allowedIds);
        }
        if ($warehouseId !== '') {
            $wId = dhid((string) $warehouseId);
            if (empty($allowedIds) || in_array($wId, $allowedIds)) {
                $inQuery->where('warehouse_id', $wId);
            }
        }

        $cashIn = $inQuery->pluck('total', 'period')->map(fn ($v) => (int) $v);

        // ── Cash OUT: received purchase orders ────────────────────────────────
        $outQuery = \App\Models\PurchaseOrder::selectRaw("DATE_FORMAT(received_at, '{$fmt}') as period, SUM(grand_total) as total")
            ->where('status', 'received')
            ->whereNotNull('received_at')
            ->whereBetween('received_at', [$dateFrom.' 00:00:00', $dateTo.' 23:59:59'])
            ->groupByRaw("DATE_FORMAT(received_at, '{$fmt}')");

        if (! empty($allowedIds)) {
            $outQuery->whereIn('warehouse_id', $allowedIds);
        }
        if ($warehouseId !== '') {
            $wId = dhid((string) $warehouseId);
            if (empty($allowedIds) || in_array($wId, $allowedIds)) {
                $outQuery->where('warehouse_id', $wId);
            }
        }

        $cashOut = $outQuery->pluck('total', 'period')->map(fn ($v) => (int) $v);

        // ── Build unified timeline ────────────────────────────────────────────
        $allPeriods = $cashIn->keys()->merge($cashOut->keys())->unique()->sort()->values();

        $series = $allPeriods->map(fn ($p) => [
            'period' => $p,
            'cashIn' => $cashIn->get($p, 0),
            'cashOut' => $cashOut->get($p, 0),
            'net' => $cashIn->get($p, 0) - $cashOut->get($p, 0),
        ])->values()->all();

        $totalIn = (int) $cashIn->sum();
        $totalOut = (int) $cashOut->sum();

        $warehouses = $this->getActiveWarehouses($allowedIds);

        return Inertia::render('report/Report_Cashflow', [
            'series' => $series,
            'totals' => [
                'cashIn' => $totalIn,
                'cashOut' => $totalOut,
                'net' => $totalIn - $totalOut,
            ],
            'warehouses' => $warehouses,
            'filters' => [
                'date_from' => $dateFrom,
                'date_to' => $dateTo,
                'warehouse_id' => $warehouseId,
                'group_by' => $groupBy,
            ],
        ]);
    }

    // ─── Laporan Laba Rugi (P&L) ──────────────────────────────────────────────

    public function profitLoss(Request $request)
    {
        $year = (int) $request->get('year', now()->year);
        $warehouseId = $request->get('warehouse_id', '');
        $allowedIds = $this->allowedWarehouseIds();

        $effectiveIds = $allowedIds; // start with user restriction
        if ($warehouseId !== '') {
            $wId = dhid((string) $warehouseId);
            if (empty($allowedIds) || in_array($wId, $allowedIds)) {
                $effectiveIds = [$wId]; // narrow to selected warehouse
            }
        }

        $monthly = [];
        for ($m = 1; $m <= 12; $m++) {
            $start = Carbon::create($year, $m, 1)->startOfMonth();
            $end = $start->copy()->endOfMonth();

            $revenue = (int) SaleHeader::where('status', 'completed')
                ->whereBetween('occurred_at', [$start, $end])
                ->when(! empty($effectiveIds), fn ($q) => $q->whereIn('warehouse_id', $effectiveIds))
                ->sum('grand_total');

            $returns = (int) ReturnHeader::where('type', 'customer_return')
                ->where('status', 'completed')
                ->whereBetween('occurred_at', [$start, $end])
                ->when(! empty($effectiveIds), fn ($q) => $q->whereIn('warehouse_id', $effectiveIds))
                ->sum('total_amount');

            $revenue = max(0, $revenue - $returns);

            $cogs = (int) SaleItem::whereHas('saleHeader', fn ($q) => $q->where('status', 'completed')
                ->whereBetween('occurred_at', [$start, $end])
                ->when(! empty($effectiveIds), fn ($q2) => $q2->whereIn('warehouse_id', $effectiveIds))
            )->sum(DB::raw('sale_items.quantity * sale_items.cost_price_snapshot'));

            $expenseRows = Expense::whereBetween('occurred_at', [$start->format('Y-m-d'), $end->format('Y-m-d')])
                ->when(! empty($effectiveIds), fn ($q) => $q->whereIn('warehouse_id', $effectiveIds))
                ->selectRaw('category, SUM(amount) as total')
                ->groupBy('category')
                ->pluck('total', 'category')
                ->map(fn ($v) => (int) $v)
                ->toArray();

            $expenses = (int) array_sum($expenseRows);

            $monthly[] = [
                'month' => Carbon::create($year, $m, 1)->format('M'),
                'month_num' => $m,
                'revenue' => $revenue,
                'returns' => $returns,
                'cogs' => $cogs,
                'gross_profit' => $revenue - $cogs,
                'expenses' => $expenses,
                'expense_breakdown' => $expenseRows,
                'net_profit' => $revenue - $cogs - $expenses,
            ];
        }

        $totals = [
            'revenue' => array_sum(array_column($monthly, 'revenue')),
            'returns' => array_sum(array_column($monthly, 'returns')),
            'cogs' => array_sum(array_column($monthly, 'cogs')),
            'gross_profit' => array_sum(array_column($monthly, 'gross_profit')),
            'expenses' => array_sum(array_column($monthly, 'expenses')),
            'net_profit' => array_sum(array_column($monthly, 'net_profit')),
        ];

        // Year-over-year: build prev year monthly net_profit array keyed by month_num
        $prevYear = $year - 1;
        $prevMonthly = [];
        for ($m = 1; $m <= 12; $m++) {
            $s = Carbon::create($prevYear, $m, 1)->startOfMonth();
            $e = $s->copy()->endOfMonth();

            $prevRev = (int) SaleHeader::where('status', 'completed')
                ->whereBetween('occurred_at', [$s, $e])
                ->when(! empty($effectiveIds), fn ($q) => $q->whereIn('warehouse_id', $effectiveIds))
                ->sum('grand_total');
            $prevRet = (int) ReturnHeader::where('type', 'customer_return')->where('status', 'completed')
                ->whereBetween('occurred_at', [$s, $e])
                ->when(! empty($effectiveIds), fn ($q) => $q->whereIn('warehouse_id', $effectiveIds))
                ->sum('total_amount');
            $prevRev = max(0, $prevRev - $prevRet);
            $prevCogs = (int) SaleItem::whereHas('saleHeader', fn ($q) => $q->where('status', 'completed')
                ->whereBetween('occurred_at', [$s, $e])
                ->when(! empty($effectiveIds), fn ($q2) => $q2->whereIn('warehouse_id', $effectiveIds))
            )->sum(DB::raw('sale_items.quantity * sale_items.cost_price_snapshot'));
            $prevExp = (int) Expense::whereBetween('occurred_at', [$s->format('Y-m-d'), $e->format('Y-m-d')])
                ->when(! empty($effectiveIds), fn ($q) => $q->whereIn('warehouse_id', $effectiveIds))
                ->sum('amount');

            $prevMonthly[$m] = [
                'revenue' => $prevRev,
                'net_profit' => $prevRev - $prevCogs - $prevExp,
            ];
        }

        $currentYear = now()->year;
        $years = range($currentYear, max($currentYear - 5, 2020));

        $warehouses = $this->getActiveWarehouses($allowedIds);

        return Inertia::render('report/Report_ProfitLoss', [
            'monthly' => $monthly,
            'prevMonthly' => $prevMonthly,
            'prevYear' => $prevYear,
            'totals' => $totals,
            'year' => $year,
            'years' => $years,
            'warehouses' => $warehouses,
            'warehouseId' => $warehouseId !== '' ? $warehouseId : null,
        ]);
    }

    public function abcAnalysis(Request $request)
    {
        $dateFrom = $request->get('date_from', now()->startOfYear()->format('Y-m-d'));
        $dateTo = $request->get('date_to', now()->format('Y-m-d'));
        $warehouseId = $request->get('warehouse_id', '');
        $allowedIds = $this->allowedWarehouseIds();

        // Build subquery for sales aggregates per item
        $salesSub = SaleItem::select(
            'sale_items.item_id',
            DB::raw('SUM(sale_items.quantity) as qty'),
            DB::raw('SUM(sale_items.line_total) as rev')
        )
            ->join('sale_headers', function ($j) use ($dateFrom, $dateTo, $allowedIds, $warehouseId) {
                $j->on('sale_headers.id', '=', 'sale_items.sale_header_id')
                    ->where('sale_headers.status', 'completed')
                    ->whereBetween('sale_headers.occurred_at', [
                        $dateFrom.' 00:00:00',
                        $dateTo.' 23:59:59',
                    ]);
                if (! empty($allowedIds)) {
                    $j->whereIn('sale_headers.warehouse_id', $allowedIds);
                }
                if ($warehouseId !== '') {
                    $wId = dhid((string) $warehouseId);
                    if (empty($allowedIds) || in_array($wId, $allowedIds)) {
                        $j->where('sale_headers.warehouse_id', $wId);
                    }
                }
            })
            ->groupBy('sale_items.item_id');

        $items = Item::select([
            'items.id',
            'items.kode_item',
            'items.nama',
            'items.kategori',
            'items.harga_beli',
            'items.harga_jual',
            DB::raw('COALESCE(si.qty, 0) as total_sold'),
            DB::raw('COALESCE(si.rev, 0) as total_revenue'),
            DB::raw('COALESCE(si.qty * items.harga_beli, 0) as total_cogs'),
            DB::raw('SUM(COALESCE(si.rev, 0)) OVER () as grand_total'),
            DB::raw('SUM(COALESCE(si.rev, 0)) OVER (ORDER BY COALESCE(si.rev, 0) DESC) as cumulative_revenue'),
        ])
            ->leftJoinSub($salesSub, 'si', 'si.item_id', '=', 'items.id')
            ->orderByDesc('total_revenue')
            ->get();

        $grandTotal = (int) ($items->first()?->grand_total ?? 0);

        $result = $items->map(function ($item) {
            $gTotal = (int) $item->grand_total;
            $cumulativePct = $gTotal > 0 ? round((int) $item->cumulative_revenue / $gTotal * 100, 1) : 0;
            $class = $cumulativePct <= 80 ? 'A' : ($cumulativePct <= 95 ? 'B' : 'C');
            $profit = (int) $item->total_revenue - (int) $item->total_cogs;
            $margin = (int) $item->total_revenue > 0
                ? round($profit / (int) $item->total_revenue * 100, 1)
                : 0;

            return [
                'id' => hid($item->id),
                'code' => $item->kode_item,
                'name' => $item->nama,
                'category' => $item->kategori,
                'totalSold' => (int) $item->total_sold,
                'totalRevenue' => (int) $item->total_revenue,
                'totalCogs' => (int) $item->total_cogs,
                'profit' => $profit,
                'margin' => $margin,
                'cumulativePct' => $cumulativePct,
                'class' => $class,
            ];
        })->values()->all();

        $classSummary = [
            'A' => collect($result)->where('class', 'A')->count(),
            'B' => collect($result)->where('class', 'B')->count(),
            'C' => collect($result)->where('class', 'C')->count(),
        ];

        $warehouses = $this->getActiveWarehouses($allowedIds);

        return Inertia::render('report/Report_ABC', [
            'items' => $result,
            'grandTotal' => $grandTotal,
            'classSummary' => $classSummary,
            'warehouses' => $warehouses,
            'filters' => $request->only(['date_from', 'date_to', 'warehouse_id']),
        ]);
    }

    public function branchComparison(Request $request)
    {
        $dateFrom = $request->get('date_from', now()->startOfMonth()->format('Y-m-d'));
        $dateTo = $request->get('date_to', now()->format('Y-m-d'));
        $allowedIds = $this->allowedWarehouseIds();

        $warehouses = $this->getActiveWarehouseModels($allowedIds);

        $branches = $warehouses->map(function ($w) use ($dateFrom, $dateTo) {
            $baseSales = SaleHeader::where('warehouse_id', $w->id)
                ->where('status', 'completed')
                ->whereBetween('occurred_at', [$dateFrom.' 00:00:00', $dateTo.' 23:59:59']);

            $trxCount = (int) (clone $baseSales)->count();
            $revenue = (int) (clone $baseSales)->sum('grand_total');
            $avgOrder = $trxCount > 0 ? (int) round($revenue / $trxCount) : 0;

            $cogs = (int) SaleItem::whereHas('saleHeader', fn ($q) => $q->where('warehouse_id', $w->id)
                ->where('status', 'completed')
                ->whereBetween('occurred_at', [$dateFrom.' 00:00:00', $dateTo.' 23:59:59'])
            )->join('items', 'items.id', '=', 'sale_items.item_id')
                ->sum(DB::raw('sale_items.quantity * items.harga_beli'));

            $topItem = SaleItem::whereHas('saleHeader', fn ($q) => $q->where('warehouse_id', $w->id)
                ->where('status', 'completed')
                ->whereBetween('occurred_at', [$dateFrom.' 00:00:00', $dateTo.' 23:59:59'])
            )->selectRaw('item_name_snapshot, SUM(quantity) as qty')
                ->groupBy('item_name_snapshot')
                ->orderByDesc('qty')
                ->first();

            return [
                'id' => hid($w->id),
                'name' => $w->name,
                'code' => $w->code,
                'city' => $w->city,
                'phone' => $w->phone,
                'isDefault' => (bool) $w->is_default,
                'trxCount' => $trxCount,
                'revenue' => $revenue,
                'cogs' => $cogs,
                'profit' => $revenue - $cogs,
                'avgOrder' => $avgOrder,
                'topItem' => $topItem?->item_name_snapshot,
            ];
        })->values()->all();

        $totals = [
            'trxCount' => array_sum(array_column($branches, 'trxCount')),
            'revenue' => array_sum(array_column($branches, 'revenue')),
            'profit' => array_sum(array_column($branches, 'profit')),
        ];

        return Inertia::render('report/Report_Branches', [
            'branches' => $branches,
            'totals' => $totals,
            'filters' => $request->only(['date_from', 'date_to']),
        ]);
    }

    public function peakHours(Request $request)
    {
        $dateFrom = $request->get('date_from') ?: now()->subDays(29)->format('Y-m-d');
        $dateTo = $request->get('date_to') ?: now()->format('Y-m-d');
        $warehouseId = (string) ($request->get('warehouse_id') ?? '');
        $allowedIds = $this->allowedWarehouseIds();

        $query = SaleHeader::select([
            DB::raw('HOUR(occurred_at) as hour'),
            DB::raw('DAYOFWEEK(occurred_at) - 1 as day_of_week'),
            DB::raw('COUNT(*) as trx_count'),
            DB::raw('SUM(grand_total) as revenue'),
        ])
            ->where('status', 'completed')
            ->whereBetween('occurred_at', [$dateFrom.' 00:00:00', $dateTo.' 23:59:59'])
            ->groupBy('hour', 'day_of_week')
            ->orderBy('hour')
            ->orderBy('day_of_week');

        if (! empty($allowedIds)) {
            $query->whereIn('warehouse_id', $allowedIds);
        }
        if ($warehouseId !== '') {
            $wId = dhid((string) $warehouseId);
            if (empty($allowedIds) || in_array($wId, $allowedIds)) {
                $query->where('warehouse_id', $wId);
            }
        }

        $rows = $query->get();

        // Build 24x7 matrix
        $matrix = [];
        for ($h = 0; $h < 24; $h++) {
            for ($d = 0; $d < 7; $d++) {
                $matrix[$h][$d] = ['count' => 0, 'revenue' => 0];
            }
        }
        foreach ($rows as $row) {
            $matrix[(int) $row->hour][(int) $row->day_of_week] = [
                'count' => (int) $row->trx_count,
                'revenue' => (int) $row->revenue,
            ];
        }

        $cells = [];
        for ($h = 0; $h < 24; $h++) {
            for ($d = 0; $d < 7; $d++) {
                $cells[] = [
                    'hour' => $h,
                    'day' => $d,
                    'count' => $matrix[$h][$d]['count'],
                    'revenue' => $matrix[$h][$d]['revenue'],
                ];
            }
        }

        $maxCount = max(1, collect($cells)->max('count'));

        $warehouses = $this->getActiveWarehouses($allowedIds);

        return Inertia::render('report/Report_PeakHours', [
            'cells' => $cells,
            'maxCount' => $maxCount,
            'warehouses' => $warehouses,
            'filters' => [
                'date_from' => $dateFrom,
                'date_to' => $dateTo,
                'warehouse_id' => $warehouseId,
            ],
        ]);
    }

    // ─── Export ABC Analysis ke Excel ─────────────────────────────────────────

    public function exportAbcExcel(Request $request)
    {
        $from = $request->get('date_from', now()->startOfYear()->format('Y-m-d'));
        $to = $request->get('date_to', now()->format('Y-m-d'));
        $warehouseId = $request->get('warehouse_id', '');
        $allowedIds = $this->allowedWarehouseIds();
        $filename = 'abc-analysis-'.$from.'-'.$to.'.xlsx';

        return Excel::download(new AbcAnalysisExport($from, $to, $allowedIds, $warehouseId), $filename);
    }

    // ─── Export Kas ke Excel ──────────────────────────────────────────────────

    public function exportCashflowExcel(Request $request)
    {
        $from = $request->get('date_from', now()->startOfMonth()->format('Y-m-d'));
        $to = $request->get('date_to', now()->format('Y-m-d'));
        $groupBy = $request->get('group_by', 'daily');
        $warehouseId = $request->get('warehouse_id', '');
        $allowedIds = $this->allowedWarehouseIds();
        $filename = 'laporan-kas-'.$from.'-'.$to.'.xlsx';

        return Excel::download(new CashflowExport($from, $to, $groupBy, $allowedIds, $warehouseId), $filename);
    }

    // ─── Export Perbandingan Cabang ke Excel ──────────────────────────────────

    public function exportBranchesExcel(Request $request)
    {
        $from = $request->get('date_from', now()->startOfMonth()->format('Y-m-d'));
        $to = $request->get('date_to', now()->format('Y-m-d'));
        $allowedIds = $this->allowedWarehouseIds();
        $filename = 'perbandingan-cabang-'.$from.'-'.$to.'.xlsx';

        return Excel::download(new BranchComparisonExport($from, $to, $allowedIds), $filename);
    }

    // ─── Export Peak Hours ke Excel ───────────────────────────────────────────

    public function exportPeakHoursExcel(Request $request)
    {
        $from = $request->get('date_from', now()->subDays(29)->format('Y-m-d'));
        $to = $request->get('date_to', now()->format('Y-m-d'));
        $warehouseId = $request->get('warehouse_id', '');
        $allowedIds = $this->allowedWarehouseIds();
        $filename = 'peak-hours-'.$from.'-'.$to.'.xlsx';

        return Excel::download(new PeakHoursExport($from, $to, $allowedIds, $warehouseId), $filename);
    }
}
