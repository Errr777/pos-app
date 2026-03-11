# Multi-Outlet Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the existing warehouse system into proper branch/outlet profiles with contact info, auto-lock POS cashiers to their assigned outlet, show branch info on receipts, and add a cross-branch comparison report.

**Architecture:** Warehouses already serve as outlets structurally — `user_warehouses` assigns users, `FiltersWarehouseByUser` scopes data. We extend the `warehouses` table with `phone` and `city` fields, enhance the POS terminal to auto-select the cashier's outlet, surface branch info on the receipt page, add a branch comparison report, and add a per-branch revenue widget on the dashboard for admins.

**Tech Stack:** Laravel 12, Inertia.js v2, React 19, TypeScript, Tailwind CSS v4, shadcn/ui, SQLite.

---

## File Map

| File | Change |
|---|---|
| `database/migrations/2026_03_11_100000_add_outlet_fields_to_warehouses.php` | Create — add `phone`, `city` columns |
| `app/Models/Warehouse.php` | Modify — add to `$fillable` |
| `app/Http/Controllers/WarehouseController.php` | Modify — store/update/show/index include phone+city |
| `resources/js/pages/warehouse/Index.tsx` | Modify — add phone+city inputs in add/edit forms, show in cards |
| `resources/js/pages/warehouse/Show.tsx` | Modify — show phone+city in outlet profile panel |
| `app/Http/Controllers/PosController.php` | Modify — terminal() passes `autoWarehouseId` for single-warehouse users |
| `resources/js/pages/pos/Terminal.tsx` | Modify — auto-select + lock warehouse when `autoWarehouseId` set |
| `resources/js/pages/pos/Show.tsx` | Modify — show outlet city+phone in receipt header |
| `app/Http/Controllers/PosController.php` | Modify — show() passes warehouse phone+city |
| `app/Http/Controllers/ReportController.php` | Modify — add branchComparison() method |
| `resources/js/pages/report/Report_Branches.tsx` | Create — branch comparison report page |
| `routes/web.php` | Modify — add report/branches route |
| `resources/js/components/app-sidebar.tsx` | Modify — add Perbandingan Cabang under Laporan |
| `resources/js/pages/dashboard.tsx` | Modify — add per-branch revenue cards for admin |
| `app/Http/Controllers/DashboardController.php` | Modify — pass branchStats for admin view |

---

## Chunk 1: Outlet Profile Fields

### Task 1: Migration + Model

**Files:**
- Create: `database/migrations/2026_03_11_100000_add_outlet_fields_to_warehouses.php`
- Modify: `app/Models/Warehouse.php`

- [ ] **Step 1: Create migration**

```php
<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::table('warehouses', function (Blueprint $table) {
            $table->string('phone', 20)->nullable()->after('location');
            $table->string('city', 100)->nullable()->after('phone');
        });
    }
    public function down(): void {
        Schema::table('warehouses', function (Blueprint $table) {
            $table->dropColumn(['phone', 'city']);
        });
    }
};
```

- [ ] **Step 2: Run migration**

```bash
php artisan migrate
```

Expected: Migrated successfully, `phone` and `city` columns added to warehouses.

- [ ] **Step 3: Update Warehouse model fillable**

Read `app/Models/Warehouse.php`. Add `'phone'` and `'city'` to the `$fillable` array.

The current fillable likely has: `['code', 'name', 'location', 'description', 'is_active', 'is_default']`

Change to:
```php
protected $fillable = ['code', 'name', 'location', 'phone', 'city', 'description', 'is_active', 'is_default'];
```

- [ ] **Step 4: Commit**

```bash
git add database/migrations/2026_03_11_100000_add_outlet_fields_to_warehouses.php app/Models/Warehouse.php
git commit -m "feat: add phone and city fields to warehouses for outlet profiles"
```

---

### Task 2: WarehouseController — include phone + city

**Files:**
- Modify: `app/Http/Controllers/WarehouseController.php`

- [ ] **Step 1: Update index() to return phone + city**

In the `index()` method, find the `map()` closure that builds warehouse rows. Add `'phone'` and `'city'` to the returned array:

```php
'phone'    => $w->phone,
'city'     => $w->city,
```

- [ ] **Step 2: Update show() to return phone + city**

In the `show()` method, find where `'warehouse'` array is built for the Inertia render. Add:
```php
'phone'    => $warehouse->phone,
'city'     => $warehouse->city,
```

