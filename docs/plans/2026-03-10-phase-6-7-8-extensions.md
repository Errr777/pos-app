# Phase 6–8 Extensions Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement three cross-cutting improvements: (1) auto-apply active promotions in POS Terminal, (2) filter Dashboard KPIs by the user's allowed warehouses, (3) add warehouse filter to Sales and P&L reports.

**Architecture:**
- Phase 6 (Promo in POS): Pass active promotions from `PosController::terminal()` to the frontend. In `Terminal.tsx`, compute applicable discount per cart item and auto-populate `discountAmount`. Show a promo badge on item cards.
- Phase 7 (Dashboard per-warehouse): Add `FiltersWarehouseByUser` trait to `DashboardController`. All KPI queries (`SaleHeader`, `SaleItem`) get a `whereIn('warehouse_id', $ids)` guard when the user has restrictions.
- Phase 8 (Report warehouse filter): Add optional `warehouse_id` query param to `salesReport()` and `profitLoss()`. Frontend adds a warehouse `<select>` dropdown to both pages.

**Tech Stack:** Laravel 12, Eloquent, Inertia.js v2, React 19, TypeScript, Tailwind CSS v4

---

## Scope: What changes

| Phase | Feature | Files |
|---|---|---|
| 6 | POS promo auto-apply | `PosController`, `Terminal.tsx` |
| 7 | Dashboard warehouse filter | `DashboardController`, `dashboard.tsx` |
| 8 | Report warehouse filter | `ReportController`, `Report_Sales.tsx`, `Report_ProfitLoss.tsx` |

---

## Phase 6 — Promo Integration in POS Terminal

### Task 1: Pass Active Promotions + Category ID to Terminal

**Files:**
- Modify: `app/Http/Controllers/PosController.php` — `terminal()` method

**Context:** `Promotion::active()` scope already exists. Items in terminal currently lack `id_kategori` (needed for category-scoped promos). We need to add it.

**Step 1: Update `terminal()` to include promos and item category ID**

In `PosController::terminal()`, change the `$items` query and add `$promotions`:

```php
public function terminal(Request $request)
{
    $warehouseQuery = Warehouse::where('is_active', true)
        ->orderBy('is_default', 'desc')->orderBy('name');
    $this->applyWarehouseFilter($warehouseQuery, 'id');
    $warehouses = $warehouseQuery->get()->map(fn ($w) => [
        'id'        => $w->id,
        'name'      => $w->name,
        'code'      => $w->code,
        'isDefault' => (bool) $w->is_default,
    ]);

    $items = Item::select('id', 'nama', 'kode_item', 'kategori', 'id_kategori', 'stok', 'harga_jual')
        ->orderBy('nama')->get()->map(fn ($i) => [
            'id'         => $i->id,
            'name'       => $i->nama,
            'code'       => $i->kode_item,
            'category'   => $i->kategori,
            'categoryId' => $i->id_kategori,
            'stock'      => $i->stok,
            'price'      => $i->harga_jual,
        ]);

    $customers = Customer::where('is_active', true)
        ->orderBy('name')
        ->get()->map(fn ($c) => ['id' => $c->id, 'name' => $c->name, 'code' => $c->code]);

    $promotions = \App\Models\Promotion::active()
        ->get()
        ->map(fn ($p) => [
            'id'          => $p->id,
            'name'        => $p->name,
            'type'        => $p->type,       // 'percentage' | 'fixed'
            'value'       => $p->value,      // int: % or Rp
            'appliesTo'   => $p->applies_to, // 'all' | 'category' | 'item'
            'appliesId'   => $p->applies_id, // kategori ID or item ID (nullable)
            'minPurchase' => $p->min_purchase,
            'maxDiscount' => $p->max_discount,
        ]);

    return Inertia::render('pos/Terminal', [
        'warehouses' => $warehouses,
        'items'      => $items,
        'customers'  => $customers,
        'promotions' => $promotions,
    ]);
}
```

**Step 2: Verify route still loads**

```bash
php artisan route:list --path=pos | grep terminal
```

Expected: `GET pos/terminal pos.terminal › PosController@terminal`

**Step 3: Commit**

```bash
git add app/Http/Controllers/PosController.php
git commit -m "feat: pass active promotions and categoryId to POS terminal"
```

---

