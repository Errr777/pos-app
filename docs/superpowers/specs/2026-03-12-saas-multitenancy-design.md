# SaaS Multi-Tenant Architecture — Design Spec

**Date**: 2026-03-12
**Status**: Approved for implementation (pending Phase 1 package verification gate)
**Model**: A2 — True Multi-Tenant SaaS (Single App, Database per Tenant)

---

## Overview

Transform the existing single-tenant POS app into a multi-tenant SaaS platform where:
- **Superadmin** (vendor/developer) manages all tenants and their plans
- **Admin** (client/business owner) manages their own POS installation within plan limits
- Each tenant is fully isolated — separate SQLite database per tenant
- Tenant context is determined by subdomain (e.g., `client-a.posapp.com`)

---

## Architecture

```
admin.posapp.com         →  Central app  →  master.sqlite           (superadmin panel, tenants, plans)
client-a.posapp.com      →  Central app  →  {TENANT_DB_PATH}/tenant_client-a.sqlite
client-b.posapp.com      →  Central app  →  {TENANT_DB_PATH}/tenant_client-b.sqlite
```

### Technology
- **Tenancy package**: `stancl/tenancy` v3 — **compatibility with Laravel 12 must be verified as the first action of Phase 1 before any other work begins.** If incompatible, evaluate `spatie/laravel-multitenancy` or a manual bootstrapper before proceeding.
- **Domain identification**: Subdomain middleware (`InitializeTenancyBySubdomain`)
- **Central domain exemption**: `admin.posapp.com` (and `localhost` for dev) registered in `tenancy.php` → `central_domains`. Requests to central domains skip tenant initialization entirely — no `TenantCouldNotBeIdentifiedException`.
- **Master DB**: SQLite (`database/database.sqlite`) — stores tenants, domains, plans, superadmins
- **Tenant DB**: SQLite file per tenant at `{TENANT_DB_PATH}/tenant_{slug}.sqlite`
- **Superadmin auth**: Separate Laravel guard (`superadmin`) using `superadmins` table, session cookie scoped to central domain

---

## Tenant Database File Path

The tenant database path is constructed from two parts:

1. **`TENANT_DB_PATH`** — absolute directory path, set in `.env`:
   ```
   TENANT_DB_PATH=/var/www/pos-app/database/tenants
   ```
2. **Filename** — `tenant_{tenant_id}.sqlite`, where `tenant_id` is the slug (e.g., `tenant_client-a.sqlite`)

The full path is registered in `TenancyServiceProvider` via the `DatabaseConfig` bootstrapper or a custom `TenantDatabaseManager`. The `tenants.data` JSON column carries `{"db_path": "/absolute/path/tenant_client-a.sqlite"}` so the package can resolve it at runtime.

In local development: `TENANT_DB_PATH=database/tenants` (relative to project root, resolved to absolute in the service provider).

---

## Existing Users — Migration Path (Phase 1)

The existing single-tenant app runs at one URL (e.g., `localhost` or `posapp.com`). After Phase 1:

1. The existing database becomes the database for **Tenant 1** (slug: `main`, domain: `main.posapp.com` or the existing hostname).
2. The old URL is registered as a `domain` entry for Tenant 1, so existing bookmarks continue to resolve.
3. All existing user sessions are invalidated at migration (acceptable — users must re-login once).
4. A migration script (`tenant:migrate-existing`) copies the existing SQLite data into `tenant_main.sqlite` and creates the Tenant 1 record in master.

This must be documented in the Phase 1 runbook (`docs/runbooks/phase1-migration.md`) so anyone executing the migration knows what to expect.

---

## Data Models (Master Database)

### `plans`
| Column | Type | Notes |
|---|---|---|
| id | bigint PK | |
| name | string | e.g. "Starter", "Pro", "Enterprise" |
| max_outlets | int | Max warehouses (0 = unlimited) |
| max_users | int | Max users (0 = unlimited) |
| enabled_modules | JSON | Array of module keys, e.g. `["pos","items","inventory"]` |
| price | int nullable | Reserved for Phase 5 billing (smallest currency unit) |
| billing_interval | string nullable | `monthly`/`yearly` — reserved for Phase 5 |
| created_at / updated_at | timestamps | |

