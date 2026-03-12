# Polish Sprint — Design Spec

**Date**: 2026-03-12
**Status**: Approved for implementation
**Build order**: Each step must be approved before starting the next.

---

## Overview

Five independent improvements to complete before the SaaS build:

| Step | Feature | Sessions |
|---|---|---|
| 1 | Export buttons (4 reports) | 1 |
| 2 | Audit log (B+ level) | 2 |
| 3 | Dashboard upgrade | 1 |
| 4 | Item detail page | 1 |
| 5 | UX rough edges | 1 |

---

## Step 1 — Export Buttons

### Goal
Add Excel export to the 4 reports that currently have none: ABC Analysis, Cashflow, Branch Comparison, Peak Hours.

### Pattern
Follow the `exportSalesExcel` pattern (accepts `Request $request` and passes filters) — **not** the `exportStockExcel` pattern (which ignores filters). Each report gets an Export class in `app/Exports/`, a new controller method in `ReportController`, and a new route.

### Routes
```
GET /report/abc/export/excel          → ReportController::exportAbcExcel(Request $request)
GET /report/cashflow/export/excel     → ReportController::exportCashflowExcel(Request $request)
GET /report/branches/export/excel     → ReportController::exportBranchesExcel(Request $request)
GET /report/peak-hours/export/excel   → ReportController::exportPeakHoursExcel(Request $request)
```

All accept the same query params as their parent page (date range, warehouse_id, etc.) so the export mirrors exactly what's on screen. No explicit permission middleware beyond `auth` — consistent with the existing export routes.

### Export Classes

**`AbcAnalysisExport`** — implements `FromCollection`, `WithHeadings`, `WithMapping`
- Columns: No, Code, Name, Category, Total Sold, Revenue (Rp), COGS (Rp), Profit (Rp), Margin %, Cumulative %, Class

**`CashflowExport`** — implements `FromCollection`, `WithHeadings`
- Columns: Period, Cash In (Rp), Cash Out (Rp), Net (Rp)
- Last row: Totals

**`BranchComparisonExport`** — implements `FromCollection`, `WithHeadings`
- Columns: Outlet, City, Transactions, Revenue (Rp), COGS (Rp), Profit (Rp), Avg Order (Rp), Top Item

**`PeakHoursExport`** — implements `WithMultipleSheets`
- Two sheet classes: `PeakHoursCountSheet` (transaction counts) and `PeakHoursRevenueSheet` (revenue values)
- Each sheet: rows = hours 00–23, columns = Mon–Sun, cells = count or revenue
- Each sheet class implements `FromArray`, `WithHeadings`, `WithTitle`

### UI
Each report page gets an "Export Excel" button (green, Download icon from Lucide) in the filter bar, as a plain `<a href="...">` link (not Inertia router) so the browser triggers a file download. Hidden via `@media print`.

---

## Step 2 — Audit Log (B+ Level)

### Goal
Track business-critical changes with actor, timestamp, and old→new values for high-stakes fields. Explicit controller-level logging — no model observers.

### Data Model

**Migration**: `create_audit_logs_table`

```
id                bigint PK
user_id           bigint FK nullable     — null for system/Artisan actions
user_name_snapshot string(100)           — captured at log time, survives user deletion
action            string(80)             — e.g. "item.price_changed", "user.role_changed"
subject_type      string(50)             — e.g. "Item", "User", "PurchaseOrder"
subject_id        bigint nullable
subject_label     string(200)            — human-readable name at time of action
old_value         JSON nullable          — key fields only, not full model
new_value         JSON nullable          — key fields only, not full model
ip_address        string(45) nullable    — null for system actions
occurred_at       timestamp              — always UTC, set via now()->utc()
```

Indexes: `(occurred_at DESC)`, `(action)`, `(user_id)`. No `updated_at` — append-only, never modified.

**Timezone**: `occurred_at` is always stored as UTC via `now()->utc()`. Consistent with existing `occurred_at` columns on `SaleHeader` and `Transaction` tables.

### AuditLogger Helper

`app/Helpers/AuditLogger.php` — static class:

```php
AuditLogger::log(
    action: 'item.price_changed',
    subject: $item,           // Eloquent model — extracts type, id, label automatically
    old: ['harga_jual' => $oldPrice],
    new: ['harga_jual' => $item->harga_jual],
);
```

**Null-user fallback** (Artisan / system context):
- `user_id` → `null`
- `user_name_snapshot` → `'system'`
- `ip_address` → `null`
- All calls to `request()` are guarded with `app()->runningInConsole()` — if running in console, skip IP capture entirely