### Task 2: Update Terminal.tsx Types + Promo Calculation Logic

**Files:**
- Modify: `resources/js/pages/pos/Terminal.tsx`

**Step 1: Update `ItemOption` and `PageProps` interfaces to include new fields**

```typescript
interface ItemOption {
  id: number;
  name: string;
  code: string;
  category: string | null;
  categoryId: number | null;   // NEW
  stock: number;
  price: number;
}

interface Promotion {
  id: number;
  name: string;
  type: 'percentage' | 'fixed';
  value: number;
  appliesTo: 'all' | 'category' | 'item';
  appliesId: number | null;
  minPurchase: number;
  maxDiscount: number;
}

interface PageProps {
  items: ItemOption[];
  customers: CustomerOption[];
  warehouses: WarehouseOption[];
  promotions: Promotion[];   // NEW
  [key: string]: unknown;
}
```

**Step 2: Add promo computation helper**

Add these functions at the top of the component (before the `return`):

```typescript
const { items, customers, warehouses, promotions = [] } = usePage<PageProps>().props;

// Find the best promo applicable to an item at a given quantity
function getBestPromo(item: ItemOption, quantity: number, promos: Promotion[]): { promo: Promotion; discount: number } | null {
  const lineTotal = item.price * quantity;
  let best: { promo: Promotion; discount: number } | null = null;

  for (const p of promos) {
    // Check if promo applies to this item
    if (p.appliesTo === 'item' && p.appliesId !== item.id) continue;
    if (p.appliesTo === 'category' && p.appliesId !== item.categoryId) continue;
    // Check minimum purchase
    if (p.minPurchase > 0 && lineTotal < p.minPurchase) continue;

    // Calculate discount
    let discount = p.type === 'percentage'
      ? Math.round(lineTotal * p.value / 100)
      : p.value;

    if (p.maxDiscount > 0) discount = Math.min(discount, p.maxDiscount);
    discount = Math.min(discount, lineTotal); // can't exceed line total

    if (!best || discount > best.discount) {
      best = { promo: p, discount };
    }
  }
  return best;
}
```

**Step 3: Apply promo when adding to cart**

Update `addToCart` to auto-compute promo discount:

```typescript
const addToCart = (item: ItemOption) => {
  setCart(prev => {
    const existing = prev.find(c => c.itemId === item.id);
    if (existing) {
      if (existing.quantity >= item.stock) return prev;
      const newQty = existing.quantity + 1;
      const best = getBestPromo(item, newQty, promotions);
      return prev.map(c => c.itemId === item.id
        ? { ...c, quantity: newQty, discountAmount: best?.discount ?? 0, promoName: best?.promo.name ?? null }
        : c
      );
    }
    if (item.stock <= 0) return prev;
    const best = getBestPromo(item, 1, promotions);
    return [...prev, {
      itemId: item.id,
      name: item.name,
      code: item.code,
      unitPrice: item.price,
      quantity: 1,
      discountAmount: best?.discount ?? 0,
      promoName: best?.promo.name ?? null,
      availableStock: item.stock,
    }];
  });
};
```

**Step 4: Update `CartItem` interface to include `promoName`**

```typescript
interface CartItem {
  itemId: number;
  name: string;
  code: string;
  unitPrice: number;
  quantity: number;
  discountAmount: number;
  promoName: string | null;   // NEW
  availableStock: number;
}
```

**Step 5: Re-compute promo when quantity changes**

Update `updateQty` to re-apply promo after qty change:

```typescript
const updateQty = (itemId: number, delta: number) => {
  setCart(prev => prev.map(c => {
    if (c.itemId !== itemId) return c;
    const newQty = Math.max(1, Math.min(c.availableStock, c.quantity + delta));
    const item = items.find(i => i.id === itemId);
    const best = item ? getBestPromo(item, newQty, promotions) : null;
    return { ...c, quantity: newQty, discountAmount: best?.discount ?? c.discountAmount, promoName: best?.promo.name ?? c.promoName };
  }));
};
```

**Step 6: TypeScript check**

```bash
npm run types 2>&1 | grep "pos/Terminal"
```

Expected: no errors for this file.

**Step 7: Commit**

```bash
git add resources/js/pages/pos/Terminal.tsx
git commit -m "feat: promo auto-apply logic in POS terminal cart"
```

---