### `tenants` (extends stancl/tenancy base)
| Column | Type | Notes |
|---|---|---|
| id | string (slug) | e.g. "client-a" — used in subdomain + DB filename |
| plan_id | bigint FK | → plans |
| status | enum | `trial`, `active`, `suspended`, `cancelled` |
| trial_ends_at | timestamp nullable | Auto-suspend when passed |
| data | JSON | stancl/tenancy metadata — includes `db_path` |
| created_at / updated_at | timestamps | |

### `domains` (stancl/tenancy)
| Column | Type | Notes |
|---|---|---|
| id | bigint PK | |
| domain | string unique | e.g. "client-a.posapp.com" |
| tenant_id | string FK | |

### `superadmins`
| Column | Type | Notes |
|---|---|---|
| id | bigint PK | |
| name | string | |
| email | string unique | |
| password | string hashed | |
| created_at / updated_at | timestamps | |

> **Superadmin accounts are only creatable via Artisan**:
> `php artisan superadmin:create {--name=} {--email=}`
> The command prompts for a password using a hidden input (`askHidden`), hashes it before storage, and never echoes it. No UI creation path exists — this prevents privilege escalation from tenant admins.

---

## Tenant Database

Each tenant database contains all existing POS tables unchanged. One additional table is added:

### `tenant_settings` (one row, enforced)
| Column | Type | Notes |
|---|---|---|
| id | bigint PK | Always 1 — enforced via `updateOrCreate(['id' => 1], [...])` |
| max_outlets | int | Copied from plan |
| max_users | int | Copied from plan |
| enabled_modules | JSON | Copied from plan |
| updated_at | timestamp | |

> This table has no `created_at` and is always accessed via `TenantSettings::first()`.
> The `id = 1` constraint ensures only one row ever exists. `PlanSyncJob` uses `updateOrCreate(['id' => 1], $data)`.

Plan limits are pushed here by `PlanSyncJob` when a plan is assigned or changed. The POS app reads locally — no cross-DB queries at runtime.

---

## Route Structure

### Central routes (served at `admin.posapp.com`, no tenant context)
```
GET/POST  /superadmin/login
POST      /superadmin/logout
GET       /superadmin/dashboard
GET/POST  /superadmin/tenants
GET       /superadmin/tenants/create
GET/PUT   /superadmin/tenants/{id}
POST      /superadmin/tenants/{id}/suspend
POST      /superadmin/tenants/{id}/activate
GET/POST  /superadmin/plans
GET/PUT   /superadmin/plans/{id}/edit
```
Registered in `routes/central.php`, wrapped in `auth:superadmin` middleware. No `InitializeTenancyBySubdomain` on these routes.

### Tenant routes (all existing routes — unchanged)
Registered in `routes/tenant.php` (rename of existing `routes/web.php`). All wrapped in `InitializeTenancyBySubdomain` middleware.

---

## Inertia Middleware — Tenant vs Central Context

The existing `HandleInertiaRequests` middleware queries `UserPermission`, `RolePermission`, and `User` models. In the central context (superadmin routes), no tenant DB is bootstrapped — calling these models would fail or query the master DB.

**Solution**: Register a separate `HandleSuperadminInertiaRequests` middleware for central routes. It shares only: `auth.user` (from `superadmins` table), `name`, `ziggy`. It does NOT share `permissions` or `allowedWarehouseIds`.

The existing `HandleInertiaRequests` gains a guard at the top of `share()`:
```php
if (!app(\Stancl\Tenancy\Tenancy::class)->initialized()) {
    return parent::share($request); // minimal share for unauthenticated/central requests
}
```

---

## Phase Plan

---

### Phase 1 — Tenancy Foundation
**Goal**: App resolves tenant from subdomain, switches database context. All existing routes work unchanged inside tenant context.

**⚠️ GATE: Verify `stancl/tenancy` v3 compatibility with Laravel 12 BEFORE writing any code.** Check the package's GitHub releases and open issues. Document the exact version tag or commit SHA to use. If incompatible, evaluate alternatives before proceeding.