- [ ] **Step 3: Update store() validation**

Find the store() validator rules. Add:
```php
'phone' => 'nullable|string|max:20',
'city'  => 'nullable|string|max:100',
```

- [ ] **Step 4: Update update() validation**

Find the update() validator rules. Add:
```php
'phone' => 'nullable|string|max:20',
'city'  => 'nullable|string|max:100',
```

- [ ] **Step 5: Commit**

```bash
git add app/Http/Controllers/WarehouseController.php
git commit -m "feat: include phone and city in warehouse controller responses and validation"
```

---

### Task 3: Warehouse UI — add phone + city to forms and cards

**Files:**
- Modify: `resources/js/pages/warehouse/Index.tsx`
- Modify: `resources/js/pages/warehouse/Show.tsx`

- [ ] **Step 1: Read Index.tsx**

Read `resources/js/pages/warehouse/Index.tsx` to understand the current form structure.

- [ ] **Step 2: Update WarehouseRow interface**

Add to the `WarehouseRow` interface:
```tsx
phone: string | null;
city: string | null;
```

- [ ] **Step 3: Update addForm state**

Find `const [addForm, setAddForm] = useState(...)`. Add `phone: ''` and `city: ''` to the initial state object.

- [ ] **Step 4: Update editForm state**

Find `const [editForm, setEditForm] = useState(...)`. Add `phone: ''` and `city: ''` to the initial state object. In `openEdit()`, map `wh.phone ?? ''` and `wh.city ?? ''`.

- [ ] **Step 5: Add phone + city inputs to Add form**

In the Add modal form, after the location field, add:
```tsx
<div className="space-y-1">
    <label className="text-sm font-medium">No. Telepon</label>
    <input
        type="text"
        className="w-full border rounded-lg px-3 py-2 bg-background text-sm"
        placeholder="Contoh: 021-5551234"
        value={addForm.phone}
        onChange={e => setAddForm(f => ({ ...f, phone: e.target.value }))}
    />
</div>
<div className="space-y-1">
    <label className="text-sm font-medium">Kota</label>
    <input
        type="text"
        className="w-full border rounded-lg px-3 py-2 bg-background text-sm"
        placeholder="Contoh: Jakarta"
        value={addForm.city}
        onChange={e => setAddForm(f => ({ ...f, city: e.target.value }))}
    />
</div>
```

- [ ] **Step 6: Add phone + city inputs to Edit form**

Same fields in the Edit modal form.

- [ ] **Step 7: Show city in warehouse cards**

In the warehouse card/row display, show `{w.city}` next to the location if present:
```tsx
{(w.city || w.location) && (
    <p className="text-xs text-muted-foreground mt-0.5">
        {[w.city, w.location].filter(Boolean).join(' · ')}
    </p>
)}
{w.phone && (
    <p className="text-xs text-muted-foreground">{w.phone}</p>
)}
```

- [ ] **Step 8: Update Show.tsx**

Read `resources/js/pages/warehouse/Show.tsx`. Find the warehouse profile display section. Add phone and city display:
```tsx
{warehouse.city && (
    <div className="text-sm text-muted-foreground">{warehouse.city}</div>
)}
{warehouse.phone && (
    <div className="text-sm text-muted-foreground">{warehouse.phone}</div>
)}
```

Also update the `warehouse` prop type to include `phone: string | null` and `city: string | null`.

- [ ] **Step 9: Commit**

```bash
git add resources/js/pages/warehouse/Index.tsx resources/js/pages/warehouse/Show.tsx
git commit -m "feat: add phone and city fields to warehouse forms and display"
```

---

## Chunk 2: POS Auto-Lock + Receipt Branch Info

### Task 4: POS terminal auto-lock to outlet

**Files:**
- Modify: `app/Http/Controllers/PosController.php`
- Modify: `resources/js/pages/pos/Terminal.tsx`

- [ ] **Step 1: Update terminal() to pass autoWarehouseId**

In `PosController::terminal()`, after building `$warehouses`, add:

```php
// Auto-select warehouse for users assigned to exactly one outlet
$autoWarehouseId = null;
if ($warehouses->count() === 1) {
    $autoWarehouseId = $warehouses->first()['id'];
}
```

Add `'autoWarehouseId' => $autoWarehouseId` to the Inertia render props.

- [ ] **Step 2: Read Terminal.tsx**

Read `resources/js/pages/pos/Terminal.tsx` to understand how warehouse selection currently works. Find the `selectedWarehouse` state and the warehouse picker UI.

