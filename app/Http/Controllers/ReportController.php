<?php

namespace App\Http\Controllers;

use App\Models\Item;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class ReportController extends Controller
{
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

    // -------------------------------------------------------------------------
    // GET: Laporan Stok Barang
    // -------------------------------------------------------------------------

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

    // -------------------------------------------------------------------------
    // GET: Laporan Penjualan (stub — requires Finance/Kasir module)
    // -------------------------------------------------------------------------

    public function salesReport()
    {
        return Inertia::render('report/Report_Sales');
    }

    // -------------------------------------------------------------------------
    // GET: Laporan Kas (stub — requires Finance/Kasir module)
    // -------------------------------------------------------------------------

    public function cashReport()
    {
        return Inertia::render('report/Report_Cashflow');
    }
}