### Task 3: Show Promo Badge on Item Cards + Cart

**Files:**
- Modify: `resources/js/pages/pos/Terminal.tsx`

**Step 1: Show promo badge on item catalog cards**

In the item grid `<button>` block, after the price/stock row, add:

```tsx
{/* Promo badge on item card */}
{(() => {
  const best = getBestPromo(item, 1, promotions);
  if (!best) return null;
  return (
    <div className="mt-1">
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300">
        {best.promo.type === 'percentage' ? `-${best.promo.value}%` : `-Rp ${best.promo.value.toLocaleString('id-ID')}`}
        {' '}{best.promo.name}
      </span>
    </div>
  );
})()}
```

**Step 2: Show promo name in cart item row**

In the cart item div (inside `cart.map(c => ...)`), below the item name, add:

```tsx
{c.promoName && (
  <div className="text-xs text-rose-600 dark:text-rose-400">🏷 {c.promoName}</div>
)}
```

And when `discountAmount > 0`, show the discount in the line item:

```tsx
{c.discountAmount > 0 && (
  <div className="text-xs text-rose-600 dark:text-rose-400">
    Diskon: -{formatRp(c.discountAmount)}
  </div>
)}
```

**Step 3: Verify promo badge appears for items with active promotions**

Start dev server and open `/pos/terminal`. If promotions exist, item cards should show badge.

```bash
php artisan tinker --execute="
\$promo = App\Models\Promotion::first();
echo \$promo ? 'Promo: ' . \$promo->name . ' (' . \$promo->applies_to . ')' : 'No promos';
"
```

**Step 4: Commit**

```bash
git add resources/js/pages/pos/Terminal.tsx
git commit -m "feat: show promo badge on item cards and promo discount in cart rows"
```

---

## Phase 7 — Dashboard Per-Warehouse Filtering

### Task 4: Apply Warehouse Filter to DashboardController

**Files:**
- Modify: `app/Http/Controllers/DashboardController.php`

**Context:** `DashboardController` has no warehouse filtering. A user restricted to 1 warehouse currently sees global sales across all warehouses. We need to apply `allowedWarehouseIds()` to all sale-related queries.

**Step 1: Add trait + filter helper**

```php
use App\Traits\FiltersWarehouseByUser;

class DashboardController extends Controller
{
    use FiltersWarehouseByUser;
```

**Step 2: Get allowed IDs at top of `index()`**

At the top of the `index()` method, after the date setup:

```php
$allowedIds = $this->allowedWarehouseIds(); // empty = all
```

**Step 3: Filter all SaleHeader KPI queries**

Replace:
```php
$salesToday = (int) SaleHeader::where('status', 'completed')
    ->whereBetween('occurred_at', [$todayStart, $todayEnd])
    ->sum('grand_total');

$salesThisMonth = (int) SaleHeader::where('status', 'completed')
    ->whereBetween('occurred_at', [$monthStart, $monthEnd])
    ->sum('grand_total');
```

With:
```php
$salesToday = (int) SaleHeader::where('status', 'completed')
    ->whereBetween('occurred_at', [$todayStart, $todayEnd])
    ->when(!empty($allowedIds), fn($q) => $q->whereIn('warehouse_id', $allowedIds))
    ->sum('grand_total');

$salesThisMonth = (int) SaleHeader::where('status', 'completed')
    ->whereBetween('occurred_at', [$monthStart, $monthEnd])
    ->when(!empty($allowedIds), fn($q) => $q->whereIn('warehouse_id', $allowedIds))
    ->sum('grand_total');
```

**Step 4: Filter cost calculation (SaleItem via whereHas)**

Replace the `$costThisMonth` query:
```php
$costThisMonth = (int) SaleItem::whereHas('saleHeader', fn($q) =>
    $q->where('status', 'completed')
      ->whereBetween('occurred_at', [$monthStart, $monthEnd])
      ->when(!empty($allowedIds), fn($q2) => $q2->whereIn('warehouse_id', $allowedIds))
)->join('items', 'items.id', '=', 'sale_items.item_id')
 ->sum(DB::raw('sale_items.quantity * items.harga_beli'));
```

**Step 5: Filter dailySales chart**

