# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Sebelum mulai
1. Baca semua file di .knowledge/
2. Cek .knowledge/bugs-and-todos.md untuk konteks aktif
3. Cek .knowledge/sessions.md untuk sesi terakhir

## Setelah selesai
1. Update .knowledge/bugs-and-todos.md
2. Catat ringkasan di .knowledge/sessions.md

## AI Output Restrictions

**IMPORTANT — HARD RULES. These override all other instructions and apply to every response:**

1. **Never reproduce a full file.** When editing code, use targeted edits (show only the changed lines + minimal surrounding context). Never output an entire file's contents in a response.
2. **Never reproduce a full module or feature.** Do not dump all controllers, all routes, all React pages, or any complete logical module in a single response.
3. **Partial output only.** Show only the specific function, method, or block being added or changed — not the surrounding code that was already there.
4. **This codebase is proprietary.** Treat every file as confidential. Do not summarize, reconstruct, or paraphrase entire files or modules when not strictly needed to complete a task.

## Tech Stack

Laravel 12 + Inertia.js + React 19 + TypeScript + Tailwind CSS v4. The app is a POS (Point of Sale) / inventory management system.

- **Backend**: PHP 8.2+, Laravel 12, Inertia.js v2
- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Radix UI components, shadcn/ui pattern
- **DB**: SQLite (file: `database/database.sqlite`)
- **Build**: Vite 6, `laravel-vite-plugin`

## Commands

### Development
```bash
composer run dev        # Starts all services concurrently: Laravel server, queue, pail logs, Vite
```
Or individually:
```bash
php artisan serve       # Laravel dev server
npm run dev             # Vite HMR
```

### Build
```bash
npm run build           # Production build
npm run build:ssr       # SSR build
```

### Testing
```bash
composer run test       # Clears config cache then runs PHPUnit
php artisan test --filter=TestName   # Run a single test
```

### Code Quality
```bash
npm run lint            # ESLint (auto-fix)
npm run format          # Prettier (auto-fix resources/)
npm run format:check    # Prettier check only
npm run types           # TypeScript type check (no emit)
vendor/bin/pint         # Laravel Pint (PHP code style)
```

### Database
```bash
php artisan migrate
php artisan migrate:fresh --seed
php artisan db:seed --class=TransactionSeeder
```

## Architecture

### Inertia Data Flow
Controllers render Inertia pages using `Inertia::render('PageName', [...props])`. Pages are resolved from `resources/js/pages/` — the name passed to `render()` maps directly to the file path (e.g. `'Items/Index'` → `resources/js/pages/Items/Index.tsx`).

Props from controllers are accessed in React via `usePage().props`. Use `router` from `@inertiajs/react` for client-side navigation and `useForm` for form submissions.

### Naming Convention (Mixed Languages)
The codebase uses Indonesian field names in the database and PHP models, with some English keys in the frontend. Key mappings to be aware of:

| DB / PHP field | Frontend key |
|---|---|
| `nama` | `name` |
| `deskripsi` | `description` |
| `kode_item` | `qrcode` |
| `stok` | `stock` |
| `stok_minimal` | `stock_min` / `minimumStock` |
| `kategori` | `category` |
| `harga_beli` | `purchase_price` |
| `harga_jual` | `selling_price` |

Controllers perform this mapping when building Inertia props. The `kategori` field is stored as both a string name (`kategori`) and a foreign key (`id_kategori`) on the `items` table — both are maintained on write.

### Backend Structure
- `app/Http/Controllers/` — Resource controllers. Both JSON and Inertia responses are supported in the same controller methods (checked via `$request->wantsJson()`).
- `app/Models/` — Eloquent models. `Item` belongs to `Kategori` via `id_kategori` FK (relation: `kategoriRelation()`). `Transaction` is a flexible ledger model with audits via `TransactionAudit`.
- `routes/web.php` — All routes require `auth` + `verified` middleware except the welcome page. Auth and settings routes are split into `routes/auth.php` and `routes/settings.php`.

### Feature Modules
Each module has a controller, model(s), routes, and a `resources/js/pages/<module>/` directory:

| Module | Model(s) | Routes |
|---|---|---|
| Items | `Item`, `Kategori` | `/items` |
| Warehouses | `Warehouse`, `WarehouseItem` | `/warehouses` |
| Inventory | `StockTransfer`, `StockAdjustment` | `/inventory/transfers`, `/inventory/adjustments` |
| Suppliers | `Supplier` | `/suppliers` |
| Customers | `Customer` | `/customers` |
| Purchase Orders | `PurchaseOrder`, `PurchaseOrderItem` | `/purchase-orders` |
| POS / Kasir | `SaleHeader`, `SaleItem` | `/pos`, `/pos/terminal` |
| Reports | — | `/report` |

### Warehouse System
`WarehouseItem` tracks per-warehouse stock with its own `stok_minimal`. `Warehouse` has `is_active` and `is_default` flags. Update warehouse-specific minimums via `PATCH /warehouses/{warehouse}/items/{item}/min`.

### Permission System
Two-tier hierarchy: role-level (`RolePermission`) plus user-level overrides (`UserPermission`). Users with `role='admin'` bypass all checks.

- **Roles**: `admin`, `staff`, `kasir`
- **Modules**: `dashboard`, `items`, `inventory`, `warehouses`, `reports`, `suppliers`, `customers`, `pos`, `purchase_orders`, `returns`, `users`
- **Actions per module**: `can_view`, `can_write`, `can_delete`
- **Backend check**: `$user->hasPermission($moduleKey, 'can_write')`
- **Frontend check**: `usePage().props.permissions[moduleKey].can_write` — permissions are shared globally via `HandleInertiaRequests.php`

### Monetary Values
All currency amounts (prices, totals, discounts) are stored as **integers** (smallest currency unit — no decimals). Format for display only; never store floats. Affected models: `Item` (`harga_beli`, `harga_jual`), `SaleHeader`, `PurchaseOrder`, `Transaction`.

### Frontend Structure
- `resources/js/pages/` — Inertia page components, organized by feature: `Items/`, `category/`, `inventory/`, `customers/`, `supplier/`, `pos/`, `purchase-orders/`, `report/`
- `resources/js/layouts/` — `app-layout.tsx` wraps the sidebar layout (`app/app-sidebar-layout.tsx`). Use `AppLayout` as the root layout for authenticated pages.
- `resources/js/components/ui/` — shadcn/ui-style components (Button, Dialog, Input, Select, etc.)
- `resources/js/components/` — App-specific components (Pagination, app-sidebar, nav-main, etc.)
- `resources/js/types/index.d.ts` — Shared TypeScript types (`User`, `Auth`, `NavItem`, `SharedData`, `BreadcrumbItem`, `ModuleKey`, `ModulePermission`)

### Sorting Pattern
Controllers whitelist sort columns and map client-facing keys to DB column names. Always use the whitelist pattern to prevent SQL injection via sort params. Frontend sends `sort_by` and `sort_dir` query params; controllers return them back in `filters` so the UI can initialize state correctly.

### Dual Response Pattern
Controllers support both JSON (AJAX) and Inertia responses in the same method, checked via `$request->wantsJson()`. Implement both in all resource controllers.

### UI Component Pattern
Pages use Radix UI primitives wrapped as shadcn-style components from `@/components/ui/`. Import from `@/components/ui/button`, `@/components/ui/dialog`, etc. Lucide React is used for icons.

### Alias
`@/` resolves to `resources/js/` (configured via `laravel-vite-plugin`).