- [ ] **Step 3: Update Terminal.tsx to auto-select and lock**

Find where `selectedWarehouse` state is initialized. Change it to use `autoWarehouseId` from props as default:

```tsx
interface PageProps {
    warehouses: WarehouseOption[];
    // ... other props
    autoWarehouseId: number | null;
    [key: string]: unknown;
}
```

In the component, find where `selectedWarehouse` state is set. Update initialization:
```tsx
const { warehouses, items, customers, promotions, autoWarehouseId } = usePage<PageProps>().props;

// Initialize to autoWarehouseId if provided
const [selectedWarehouse, setSelectedWarehouse] = useState<number | null>(
    autoWarehouseId ?? (warehouses.find(w => w.isDefault)?.id ?? warehouses[0]?.id ?? null)
);
```

Find the warehouse selector dropdown in the UI. Wrap it so it's disabled (read-only) when `autoWarehouseId` is set and there's only 1 warehouse:

```tsx
{warehouses.length > 1 ? (
    <select
        className="border rounded-lg px-3 py-2 text-sm bg-background"
        value={selectedWarehouse ?? ''}
        onChange={e => setSelectedWarehouse(Number(e.target.value))}
    >
        {warehouses.map(w => (
            <option key={w.id} value={w.id}>{w.name}</option>
        ))}
    </select>
) : (
    <div className="px-3 py-2 text-sm font-medium rounded-lg bg-muted">
        {warehouses[0]?.name ?? 'Gudang'}
    </div>
)}
```

- [ ] **Step 4: Commit**

```bash
git add app/Http/Controllers/PosController.php resources/js/pages/pos/Terminal.tsx
git commit -m "feat: auto-lock POS terminal to cashier's assigned outlet"
```

---

### Task 5: Receipt shows branch info

**Files:**
- Modify: `app/Http/Controllers/PosController.php`
- Modify: `resources/js/pages/pos/Show.tsx`

- [ ] **Step 1: Update show() to pass warehouse phone + city**

In `PosController::show()`, find where the `'warehouse'` data is built for Inertia render. Currently it likely passes `warehouseName`. Update to also load and pass `phone` and `city`:

```php
$saleHeader->load(['warehouse', 'customer', 'cashier', 'saleItems.item']);
```

Find the render props. Change the warehouse section to:
```php
'warehouseName' => $saleHeader->warehouse?->name ?? '-',
'warehouseCity' => $saleHeader->warehouse?->city,
'warehousePhone'=> $saleHeader->warehouse?->phone,
```

- [ ] **Step 2: Read Show.tsx**

Read `resources/js/pages/pos/Show.tsx` to understand current receipt layout.

- [ ] **Step 3: Update Show.tsx receipt header**

Find the receipt header section in Show.tsx. Update the PageProps interface to include `warehouseCity` and `warehousePhone`. Add city and phone display below the warehouse name:

```tsx
<div className="text-center space-y-0.5">
    <div className="font-bold text-lg">{warehouseName}</div>
    {warehouseCity && <div className="text-sm text-muted-foreground">{warehouseCity}</div>}
    {warehousePhone && <div className="text-sm text-muted-foreground">{warehousePhone}</div>}
</div>
```

- [ ] **Step 4: Commit**

```bash
git add app/Http/Controllers/PosController.php resources/js/pages/pos/Show.tsx
git commit -m "feat: show branch city and phone on sale receipt"
```

---

## Chunk 3: Branch Comparison Report + Dashboard Widget

### Task 6: Branch Comparison Report

**Files:**
- Modify: `app/Http/Controllers/ReportController.php`
- Create: `resources/js/pages/report/Report_Branches.tsx`
- Modify: `routes/web.php`
- Modify: `resources/js/components/app-sidebar.tsx`

- [ ] **Step 1: Add branchComparison() to ReportController**

Read `app/Http/Controllers/ReportController.php`. Add this method before the closing `}`:

```php
public function branchComparison(Request $request)
{
    $dateFrom   = $request->get('date_from', now()->startOfMonth()->format('Y-m-d'));
    $dateTo     = $request->get('date_to', now()->format('Y-m-d'));
    $allowedIds = $this->allowedWarehouseIds();

    $warehouseQuery = \App\Models\Warehouse::where('is_active', true)->orderBy('name');
    if (!empty($allowedIds)) $warehouseQuery->whereIn('id', $allowedIds);
    $warehouses = $warehouseQuery->get();

    $branches = $warehouses->map(function ($w) use ($dateFrom, $dateTo) {
        $sales = SaleHeader::where('warehouse_id', $w->id)
            ->where('status', 'completed')
            ->whereBetween('occurred_at', [$dateFrom . ' 00:00:00', $dateTo . ' 23:59:59']);

        $trxCount    = (int) (clone $sales)->count();
        $revenue     = (int) (clone $sales)->sum('grand_total');
        $avgOrder    = $trxCount > 0 ? (int) round($revenue / $trxCount) : 0;

        $cogs = (int) SaleItem::whereHas('saleHeader', fn($q) =>
            $q->where('warehouse_id', $w->id)
              ->where('status', 'completed')
              ->whereBetween('occurred_at', [$dateFrom . ' 00:00:00', $dateTo . ' 23:59:59'])
        )->join('items', 'items.id', '=', 'sale_items.item_id')
         ->sum(DB::raw('sale_items.quantity * items.harga_beli'));

        $topItem = SaleItem::whereHas('saleHeader', fn($q) =>
            $q->where('warehouse_id', $w->id)
              ->where('status', 'completed')
              ->whereBetween('occurred_at', [$dateFrom . ' 00:00:00', $dateTo . ' 23:59:59'])
        )->selectRaw('item_name_snapshot, SUM(quantity) as qty')
         ->groupBy('item_name_snapshot')
         ->orderByDesc('qty')
         ->first();

        return [
            'id'        => $w->id,
            'name'      => $w->name,
            'code'      => $w->code,
            'city'      => $w->city,
            'phone'     => $w->phone,
            'isDefault' => (bool) $w->is_default,
            'trxCount'  => $trxCount,
            'revenue'   => $revenue,
            'cogs'      => $cogs,
            'profit'    => $revenue - $cogs,
            'avgOrder'  => $avgOrder,
            'topItem'   => $topItem?->item_name_snapshot,
        ];
    })->values()->all();

    $totals = [
        'trxCount' => array_sum(array_column($branches, 'trxCount')),
        'revenue'  => array_sum(array_column($branches, 'revenue')),
        'profit'   => array_sum(array_column($branches, 'profit')),
    ];

    return Inertia::render('report/Report_Branches', [
        'branches' => $branches,
        'totals'   => $totals,
        'filters'  => $request->only(['date_from', 'date_to']),
    ]);
}
```

- [ ] **Step 2: Create Report_Branches.tsx**