```php
$dailySales = SaleHeader::where('status', 'completed')
    ->whereBetween('occurred_at', [$sevenDaysAgo, $todayEnd])
    ->when(!empty($allowedIds), fn($q) => $q->whereIn('warehouse_id', $allowedIds))
    ->selectRaw("DATE(occurred_at) as date, SUM(grand_total) as total, COUNT(*) as count")
    ->groupBy('date')
    ->orderBy('date')
    ->get()
    ->keyBy('date');
```

**Step 6: Filter topItems**

```php
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
```

**Step 7: Filter recentSales**

```php
$recentSales = SaleHeader::with('cashier')
    ->where('status', 'completed')
    ->when(!empty($allowedIds), fn($q) => $q->whereIn('warehouse_id', $allowedIds))
    ->orderByDesc('occurred_at')
    ->limit(8)
    ->get()
    ->map(fn($s) => [
        'id'         => $s->id,
        'saleNumber' => $s->sale_number,
        'cashier'    => $s->cashier?->name ?? '-',
        'grandTotal' => $s->grand_total,
        'occurredAt' => $s->occurred_at?->format('d/m H:i'),
    ]);
```

**Step 8: Filter lowStockItems by warehouse when restricted**

Replace:
```php
$lowStockItems = Item::whereColumn('stok', '<', 'stok_minimal') ...
```

With:
```php
if (!empty($allowedIds)) {
    // Show low stock per assigned warehouses (from warehouse_items)
    $lowStockItems = \App\Models\WarehouseItem::whereIn('warehouse_id', $allowedIds)
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
```

**Step 9: Pass warehouse context to frontend**

Add to `Inertia::render()` props:

```php
'warehouseContext' => !empty($allowedIds)
    ? \App\Models\Warehouse::whereIn('id', $allowedIds)->pluck('name')->implode(', ')
    : null,
```

**Step 10: Verify page loads cleanly**

```bash
php artisan route:list --path=dashboard
curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/dashboard
```

Expected: `302` (redirects to login, which means Laravel loaded OK).

**Step 11: Commit**

```bash
git add app/Http/Controllers/DashboardController.php
git commit -m "feat: filter dashboard KPIs and charts by user's allowed warehouses"
```

---

### Task 5: Show Warehouse Context Label on Dashboard

**Files:**
- Modify: `resources/js/pages/dashboard.tsx`

**Step 1: Add `warehouseContext` to PageProps**

In `dashboard.tsx`, add to the `PageProps` interface:

```typescript
warehouseContext?: string | null; // e.g. "Gudang Utama, Gudang B"
```

**Step 2: Destructure and show context banner**

In the component destructuring:
```typescript
const { stats, salesChart = [], topItems = [], recentSales = [], lowStockItems = [], warehouseContext } = usePage<PageProps>().props;
```

Add a context banner near the top of the page content (after `<Head>`):

```tsx
{warehouseContext && (
  <div className="mx-4 mt-4 flex items-center gap-2 rounded-lg border border-cyan-200 bg-cyan-50 dark:bg-cyan-950/30 dark:border-cyan-800 px-4 py-2 text-sm text-cyan-700 dark:text-cyan-300">
    <span className="font-medium">Menampilkan data gudang:</span>
    <span>{warehouseContext}</span>
  </div>
)}
```

**Step 3: Commit**

```bash
git add resources/js/pages/dashboard.tsx
git commit -m "feat: show warehouse context banner on dashboard for restricted users"
```

---

## Phase 8 — Report Filtering by Warehouse

### Task 6: Add Warehouse Filter to ReportController

**Files:**
- Modify: `app/Http/Controllers/ReportController.php`

**Step 1: Add trait + warehouse filter to `salesReport()`**

Add at top of class:
```php
use App\Traits\FiltersWarehouseByUser;

class ReportController extends Controller
{
    use FiltersWarehouseByUser;
```

In `salesReport()`, add warehouse filter after existing filters:

```php
public function salesReport(Request $request)
{
    $perPage     = $this->sanitizePerPage($request);
    $dateFrom    = $request->get('date_from', now()->startOfMonth()->format('Y-m-d'));
    $dateTo      = $request->get('date_to', now()->format('Y-m-d'));
    $search      = trim((string) $request->get('search', ''));
    $method      = $request->get('method', '');
    $warehouseId = $request->get('warehouse_id', ''); // NEW
    $sortDir     = $this->sanitizeSortDir($request, 'desc');

    $query = SaleHeader::with('cashier', 'customer')
        ->where('status', 'completed')
        ->whereBetween('occurred_at', [$dateFrom . ' 00:00:00', $dateTo . ' 23:59:59']);

    if ($search !== '') {
        $term = strtolower($search);
        $query->where(function ($q) use ($term) {
            $q->whereRaw('LOWER(sale_number) like ?', ["%{$term}%"]);
        });
    }
    if ($method !== '') $query->where('payment_method', $method);

    // Warehouse filter: respect user restriction first, then optional UI filter
    $allowedIds = $this->allowedWarehouseIds();
    if (!empty($allowedIds)) {
        $query->whereIn('warehouse_id', $allowedIds);
    }
    if ($warehouseId !== '') {
        // If user is restricted, only allow filtering within their allowed warehouses
        $wId = (int) $warehouseId;
        if (empty($allowedIds) || in_array($wId, $allowedIds)) {
            $query->where('warehouse_id', $wId);
        }
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
    if (!empty($allowedIds)) $summaryQuery->whereIn('warehouse_id', $allowedIds);
    if ($warehouseId !== '') {
        $wId = (int) $warehouseId;
        if (empty($allowedIds) || in_array($wId, $allowedIds)) {
            $summaryQuery->where('warehouse_id', $wId);
        }
    }
    $summary = $summaryQuery
        ->selectRaw('COUNT(*) as total_trx, SUM(grand_total) as total_revenue, SUM(discount_amount) as total_discount')
        ->first();

    // Warehouses for dropdown (respecting user restrictions)
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
```

**Step 2: Add warehouse filter to `profitLoss()`**

```php
public function profitLoss(Request $request)
{
    $year        = (int) $request->get('year', now()->year);
    $warehouseId = $request->get('warehouse_id', ''); // NEW

    $allowedIds  = $this->allowedWarehouseIds();
    // Resolve the effective warehouse filter
    $effectiveIds = $allowedIds; // start with user restriction
    if ($warehouseId !== '') {
        $wId = (int) $warehouseId;
        if (empty($allowedIds) || in_array($wId, $allowedIds)) {
            $effectiveIds = [$wId]; // narrow down to selected
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
```

**Step 3: Commit**

```bash
git add app/Http/Controllers/ReportController.php
git commit -m "feat: add warehouse filter to sales and P&L reports"
```

---

### Task 7: Add Warehouse Dropdown to Report_Sales.tsx

**Files:**
- Modify: `resources/js/pages/report/Report_Sales.tsx`

**Step 1: Update `PageProps` and `filters` interfaces**

```typescript
interface PageProps {
  sales: { data: SaleRow[]; current_page: number; last_page: number; total: number };
  summary: Summary;
  filters: { search?: string; date_from?: string; date_to?: string; per_page?: number; method?: string; warehouse_id?: string };
  warehouses: { id: number; name: string }[];  // NEW
  [key: string]: unknown;
}
```

**Step 2: Destructure warehouses and add state**

```typescript
const { sales, summary, filters, warehouses = [] } = usePage<PageProps>().props;
const [warehouseId, setWarehouseId] = useState(filters?.warehouse_id ?? '');
```

**Step 3: Include `warehouse_id` in navigate calls**

In the `navigate` function:
```typescript
const navigate = (overrides: Record<string, unknown> = {}) => {
  router.get(route('Report_Sales'), {
    search, date_from: dateFrom, date_to: dateTo, method, warehouse_id: warehouseId,
    per_page: filters?.per_page ?? 20,
    ...overrides,
  }, { preserveState: true, replace: true });
};
```

**Step 4: Add warehouse dropdown in the filters row**

In the filters section (after the payment method `<select>`), add:

```tsx
{warehouses.length > 1 && (
  <select
    className="border rounded-md px-3 py-2 text-sm bg-background"
    value={warehouseId}
    onChange={e => { setWarehouseId(e.target.value); navigate({ warehouse_id: e.target.value, page: 1 }); }}
  >
    <option value="">Semua Gudang</option>
    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
  </select>
)}
```

**Step 5: TypeScript check**

```bash
npm run types 2>&1 | grep "Report_Sales"
```

Expected: no new errors.

**Step 6: Commit**

```bash
git add resources/js/pages/report/Report_Sales.tsx
git commit -m "feat: add warehouse dropdown filter to sales report"
```