```php
$user = Auth::user();
$ip   = app()->runningInConsole() ? null : request()->ip();
```

### Events Logged

| Action key | Trigger | old_value | new_value |
|---|---|---|---|
| `user.created` | UserController::store | — | name, email, role |
| `user.deleted` | UserController::destroy | name, email, role | — |
| `user.role_changed` | UserController::update (role field changes) | role | role |
| `user.password_reset` | UserController::resetPassword | — | — |
| `item.sell_price_changed` | ItemController::update (harga_jual changes) | harga_jual | harga_jual |
| `item.buy_price_changed` | ItemController::update (harga_beli changes) | harga_beli | harga_beli |
| `stock.adjusted` | StockAdjustmentController::store | old_qty | new_qty, reason, outlet_name |
| `po.status_changed` | PurchaseOrderController::updateStatus | old_status | new_status |
| `po.received` | PurchaseOrderController::receive | — | po_number, supplier, grand_total |
| `outlet.created` | WarehouseController::store | — | name, code |
| `outlet.updated` | WarehouseController::update | name | name |
| `outlet.deleted` | WarehouseController::destroy | name | — |
| `promotion.created` | PromotionController::store | — | name, discount_type, discount_value |
| `promotion.updated` | PromotionController::update | name, discount_value | name, discount_value |
| `promotion.deleted` | PromotionController::destroy | name | — |
| `role.permissions_changed` | RoleController::updatePermissions | — | role_name, modules_changed (array) |

### UI

**Route**: `GET /audit-log` → new `AuditLogController::index()`

**Access**: Gated by `role === 'admin'` check directly in the controller — `abort(403)` if not admin. Does **not** use the permission module system (no new `ModuleKey` is added). This keeps the audit log always visible to admin regardless of custom permission overrides.

**Sidebar**: Added under the **Pengguna** nav group as "Log Aktivitas" — visible only when `role === 'admin'` (filtered in `AppSidebar` same as other admin-only items using `permissions.users.can_view` check, since admin always has this).

**Page** `resources/js/pages/AuditLog/Index.tsx`:
- Filters: date range, action group (dropdown: Pengguna, Produk, Stok, Pembelian, Outlet, Promosi), user name search
- Paginated table (20 per page): Waktu | Pengguna | Aksi | Subjek | Perubahan
- "Perubahan" column: shows `old → new` inline for price/stock/role changes; blank for create/delete
- Read-only — no edit or delete actions

**Human-readable action labels** defined as a TypeScript constant map in the page file:
```ts
const ACTION_LABELS: Record<string, string> = {
  'user.created': 'Pengguna Dibuat',
  'user.role_changed': 'Role Diubah',
  'item.sell_price_changed': 'Harga Jual Diubah',
  // ... etc
};
```

---

## Step 3 — Dashboard Upgrade

### Goal
Add trend context and quick-access widgets below existing KPI cards. No existing cards removed.

### New Widgets

**Revenue Sparkline** (added inside existing revenue card)
- 7-day mini bar chart, height 40px, using Recharts `<BarChart>`
- Data: last 7 days `[{date, revenue}]` — added as `revenueTrend` prop from `DashboardController`

**Top 5 Products Today** (new card)
- Ranked list: item name, qty sold today, revenue today
- Source: `SaleItem` + `SaleHeader` where `occurred_at >= today 00:00`
- "Lihat Semua" button → links using Ziggy: `route('report.abc')`

**Stock Alerts Widget** (new card, all roles)
- Count of items below minimum, first 5 listed with current vs minimum qty
- Restricted to user's `allowedWarehouseIds`
- "Lihat Semua" → `route('item.low_stock')` (the functional `ItemController::lowStock` route — NOT the stub `stock_alerts` route at `items/stock_alerts`)

**Recent Transactions** (new card, all roles)
- Last 5 completed sales: time, cashier name, grand total
- Click row → `route('pos.show', { saleHeader: id })`

### Layout
New widgets sit in a new row below existing KPI cards. Branch comparison cards (admin-only) remain at the bottom, unchanged.

### Backend Changes to `DashboardController::index()`
Add to existing props:
- `revenueTrend` — 7 items: `[{date: 'YYYY-MM-DD', revenue: int}]`
- `topProducts` — 5 items: `[{name, qtySold, revenue}]`, respects `allowedWarehouseIds`
- `stockAlerts` — `{count: int, items: [{name, stock, stockMin, outletName}]}`
- `recentTransactions` — 5 items: `[{id, saleNumber, occurredAt, cashierName, grandTotal}]`

---

## Step 4 — Item Detail Page