**Tasks**:
1. Verify + install `stancl/tenancy` v3 (exact version documented)
2. Configure `SESSION_DOMAIN=.posapp.com` in `.env` and `config/session.php` — subdomain-scoped cookies prevent session bleed between tenants. Do this in Phase 1, not later.
3. Create master DB migrations: `plans`, `superadmins`, extend `tenants` with `plan_id` + `status` + `trial_ends_at`
4. Configure `TenancyServiceProvider`: SQLite file driver, `central_domains: ['admin.posapp.com', 'localhost']`, tenant DB path from `TENANT_DB_PATH`
5. Split routes: rename `routes/web.php` → `routes/tenant.php`, create `routes/central.php` for superadmin
6. Create `HandleSuperadminInertiaRequests` middleware; guard existing `HandleInertiaRequests` against uninitialized tenant context
7. Artisan command `tenant:create {slug} {domain} {plan_id}` — creates tenant record, provisions DB file, runs tenant migrations, seeds default roles + first admin user, outputs credentials
8. Artisan command `tenant:migrate-existing` — wraps existing DB as Tenant 1 (`slug=main`), registers domain, creates `tenant_settings` row
9. Smoke test: `client-a.localhost` and `client-b.localhost` serve isolated POS instances; `admin.localhost` returns 200 without tenant error

**Deliverable**: Two subdomains, fully isolated data. Existing data accessible at `main.localhost`.

---

### Phase 2 — Plans & Limits Enforcement
**Goal**: Tenant plan limits are enforced in the POS app. Disabled modules are hidden and blocked.

**Tasks**:
1. `tenant_settings` migration (runs in tenant context via `artisan tenants:migrate`)
2. `SystemSettings` service class — `SystemSettings::get()` returns cached `TenantSettings::first()`
3. Outlet limit: `WarehouseController@store` → `if (Warehouse::count() >= SystemSettings::get()->max_outlets && max_outlets > 0) abort(422, 'Outlet limit reached')`
4. User limit: `UserController@store` → same pattern
5. `EnsureModuleEnabled` middleware — maps route prefix to module key, checks `enabled_modules`, returns 403 if disabled. Applied to route groups: `/item*` → `items`, `/inventory*` → `inventory`, `/warehouses*` → `warehouses`, `/pos*` → `pos`, `/report*` → `reports`, `/suppliers*` → `suppliers`, `/customers*` → `customers`, `/purchase-orders*` → `purchase_orders`, `/returns*` → `returns`, `/users*` → `users`
6. `HandleInertiaRequests`: filter `permissions` to only include enabled modules; disable nav items for disabled modules
7. `PlanSyncJob` — dispatched by superadmin when changing a tenant's plan; uses `InitializeTenancyForJob` middleware pattern so it runs in the correct tenant DB context; uses `TenantSettings::updateOrCreate(['id' => 1], $data)`
8. Frontend: sidebar hides disabled modules; direct URL to disabled module shows a "Module not available on your plan" page

**Key rules**:
- `max_outlets = 0` and `max_users = 0` mean unlimited
- Disabling a module mid-subscription preserves data; access is blocked until re-enabled
- `PlanSyncJob` MUST use tenancy-aware queue bootstrapper to avoid running against master DB

---

### Phase 3 — Superadmin Panel
**Goal**: Full UI for tenant and plan management. Suspend action and suspension enforcement released together in this phase.

**Backend tasks**:
1. `SuperadminController`, `SuperadminTenantController`, `SuperadminPlanController`
2. Auth guard `superadmin` using `superadmins` table, session driver, `auth:superadmin` middleware
3. `SuspendedTenantMiddleware` — if `tenant.status === 'suspended'`, redirect to `/suspended` page (served in tenant context, no auth required). Released here, not Phase 4, to avoid gap where superadmin can suspend but POS ignores it. **The `/suspended` route must be declared outside the `auth` middleware group in `routes/tenant.php`** — otherwise the redirect loops (suspended → redirect → auth required → redirect).
4. Tenant provision flow: create DB → run migrations → seed roles → create admin user → return credentials in response

