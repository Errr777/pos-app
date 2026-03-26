<?php

namespace App\Http\Controllers;

use App\Models\Expense;
use App\Models\Warehouse;
use App\Traits\FiltersWarehouseByUser;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

class ExpenseController extends Controller
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

            if (!$user->hasPermission('reports', $action)) {
                return $request->wantsJson()
                    ? response()->json(['error' => 'Forbidden'], 403)
                    : abort(403);
            }

            return $next($request);
        });
    }

    public function index(Request $request)
    {
        $allowedIds  = $this->allowedWarehouseIds();
        $dateFrom    = $request->get('date_from') ?: now()->startOfMonth()->format('Y-m-d');
        $dateTo      = $request->get('date_to')   ?: now()->format('Y-m-d');
        $category    = (string) $request->get('category', '');
        $warehouseId = (string) $request->get('warehouse_id', '');

        $query = Expense::with(['warehouse', 'creator'])
            ->where('occurred_at', '>=', $dateFrom . ' 00:00:00')
            ->where('occurred_at', '<=', $dateTo . ' 23:59:59');

        if (!empty($allowedIds)) {
            $query->whereIn('warehouse_id', $allowedIds);
        }
        if ($category !== '') {
            $query->where('category', $category);
        }
        if ($warehouseId !== '') {
            $wId = dhid($warehouseId);
            if ($wId > 0 && (empty($allowedIds) || in_array($wId, $allowedIds))) {
                $query->where('warehouse_id', $wId);
            }
        }

        $query->orderByDesc('occurred_at')->orderByDesc('id');

        $expenses = $query->paginate(20)->withQueryString()->through(fn($e) => [
            'id'            => hid($e->id),
            'occurredAt'    => $e->occurred_at->format('Y-m-d'),
            'category'      => $e->category,
            'amount'        => $e->amount,
            'description'   => $e->description,
            'warehouseName' => $e->warehouse?->name ?? '(Umum)',
            'creatorName'   => $e->creator?->name ?? '-',
        ]);

        // Summary by category for selected period
        $summaryQuery = Expense::selectRaw('category, SUM(amount) as total')
            ->where('occurred_at', '>=', $dateFrom . ' 00:00:00')
            ->where('occurred_at', '<=', $dateTo . ' 23:59:59');

        if (!empty($allowedIds)) {
            $summaryQuery->whereIn('warehouse_id', $allowedIds);
        }
        if ($warehouseId !== '') {
            $wId = dhid($warehouseId);
            if ($wId > 0 && (empty($allowedIds) || in_array($wId, $allowedIds))) {
                $summaryQuery->where('warehouse_id', $wId);
            }
        }

        $summary = $summaryQuery
            ->groupBy('category')
            ->orderByDesc('total')
            ->get()
            ->map(fn($r) => ['category' => $r->category, 'total' => (int) $r->total])
            ->all();

        $totalAmount = array_sum(array_column($summary, 'total'));

        $warehouseQuery = Warehouse::where('is_active', true)->orderBy('name');
        if (!empty($allowedIds)) $warehouseQuery->whereIn('id', $allowedIds);
        $warehouses = $warehouseQuery->get(['id', 'name'])
            ->map(fn($w) => ['id' => hid($w->id), 'name' => $w->name]);

        return Inertia::render('expenses/Index', [
            'expenses'    => $expenses,
            'summary'     => $summary,
            'totalAmount' => $totalAmount,
            'categories'  => array_keys(Expense::CATEGORIES),
            'warehouses'  => $warehouses,
            'filters'     => $request->only(['date_from', 'date_to', 'category', 'warehouse_id']),
        ]);
    }

    public function store(Request $request)
    {
        $allowedIds = $this->allowedWarehouseIds();

        $request->merge([
            'warehouse_id' => $request->warehouse_id ? dhid((string) $request->warehouse_id) : null,
        ]);

        $data = $request->validate([
            'occurred_at'  => 'required|date',
            'category'     => 'required|string|in:' . implode(',', array_keys(Expense::CATEGORIES)),
            'amount'       => 'required|integer|min:1',
            'description'  => 'nullable|string|max:255',
            'warehouse_id' => 'nullable|integer|exists:warehouses,id',
        ]);

        // Security: non-admin can only assign to their allowed warehouses
        if (!empty($allowedIds) && !empty($data['warehouse_id']) && !in_array($data['warehouse_id'], $allowedIds)) {
            abort(403);
        }

        Expense::create([
            ...$data,
            'created_by' => Auth::id(),
        ]);

        return back()->with('success', 'Pengeluaran berhasil dicatat.');
    }

    public function update(Request $request, Expense $expense)
    {
        $allowedIds = $this->allowedWarehouseIds();

        // Non-admin can only edit expenses in their allowed warehouses
        if (!empty($allowedIds) && $expense->warehouse_id && !in_array($expense->warehouse_id, $allowedIds)) {
            abort(403);
        }

        $request->merge([
            'warehouse_id' => $request->warehouse_id ? dhid((string) $request->warehouse_id) : null,
        ]);

        $data = $request->validate([
            'occurred_at'  => 'required|date',
            'category'     => 'required|string|in:' . implode(',', array_keys(Expense::CATEGORIES)),
            'amount'       => 'required|integer|min:1',
            'description'  => 'nullable|string|max:255',
            'warehouse_id' => 'nullable|integer|exists:warehouses,id',
        ]);

        if (!empty($allowedIds) && !empty($data['warehouse_id']) && !in_array($data['warehouse_id'], $allowedIds)) {
            abort(403);
        }

        $expense->update($data);

        return back()->with('success', 'Pengeluaran berhasil diperbarui.');
    }

    public function destroy(Expense $expense)
    {
        $allowedIds = $this->allowedWarehouseIds();

        if (!empty($allowedIds) && $expense->warehouse_id && !in_array($expense->warehouse_id, $allowedIds)) {
            abort(403);
        }

        $expense->delete();

        return back()->with('success', 'Pengeluaran dihapus.');
    }
}