### Goal
Implement the missing `resources/js/pages/Items/Show.tsx` for the existing `GET /item/{id}` route.

### Controller — `ItemController::show()` MUST be extended
The current implementation returns insufficient data. It must be updated to return:

```php
return Inertia::render('Items/Show', [
    'item' => [
        'id', 'name', 'code', 'category', 'description',
        'harga_jual', 'harga_beli', 'stok', 'stok_minimal',
        'tags' => [...],
    ],
    'stockByOutlet' => [
        // from warehouse_items joined to warehouses
        // restricted by allowedWarehouseIds for non-admin users
        ['outletName', 'stock', 'stockMin', 'status' => 'ok|low|empty'],
    ],
    'recentSales' => [
        // last 10 sale_items for this item, joined to sale_headers
        ['occurredAt', 'saleNumber', 'qty', 'unitPrice', 'lineTotal'],
    ],
]);
```

**Security**: `stockByOutlet` must filter by `allowedWarehouseIds()` — a non-admin user must not see stock in outlets they are not assigned to.

### Page Layout `Items/Show.tsx`
- **Breadcrumb**: Produk → {item name}
- **Header row**: item name, `[CODE]` badge, category badge, tag badges, Edit button (only if `permissions.items.can_write`)
- **KPI cards row**: Harga Jual | Harga Beli | Total Stok
- **Stock by outlet table**: Outlet | Stok | Minimum | Status badge (Oke/Minim/Habis)
- **Recent sales table**: Tanggal | No. Transaksi | Qty | Harga Satuan | Total
- Empty state for recent sales if no history

### Navigation hook
`Items/Index.tsx` — item name in the table becomes `<Link href={route('items.show', item.id)}>` (or equivalent Ziggy route). Verify the named route exists in `routes/web.php`.

---

## Step 5 — UX Rough Edges

### 5a. EmptyState Component

New: `resources/js/components/EmptyState.tsx`

```tsx
interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: { label: string; href: string };
}
```

Applied to these pages where blank areas currently appear with no data:
Items, Categories, Tags, Customers, Suppliers, Purchase Orders, Returns, Promotions, Users, Warehouses, Stock Opname, Audit Log (new).

### 5b. Global Flash Messages

**Backend change required first**: Add flash sharing to `HandleInertiaRequests::share()`:

```php
'flash' => [
    'success' => session('success'),
    'error'   => session('error'),
    'warning' => session('warning'),
    'info'    => session('info'),
],
```

Controllers continue using `->with('success', 'message')` — no controller changes needed since Laravel's `with()` writes to session which is then read above.

**TypeScript**: Add to `SharedData` interface in `resources/js/types/index.d.ts`:
```ts
flash?: {
  success?: string;
  error?: string;
  warning?: string;
  info?: string;
};
```
Note: the existing `[key: string]: unknown` index signature provides a runtime fallback, but the explicit `flash?` property is still required for type safety and IDE autocomplete in the `FlashMessage` component.

**Frontend**: New `resources/js/components/FlashMessage.tsx` — reads `usePage().props.flash`, renders a toast-style banner, auto-dismisses after 4000ms (`FLASH_DISMISS_MS` named constant), manually dismissable. Rendered once inside `AppLayout` — no per-page handling needed.

**Transition**: After `FlashMessage` is in `AppLayout`, remove per-page `{flash?.success && ...}` JSX blocks from all pages that have them (Warehouse/Index.tsx and any others). Do this in the same commit to avoid double-display.

### 5c. Form Submit Loading States

New: `resources/js/components/ui/spinner.tsx` — small animated SVG circle, accepts `className` prop.

Pattern for every submit button in modal forms:
```tsx
<button disabled={form.processing}>
  {form.processing ? <Spinner className="h-4 w-4" /> : 'Simpan'}
</button>
```

Affected pages (all modal-based CRUD forms): Items/Index, Categories, Tags, Customers, Suppliers, Warehouses, Users, Promotions, Purchase Orders/Index, Returns/Index.

---

## Build Order & Approval Gates

```
Step 1 complete → you approve → Step 2 begins
Step 2 complete → you approve → Step 3 begins
Step 3 complete → you approve → Step 4 begins
Step 4 complete → you approve → Step 5 begins
Step 5 complete → you approve → Polish Sprint done → move to Expenses
```

Each step is independently deployable. No step depends on another's code.

---

## Out of Scope (This Sprint)
- Sales target / budget tracking
- Push notifications
- Customer loyalty points
- Expense tracking (next sprint)
- Shift management (next sprint)
- Auto PO (next sprint)