**Frontend tasks** (separate session):
1. Superadmin Inertia pages use a separate layout (`SuperadminLayout`) — does not use `AppLayout` or sidebar
2. TypeScript: separate `SuperadminSharedData` type in `resources/js/types/superadmin.d.ts` — does not extend `SharedData`
3. Pages: Dashboard, Tenants list, Tenant detail/edit, Create tenant, Plans list, Plan editor
4. Plan editor: module checkboxes use the same `ModuleKey` type from existing types

**Pages**:
- **Dashboard** — cards: total/active/trial/suspended counts, plan distribution
- **Tenants list** — table with status badges, outlet count, user count, trial expiry, actions
- **Tenant detail** — change plan (triggers `PlanSyncJob` via HTTP), suspend/activate, view stats
- **Create tenant** — slug, domain, plan → provision → show credentials modal (one-time display)
- **Plans list/editor** — limits + module checkboxes

---

### Phase 4 — Tenant Lifecycle
**Goal**: Automated trial expiry, lifecycle management, superadmin dashboard widgets.

**Tasks**:
1. Scheduler: `php artisan tenants:expire-trials` — queries master DB for `status=trial AND trial_ends_at < now()`, sets to `suspended`
2. Register in `routes/console.php`: runs daily
3. Superadmin dashboard widget: tenants with trial expiring in next 7 days
4. Status transition audit log (optional): `tenant_status_logs` in master DB — records actor, old status, new status, timestamp

**Status state machine**:
```
[trial]     → [active]     (superadmin activates)
[trial]     → [suspended]  (scheduler: trial_ends_at passed)
[active]    → [suspended]  (superadmin manual)
[suspended] → [active]     (superadmin reactivates)
[any]       → [cancelled]  (superadmin — data preserved, access blocked)
```

---

### Phase 5 — Billing (Future, Out of Scope)
- Payment gateway (Midtrans / Xendit)
- Webhook-driven plan activation
- Invoice generation

---

## Session Breakdown

| Session | Phase | Scope | End state |
|---|---|---|---|
| 1 | P1 part 1 | Verify package, install, master DB migrations, service provider, route split, Inertia middleware guard | App boots; central domain returns 200 |
| 2 | P1 part 2 | Artisan commands, migrate-existing, smoke test two tenants | Two isolated tenants working |
| 3 | P2 | SystemSettings, limits, module gate, PlanSyncJob | Limits enforced per plan |
| 4 | P3 backend | Superadmin controllers, auth guard, suspend middleware | API complete, suspension works |
| 5 | P3 frontend | Superadmin Inertia pages + TypeScript types | Full superadmin panel UI |
| 6 | P4 | Scheduler, trial expiry, lifecycle widgets | Automated tenant lifecycle |

Each session ends with the app in a **fully working, deployable state**.

---

## Risk Register

| Risk | Likelihood | Mitigation |
|---|---|---|
| `stancl/tenancy` v3 incompatible with Laravel 12 | Medium | **GATE in Session 1** — verify before any code; fall back to `spatie/laravel-multitenancy` or manual bootstrapper |
| SQLite file not found at runtime | Low | Use `realpath()` in service provider; fail fast with clear error message |
| Queued jobs run against master DB | Medium | `PlanSyncJob` must use `InitializeTenancyForJob` bootstrapper; test with sync driver first |
| Session cookie bleed between tenants | Low | `SESSION_DOMAIN=.posapp.com` set in Phase 1, Day 1 |
| Central domain not exempted from tenant middleware | Low | `central_domains` array explicitly set in `tenancy.php` in Phase 1 |
| Existing users can't log in post-migration | Medium | `tenant:migrate-existing` registers old hostname as Tenant 1 domain; documented in runbook |

---

## Out of Scope
- Billing / payment processing (Phase 5)
- White-label custom domains (`pos.clientdomain.com`)
- Cross-tenant analytics (aggregate stats across all tenants)
- Tenant data export / backup tooling
- Mobile app / API consumer support