```tsx
import { useState } from 'react';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import { Building2, TrendingUp, ShoppingCart, BarChart3 } from 'lucide-react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Laporan', href: '#' },
    { title: 'Perbandingan Cabang', href: '/report/branches' },
];

interface Branch {
    id: number;
    name: string;
    code: string;
    city: string | null;
    phone: string | null;
    isDefault: boolean;
    trxCount: number;
    revenue: number;
    cogs: number;
    profit: number;
    avgOrder: number;
    topItem: string | null;
}

interface Totals { trxCount: number; revenue: number; profit: number }

interface PageProps {
    branches: Branch[];
    totals: Totals;
    filters: { date_from?: string; date_to?: string };
    [key: string]: unknown;
}

function formatRp(n: number) { return 'Rp ' + n.toLocaleString('id-ID'); }

function pct(val: number, total: number) {
    if (total === 0) return 0;
    return Math.round((val / total) * 100);
}

export default function ReportBranches() {
    const { branches, totals, filters } = usePage<PageProps>().props;
    const [dateFrom, setDateFrom] = useState(filters?.date_from ?? new Date().toISOString().slice(0, 7) + '-01');
    const [dateTo, setDateTo]     = useState(filters?.date_to ?? new Date().toISOString().slice(0, 10));

    const navigate = () => {
        router.get('/report/branches', { date_from: dateFrom, date_to: dateTo }, { preserveState: true, replace: true });
    };

    const maxRevenue = Math.max(1, ...branches.map(b => b.revenue));

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Perbandingan Cabang" />
            <div className="p-6 space-y-6">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Building2 className="w-6 h-6 text-indigo-500" />
                        Perbandingan Cabang
                    </h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        Kinerja penjualan semua outlet dalam satu tampilan
                    </p>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap gap-3 items-end">
                    <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">Dari</label>
                        <input type="date" className="border rounded-lg px-3 py-2 text-sm bg-background" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">Sampai</label>
                        <input type="date" className="border rounded-lg px-3 py-2 text-sm bg-background" value={dateTo} onChange={e => setDateTo(e.target.value)} />
                    </div>
                    <button onClick={navigate} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium">Terapkan</button>
                </div>

                {/* Totals row */}
                <div className="grid grid-cols-3 gap-4">
                    <div className="rounded-xl border bg-card p-4">
                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                            <ShoppingCart className="w-4 h-4" />
                            <span className="text-xs font-medium uppercase tracking-wide">Total Transaksi</span>
                        </div>
                        <div className="text-2xl font-bold tabular-nums">{totals.trxCount.toLocaleString('id-ID')}</div>
                    </div>
                    <div className="rounded-xl border bg-card p-4">
                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                            <TrendingUp className="w-4 h-4" />
                            <span className="text-xs font-medium uppercase tracking-wide">Total Revenue</span>
                        </div>
                        <div className="text-2xl font-bold tabular-nums">{formatRp(totals.revenue)}</div>
                    </div>
                    <div className="rounded-xl border bg-card p-4">
                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                            <BarChart3 className="w-4 h-4" />
                            <span className="text-xs font-medium uppercase tracking-wide">Total Profit</span>
                        </div>
                        <div className={`text-2xl font-bold tabular-nums ${totals.profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {formatRp(totals.profit)}
                        </div>
                    </div>
                </div>

                {/* Branch cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {branches.map(b => (
                        <div key={b.id} className="rounded-xl border bg-card p-5 space-y-4">
                            {/* Branch header */}
                            <div className="flex items-start justify-between">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-semibold text-base">{b.name}</h3>
                                        {b.isDefault && (
                                            <span className="text-xs px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">Utama</span>
                                        )}
                                    </div>
                                    <div className="text-xs text-muted-foreground mt-0.5 space-x-2">
                                        <span>{b.code}</span>
                                        {b.city && <span>· {b.city}</span>}
                                        {b.phone && <span>· {b.phone}</span>}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-lg font-bold tabular-nums">{formatRp(b.revenue)}</div>
                                    <div className="text-xs text-muted-foreground">{pct(b.revenue, totals.revenue)}% dari total</div>
                                </div>
                            </div>

                            {/* Revenue bar */}
                            <div className="w-full bg-muted rounded-full h-2">
                                <div
                                    className="bg-indigo-500 h-2 rounded-full transition-all"
                                    style={{ width: `${pct(b.revenue, maxRevenue)}%` }}
                                />
                            </div>

                            {/* Stats grid */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="rounded-lg bg-muted/40 px-3 py-2">
                                    <div className="text-xs text-muted-foreground">Transaksi</div>
                                    <div className="font-semibold tabular-nums">{b.trxCount.toLocaleString('id-ID')}</div>
                                </div>
                                <div className="rounded-lg bg-muted/40 px-3 py-2">
                                    <div className="text-xs text-muted-foreground">Rata-rata Order</div>
                                    <div className="font-semibold tabular-nums text-sm">{formatRp(b.avgOrder)}</div>
                                </div>
                                <div className="rounded-lg bg-muted/40 px-3 py-2">
                                    <div className="text-xs text-muted-foreground">Profit</div>
                                    <div className={`font-semibold tabular-nums text-sm ${b.profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                        {formatRp(b.profit)}
                                    </div>
                                </div>
                                <div className="rounded-lg bg-muted/40 px-3 py-2">
                                    <div className="text-xs text-muted-foreground">Item Terlaris</div>
                                    <div className="font-semibold text-xs truncate" title={b.topItem ?? ''}>
                                        {b.topItem ?? '—'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {branches.length === 0 && (
                    <div className="rounded-xl border bg-card p-12 text-center text-muted-foreground">
                        Tidak ada data cabang untuk periode ini.
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
```

- [ ] **Step 3: Add route**

In `routes/web.php`, add after `report/peak-hours`:
```php
Route::get('report/branches', [ReportController::class, 'branchComparison'])->name('report.branches');
```

- [ ] **Step 4: Add sidebar entry**

In `resources/js/components/app-sidebar.tsx`, add under Laporan items (after Jam Ramai):
```tsx
{ title: 'Perbandingan Cabang', href: '/report/branches' },
```

- [ ] **Step 5: Commit**

```bash
git add app/Http/Controllers/ReportController.php resources/js/pages/report/Report_Branches.tsx routes/web.php resources/js/components/app-sidebar.tsx
git commit -m "feat: add branch comparison report"
```

---

### Task 7: Dashboard branch widget for admin

**Files:**
- Modify: `app/Http/Controllers/DashboardController.php`
- Modify: `resources/js/pages/dashboard.tsx`

- [ ] **Step 1: Read DashboardController.php**

Read the full `app/Http/Controllers/DashboardController.php`. Note where `$allowedIds` is computed and where the Inertia render is returned.

- [ ] **Step 2: Add branchStats to dashboard data**

In `DashboardController::index()`, after all existing queries, add:

```php
// Per-branch revenue today — only shown to admin (no warehouse restriction)
$branchStats = null;
if (empty($allowedIds)) {
    // Admin sees all branches
    $branchStats = \App\Models\Warehouse::where('is_active', true)
        ->orderBy('is_default', 'desc')
        ->orderBy('name')
        ->get()
        ->map(function ($w) use ($todayStart, $todayEnd, $monthStart, $monthEnd) {
            return [
                'id'            => $w->id,
                'name'          => $w->name,
                'city'          => $w->city,
                'salesToday'    => (int) SaleHeader::where('warehouse_id', $w->id)
                    ->where('status', 'completed')
                    ->whereBetween('occurred_at', [$todayStart, $todayEnd])
                    ->sum('grand_total'),
                'salesMonth'    => (int) SaleHeader::where('warehouse_id', $w->id)
                    ->where('status', 'completed')
                    ->whereBetween('occurred_at', [$monthStart, $monthEnd])
                    ->sum('grand_total'),
                'trxToday'      => (int) SaleHeader::where('warehouse_id', $w->id)
                    ->where('status', 'completed')
                    ->whereBetween('occurred_at', [$todayStart, $todayEnd])
                    ->count(),
            ];
        })->all();
}
```

Add `'branchStats' => $branchStats` to the Inertia render props.

- [ ] **Step 3: Read dashboard.tsx**

Read `resources/js/pages/dashboard.tsx` to understand current layout and props interface.

- [ ] **Step 4: Update dashboard.tsx to show branch cards**

In the `PageProps` interface, add:
```tsx
branchStats: {
    id: number;
    name: string;
    city: string | null;
    salesToday: number;
    salesMonth: number;
    trxToday: number;
}[] | null;
```

Destructure `branchStats` from `usePage<PageProps>().props`.

Add a branch stats section near the bottom of the dashboard (before the low stock section or after the recent sales):

```tsx
{branchStats && branchStats.length > 1 && (
    <div className="space-y-3">
        <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Kinerja Cabang Hari Ini</h2>
            <a href="/report/branches" className="text-xs text-primary hover:underline">Lihat Semua →</a>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {branchStats.map(b => (
                <div key={b.id} className="rounded-xl border bg-card p-4">
                    <div className="flex items-start justify-between mb-2">
                        <div>
                            <div className="font-semibold text-sm">{b.name}</div>
                            {b.city && <div className="text-xs text-muted-foreground">{b.city}</div>}
                        </div>
                        <span className="text-xs text-muted-foreground tabular-nums">{b.trxToday} trx</span>
                    </div>
                    <div className="text-lg font-bold tabular-nums">
                        {'Rp ' + b.salesToday.toLocaleString('id-ID')}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                        Bulan ini: {'Rp ' + b.salesMonth.toLocaleString('id-ID')}
                    </div>
                </div>
            ))}
        </div>
    </div>
)}
```

- [ ] **Step 5: Commit**

```bash
git add app/Http/Controllers/DashboardController.php resources/js/pages/dashboard.tsx
git commit -m "feat: add per-branch revenue cards to admin dashboard"
```

---

## Final Verification

- [ ] Visit `/warehouses` — verify phone + city fields appear in add/edit forms and on cards
- [ ] Edit a warehouse, add phone + city, save — verify data persists
- [ ] Visit `/pos/terminal` as a single-warehouse user — verify warehouse is pre-selected and not changeable
- [ ] Complete a test sale — visit the show/receipt page — verify branch city + phone appear
- [ ] Visit `/report/branches` — verify each active warehouse shows its revenue, profit, trx, avg order, top item
- [ ] Visit `/dashboard` as admin (no warehouse restriction) — verify branch cards appear
- [ ] Run type check: `npm run types`

```bash
npm run types
npm run lint
```
