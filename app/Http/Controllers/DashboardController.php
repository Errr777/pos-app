<?php

namespace App\Http\Controllers;

use App\Models\Item;
use App\Models\Kategori;
use App\Models\Transaction;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class DashboardController extends Controller
{
    public function index()
    {
        $now        = now();
        $monthStart = $now->copy()->startOfMonth();
        $monthEnd   = $now->copy()->endOfMonth();

        $totalItems      = Item::count();
        $lowStockCount   = Item::whereColumn('stok', '<', 'stok_minimal')->count();
        $categoriesCount = Kategori::count();

        $stockInThisMonth = (int) Transaction::where('type', 'stock_in')
            ->where('status', 'completed')
            ->whereBetween('occurred_at', [$monthStart, $monthEnd])
            ->sum(DB::raw('ABS(amount)'));

        $stockOutThisMonth = (int) Transaction::where('type', 'stock_out')
            ->where('status', 'completed')
            ->whereBetween('occurred_at', [$monthStart, $monthEnd])
            ->sum(DB::raw('ABS(amount)'));

        $recentMovements = Transaction::with('item')
            ->whereIn('type', ['stock_in', 'stock_out'])
            ->where('status', 'completed')
            ->orderBy('occurred_at', 'desc')
            ->limit(10)
            ->get()
            ->map(fn($t) => [
                'id'        => $t->id,
                'date'      => $t->occurred_at?->format('Y-m-d'),
                'itemName'  => $t->item?->nama ?? '(item deleted)',
                'direction' => $t->type === 'stock_in' ? 'IN' : 'OUT',
                'quantity'  => (int) abs($t->amount),
                'party'     => $t->party,
            ]);

        return Inertia::render('dashboard', [
            'stats' => [
                'totalItems'        => $totalItems,
                'lowStockCount'     => $lowStockCount,
                'categoriesCount'   => $categoriesCount,
                'stockInThisMonth'  => $stockInThisMonth,
                'stockOutThisMonth' => $stockOutThisMonth,
            ],
            'recentMovements' => $recentMovements,
        ]);
    }
}
