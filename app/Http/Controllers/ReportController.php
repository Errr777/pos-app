<?php

namespace App\Http\Controllers;

use App\Exports\SalesReportExport;
use App\Exports\StockReportExport;
use App\Models\Item;
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

    // ─── Laporan Stok ────────────────────────────────────────────────────────

    public function stock(Request $request)
    {
        $perPage   = $this->sanitizePerPage($request);
        $search    = trim((string) $request->get('search', ''));
        $dateFrom  = $request->get('date_from');
        $dateTo    = $request->get('date_to');
        $sortDir   = $this->sanitizeSortDir($request);

        $clientToDb = [
            'code'      => 'items.kode_item',
            'name'      => 'items.nama',
            'category'  => 'items.kategori',
            'stock'     => 'items.stok',
            'stock_min' => 'items.stok_minimal',
            'total_in'  => 'total_in',
            'total_out' => 'total_out',
        ];
        $requestedSort = (string) $request->get('sort_by', 'name');
        $sortColumn    = $clientToDb[$requestedSort] ?? 'items.nama';

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
                $join->where('t.occurred_at', '>=', $dateFrom . ' 00:00:00');
            }
            if ($dateTo) {
                $join->where('t.occurred_at', '<=', $dateTo . ' 23:59:59');
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
            ->through(fn($i) => [
                'id'        => $i->id,
                'kode'      => $i->kode_item,
                'name'      => $i->nama,
                'category'  => $i->kategori,
                'stock'     => (int) $i->stok,
                'stock_min' => (int) $i->stok_minimal,
                'total_in'  => (int) $i->total_in,
                'total_out' => (int) $i->total_out,
            ]);

        return Inertia::render('report/Report_Stock', [
            'items'   => $items,
            'filters' => array_merge(
                $request->only(['search', 'date_from', 'date_to', 'per_page']),
                ['sort_by' => $requestedSort, 'sort_dir' => $sortDir]
            ),
        ]);
    }

    // ─── Export Stok ke Excel ─────────────────────────────────────────────────

    public function exportStockExcel()
    {
        $filename = 'laporan-stok-' . now()->format('Y-m-d') . '.xlsx';
        return Excel::download(new StockReportExport(), $filename);
    }

    // ─── Laporan Penjualan ────────────────────────────────────────────────────

    public function salesReport(Request $request)
    {
        $perPage     = $this->sanitizePerPage($request);
        $dateFrom    = $request->get('date_from', now()->startOfMonth()->format('Y-m-d'));
        $dateTo      = $request->get('date_to', now()->format('Y-m-d'));
        $search      = trim((string) $request->get('search', ''));
        $method      = $request->get('method', '');
        $warehouseId = $request->get('warehouse_id', '');
        $sortDir     = $this->sanitizeSortDir($request, 'desc');

        $allowedIds = $this->allowedWarehouseIds();

        $query = SaleHeader::with('cashier', 'customer')
            ->where('status', 'completed')
            ->whereBetween('occurred_at', [$dateFrom . ' 00:00:00', $dateTo . ' 23:59:59']);

        // Warehouse restriction (user-level)
        if (!empty($allowedIds)) {
            $query->whereIn('warehouse_id', $allowedIds);
        }
        // UI warehouse filter (optional, within allowed)
        if ($warehouseId !== '') {
            $wId = (int) $warehouseId;
            if (empty($allowedIds) || in_array($wId, $allowedIds)) {
                $query->where('warehouse_id', $wId);
            }
        }

        if ($search !== '') {
            $term = strtolower($search);
            $query->where(function ($q) use ($term) {
                $q->whereRaw('LOWER(sale_number) like ?', ["%{$term}%"]);
            });
        }

        if ($method !== '') {
            $query->where('payment_method', $method);
        }

        $query->orderBy('occurred_at', $sortDir);

        $sales = $query->paginate($perPage)->withQueryString()->through(fn($s) => [
            'id'         => $s->id,
            'saleNumber' => $s->sale_number,
            'occurredAt' => $s->occurred_at?->format('d/m/Y H:i'),
            'cashier'    => $s->cashier?->name ?? '-',
            'customer'   => $s->customer?->name ?? 'Walk-in',
            'grandTotal' => $s->grand_total,
            'method'     => $s->payment_method,
        ]);

        $summaryQuery = SaleHeader::where('status', 'completed')
            ->whereBetween('occurred_at', [$dateFrom . ' 00:00:00', $dateTo . ' 23:59:59']);

        // Warehouse restriction (user-level)
        if (!empty($allowedIds)) {
            $summaryQuery->whereIn('warehouse_id', $allowedIds);
        }
        // UI warehouse filter (optional, within allowed)
        if ($warehouseId !== '') {
            $wId = (int) $warehouseId;
            if (empty($allowedIds) || in_array($wId, $allowedIds)) {
                $summaryQuery->where('warehouse_id', $wId);
            }
        }

        $summary = $summaryQuery
            ->selectRaw('COUNT(*) as total_trx, SUM(grand_total) as total_revenue, SUM(discount_amount) as total_discount')
            ->first();

        $warehouseQuery = \App\Models\Warehouse::where('is_active', true)->orderBy('name');
        if (!empty($allowedIds)) $warehouseQuery->whereIn('id', $allowedIds);
        $warehouses = $warehouseQuery->get(['id', 'name'])->map(fn($w) => ['id' => $w->id, 'name' => $w->name]);

        return Inertia::render('report/Report_Sales', [
            'sales'      => $sales,
            'summary'    => [
                'totalTrx'      => (int) ($summary->total_trx ?? 0),
                'totalRevenue'  => (int) ($summary->total_revenue ?? 0),
                'totalDiscount' => (int) ($summary->total_discount ?? 0),
            ],
            'warehouses' => $warehouses,
            'filters'    => $request->only(['search', 'date_from', 'date_to', 'per_page', 'method', 'warehouse_id']),
        ]);
    }

    // ─── Export Penjualan ke Excel ────────────────────────────────────────────

    public function exportSalesExcel(Request $request)
    {
        $from     = $request->get('date_from', now()->startOfMonth()->format('Y-m-d'));
        $to       = $request->get('date_to', now()->format('Y-m-d'));
        $filename = 'laporan-penjualan-' . $from . '-' . $to . '.xlsx';
        return Excel::download(new SalesReportExport($from, $to), $filename);
    }

    // ─── Laporan Kas ──────────────────────────────────────────────────────────

    public function cashReport()
    {
        return Inertia::render('report/Report_Cashflow');
    }

    // ─── Laporan Laba Rugi (P&L) ──────────────────────────────────────────────

    public function profitLoss(Request $request)
    {
        $year        = (int) $request->get('year', now()->year);
        $warehouseId = $request->get('warehouse_id', '');
        $allowedIds  = $this->allowedWarehouseIds();

        $effectiveIds = $allowedIds; // start with user restriction
        if ($warehouseId !== '') {
            $wId = (int) $warehouseId;
            if (empty($allowedIds) || in_array($wId, $allowedIds)) {
                $effectiveIds = [$wId]; // narrow to selected warehouse
            }
        }

        $monthly = [];
        for ($m = 1; $m <= 12; $m++) {
            $start = Carbon::create($year, $m, 1)->startOfMonth();
            $end   = $start->copy()->endOfMonth();

            $revenue = (int) SaleHeader::where('status', 'completed')
                ->whereBetween('occurred_at', [$start, $end])
                ->when(!empty($effectiveIds), fn($q) => $q->whereIn('warehouse_id', $effectiveIds))
                ->sum('grand_total');

            $cogs = (int) SaleItem::whereHas('saleHeader', fn($q) =>
                $q->where('status', 'completed')
                  ->whereBetween('occurred_at', [$start, $end])
                  ->when(!empty($effectiveIds), fn($q2) => $q2->whereIn('warehouse_id', $effectiveIds))
            )->join('items', 'items.id', '=', 'sale_items.item_id')
             ->sum(DB::raw('sale_items.quantity * items.harga_beli'));

            $monthly[] = [
                'month'        => Carbon::create($year, $m, 1)->format('M'),
                'month_num'    => $m,
                'revenue'      => $revenue,
                'cogs'         => $cogs,
                'gross_profit' => $revenue - $cogs,
            ];
        }

        $totals = [
            'revenue'      => array_sum(array_column($monthly, 'revenue')),
            'cogs'         => array_sum(array_column($monthly, 'cogs')),
            'gross_profit' => array_sum(array_column($monthly, 'gross_profit')),
        ];

        $currentYear = now()->year;
        $years       = range($currentYear, max($currentYear - 3, 2020));

        $warehouseQuery = \App\Models\Warehouse::where('is_active', true)->orderBy('name');
        if (!empty($allowedIds)) $warehouseQuery->whereIn('id', $allowedIds);
        $warehouses = $warehouseQuery->get(['id', 'name'])->map(fn($w) => ['id' => $w->id, 'name' => $w->name]);

        return Inertia::render('report/Report_ProfitLoss', [
            'monthly'     => $monthly,
            'totals'      => $totals,
            'year'        => $year,
            'years'       => $years,
            'warehouses'  => $warehouses,
            'warehouseId' => $warehouseId !== '' ? (int) $warehouseId : null,
        ]);
    }
}
