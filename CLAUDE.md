# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

Controllers perform this mapping when building Inertia props. The `kategori` field is stored as both a string name (`kategori`) and a foreign key (`id_kategori`) on the `items` table — both are maintained on write.

### Backend Structure
- `app/Http/Controllers/` — Resource controllers. Both JSON and Inertia responses are supported in the same controller methods (checked via `$request->wantsJson()`).
- `app/Models/` — Eloquent models. `Item` belongs to `Kategori` via `id_kategori` FK (relation: `kategoriRelation()`). `Transaction` belongs to `User` (as customer) with audits via `TransactionAudit`.
- `routes/web.php` — All routes require `auth` + `verified` middleware except the welcome page. Auth and settings routes are split into `routes/auth.php` and `routes/settings.php`.

### Frontend Structure
- `resources/js/pages/` — Inertia page components, organized by feature: `Items/`, `category/`, `inventory/`, `report/`
- `resources/js/layouts/` — `app-layout.tsx` wraps the sidebar layout (`app/app-sidebar-layout.tsx`). Use `AppLayout` as the root layout for authenticated pages.
- `resources/js/components/ui/` — shadcn/ui-style components (Button, Dialog, Input, Select, etc.)
- `resources/js/components/` — App-specific components (Pagination, app-sidebar, nav-main, etc.)
- `resources/js/types/index.d.ts` — Shared TypeScript types (`User`, `Auth`, `NavItem`, `SharedData`, `BreadcrumbItem`)

### Sorting Pattern
Controllers whitelist sort columns and map client-facing keys to DB column names. Always use the whitelist pattern to prevent SQL injection via sort params. Frontend sends `sort_by` and `sort_dir` query params; controllers return them back in `filters` so the UI can initialize state correctly.

### UI Component Pattern
Pages use Radix UI primitives wrapped as shadcn-style components from `@/components/ui/`. Import from `@/components/ui/button`, `@/components/ui/dialog`, etc. Lucide React is used for icons.

### Alias
`@/` resolves to `resources/js/` (configured via `laravel-vite-plugin`).