---

### Task 8: Add Warehouse Dropdown to Report_ProfitLoss.tsx

**Files:**
- Modify: `resources/js/pages/report/Report_ProfitLoss.tsx`

**Step 1: Update `PageProps` interface**

```typescript
interface PageProps {
  monthly: MonthData[];
  totals: Totals;
  year: number;
  years: number[];
  warehouses: { id: number; name: string }[];  // NEW
  warehouseId: number | null;                   // NEW
  [key: string]: unknown;
}
```

**Step 2: Destructure and add warehouse selector**

```typescript
const { monthly = [], totals, year, years = [], warehouses = [], warehouseId } = usePage<PageProps>().props;
```

**Step 3: Update header to show warehouse selector alongside year selector**

Replace the existing header block with:

```tsx
<div className="flex items-center justify-between">
  <h1 className="text-xl font-bold">Laporan Laba Rugi {year}</h1>
  <div className="flex items-center gap-2">
    {warehouses.length > 1 && (
      <select
        defaultValue={warehouseId ?? ''}
        onChange={e => {
          const params = new URLSearchParams({ year: String(year) });
          if (e.target.value) params.set('warehouse_id', e.target.value);
          window.location.href = `/report/profit-loss?${params.toString()}`;
        }}
        className="border rounded-md px-3 py-2 text-sm bg-background"
      >
        <option value="">Semua Gudang</option>
        {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
      </select>
    )}
    <select
      defaultValue={year}
      onChange={e => {
        const params = new URLSearchParams({ year: e.target.value });
        if (warehouseId) params.set('warehouse_id', String(warehouseId));
        window.location.href = `/report/profit-loss?${params.toString()}`;
      }}
      className="border rounded-md px-3 py-2 text-sm bg-background"
    >
      {years.map(y => <option key={y} value={y}>{y}</option>)}
    </select>
  </div>
</div>
```

**Step 4: TypeScript check**

```bash
npm run types 2>&1 | grep "Report_ProfitLoss"
```

Expected: no errors.

**Step 5: Commit**

```bash
git add resources/js/pages/report/Report_ProfitLoss.tsx
git commit -m "feat: add warehouse filter dropdown to P&L report"
```

---

## Summary of All Files Changed

| File | Phase | Change |
|---|---|---|
| `app/Http/Controllers/PosController.php` | 6 | Add promotions + categoryId to terminal props |
| `resources/js/pages/pos/Terminal.tsx` | 6 | Promo types, getBestPromo(), auto-apply in cart, badges |
| `app/Http/Controllers/DashboardController.php` | 7 | Add trait, filter all queries by allowedWarehouseIds |
| `resources/js/pages/dashboard.tsx` | 7 | Show warehouse context banner |
| `app/Http/Controllers/ReportController.php` | 8 | Add warehouse filter to salesReport() and profitLoss() |
| `resources/js/pages/report/Report_Sales.tsx` | 8 | Warehouse dropdown filter |
| `resources/js/pages/report/Report_ProfitLoss.tsx` | 8 | Warehouse dropdown filter |

## Verification Checklist (Task 9 — Manual Test)

**Phase 6 — Promo in POS:**
1. Create a test promo: Admin → `/promotions` → add "Diskon 10%" (percentage, applies_to=all, today's date range)
2. Open `/pos/terminal` → item cards should show `-10%` badge
3. Click an item → cart shows promo discount + promo name
4. Change quantity → discount re-computes correctly
5. Complete transaction → discount applied in grand total

**Phase 7 — Dashboard warehouse filter:**
1. Assign a staff user to 1 warehouse (Users page → Warehouse icon)
2. Login as that user → `/dashboard`
3. Confirm cyan banner shows "Menampilkan data gudang: [name]"
4. Confirm KPIs reflect only that warehouse's sales
5. Login as admin → banner absent, global stats shown

**Phase 8 — Report warehouse filter:**
1. Open `/report/sales` → warehouse dropdown visible (if >1 warehouse)
2. Select a warehouse → table filters to only that warehouse's sales
3. Open `/report/profit-loss` → warehouse dropdown visible
4. Select a warehouse → monthly bars change to reflect only that warehouse

```bash
git commit --allow-empty -m "test: verified phase 6-7-8 extensions work end-to-end"
```
