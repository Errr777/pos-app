# SaaS Control Panel — Implementation Plan (Detail)

> Status: **READY TO IMPLEMENT — menunggu perintah**
> Dibuat: 2026-03-29
> Referensi desain: `docs/plans/2026-03-28-saas-control-panel.md`

---

## Keputusan Desain (Confirmed)

| # | Keputusan | Jawaban |
|---|-----------|---------|
| D1 | Instance baru tanpa license key → block atau allow? | **Allow** (graceful — untuk dev/testing) |
| D2 | Sync gagal, cache > 7 hari → block atau allow? | **Allow** dengan warning di dashboard admin |
| D3 | Admin POS bisa lihat info paket? | **Ya** — halaman read-only "Info Paket" |
| D4 | Deployment model | **Model A** (satu Coolify) — bisa upgrade ke Model B tanpa ubah POS |
| D5 | Control panel frontend | **Manual** — Laravel + Inertia + React + Tailwind (sama dengan pos-app) |

---

## Repo & Struktur

```
pos-app/                    ← repo ini (POS App, dimodifikasi Fase 2+)
pos-app-panel/              ← repo baru (Control Panel, Fase 1)
```

Control panel adalah **Laravel app terpisah**, bukan module di dalam POS App.

---

## Fase 1 — Control Panel App (Repo Baru)

### Tujuan
Buat web panel yang bisa: CRUD tenant, set modul/limit, kelola status, expose API license.

### Tech Stack
- Laravel 12 + Inertia.js v2 + React 19 + TypeScript + Tailwind CSS v4
- (sama persis dengan pos-app — tidak pakai Filament)
- MariaDB (dedicated DB di Coolify, bukan shared dengan tenant)
- Deploy di Coolify, jaringan `coolify`

### Task List

#### 1.1 — Setup Project
- [ ] `composer create-project laravel/laravel pos-app-panel`
- [ ] Install Filament v3: `composer require filament/filament`
- [ ] `php artisan filament:install --panels`
- [ ] Setup auth: single user (owner), seed via `php artisan make:filament-user`
- [ ] Setup database (MariaDB), migration, `.env`
- [ ] Buat `Dockerfile` + `docker-compose.yml` (copy pattern dari pos-app, tanpa Node stage)

#### 1.2 — Model & Migration: Tenant

```php
// tenants table
Schema::create('tenants', function (Blueprint $table) {
    $table->id();
    $table->string('business_name');
    $table->string('contact_email')->nullable();
    $table->string('contact_phone')->nullable();
    $table->string('notes')->nullable();
    $table->string('license_key')->unique(); // UUID, auto-generated
    $table->enum('status', ['active', 'trial', 'suspended', 'expired'])->default('trial');
    $table->json('modules');          // array of enabled ModuleKey strings
    $table->unsignedInteger('max_users')->default(5);
    $table->unsignedInteger('max_outlets')->default(2);
    $table->timestamp('expires_at')->nullable();
    $table->timestamp('last_synced_at')->nullable(); // kapan tenant terakhir sync
    $table->timestamps();
    $table->softDeletes();
});
```

#### 1.3 — Filament Resource: TenantResource

Fields di form:
- `business_name` — TextInput, required
- `contact_email` — Email input
- `contact_phone` — TextInput
- `status` — Select (active/trial/suspended/expired)
- `expires_at` — DateTimePicker
- `modules` — CheckboxList (semua ModuleKey)
- `max_users` — NumericInput (min: 1)
- `max_outlets` — NumericInput (min: 1)
- `notes` — Textarea
- `license_key` — TextInput, disabled, auto-generated saat create

Kolom di tabel:
- Business name, status (badge warna), expires_at, max_users, max_outlets, last_synced_at, license_key (copyable)

Actions:
- Edit, Delete (soft), Suspend (quick action), Perpanjang (quick action + date picker)

#### 1.4 — Filament Dashboard

Widget di halaman utama:
- Total tenant aktif / trial / suspended / expired (4 stat cards)
- Tenant yang akan expired dalam 7 hari (tabel)
- Tenant yang belum sync > 3 hari (tabel — indikasi instance mungkin down)

#### 1.5 — API Endpoint: `GET /api/license/{key}`

```php
// routes/api.php
Route::get('/license/{key}', [LicenseController::class, 'show']);
```

```php
// Response 200
{
    "status": "active",
    "tenant_name": "Toko ABC",
    "expires_at": "2026-12-31T23:59:59Z",
    "modules": ["dashboard","pos","items","inventory",...],
    "limits": {
        "max_users": 5,
        "max_outlets": 2
    },
    "synced_at": "2026-03-29T10:00:00Z"
}

// Response 404 — key tidak ditemukan
// Response 403 — soft deleted / revoked
```

- Update `last_synced_at` pada setiap request ke endpoint ini
- Rate limit: 10 req/menit per IP (cukup untuk sync berkala)
- Tidak perlu auth header — license key sendiri adalah secret

#### 1.6 — Deploy ke Coolify

- Buat Coolify project baru: `pos-app-panel`
- Env vars: `APP_KEY`, `APP_URL`, `DB_*`, `APP_ENV=production`
- Jaringan: `coolify` (agar bisa dicapai tenant lain via internal hostname)

---

## Fase 2 — Modifikasi POS App

### Tujuan
POS App sync license dari control panel, enforce module access, enforce limits.

### Task List

#### 2.1 — Migration: `license_config`

```php
Schema::create('license_config', function (Blueprint $table) {
    $table->id();
    $table->string('license_key');
    $table->string('tenant_name')->nullable();
    $table->enum('status', ['active','trial','suspended','expired'])->default('active');
    $table->json('modules')->nullable();       // null = all modules allowed (graceful)
    $table->unsignedInteger('max_users')->default(999);
    $table->unsignedInteger('max_outlets')->default(999);
    $table->timestamp('expires_at')->nullable();
    $table->timestamp('last_synced_at')->nullable();
    $table->json('raw_response')->nullable();
    $table->timestamps();
});
```

#### 2.2 — Model: `LicenseConfig`

```php
class LicenseConfig extends Model
{
    public function isModuleEnabled(string $module): bool
    {
        if ($this->modules === null) return true; // null = all allowed (no license)
        return in_array($module, $this->modules);
    }

    public function isActive(): bool
    {
        if ($this->status === 'suspended') return false;
        if ($this->expires_at && $this->expires_at->isPast()) return false;
        return true;
    }

    public static function current(): ?self
    {
        return static::first(); // single-row table
    }
}
```

#### 2.3 — Artisan Command: `license:sync`

```bash
php artisan license:sync
```

Logic:
1. Baca `LICENSE_KEY` dari env
2. Jika kosong → skip (log info, instance tanpa license)
3. Hit `{LICENSE_API_URL}/api/license/{key}`
4. Jika 200 → update `license_config` table
5. Jika 404/403 → update status ke `suspended`, log error
6. Jika network error → log warning, **jangan ubah cache** (graceful)

Dijadwalkan di `routes/console.php`:
```php
Schedule::command('license:sync')->everySixHours();
```

#### 2.4 — Env Vars Baru (di `.env` dan Coolify)

```
LICENSE_KEY=                    # UUID dari control panel, kosong = no license check
LICENSE_API_URL=http://pos-app-panel  # hostname Coolify internal
```

#### 2.5 — Middleware: `CheckLicense`

Dipasang di route group `auth` + `verified` di `routes/web.php`.

```php
public function handle(Request $request, Closure $next)
{
    $license = LicenseConfig::current();

    // Tidak ada license config → bypass (graceful untuk instance tanpa LICENSE_KEY)
    if (!$license) return $next($request);

    if (!$license->isActive()) {
        // Izinkan akses ke halaman info license aja
        if (!$request->routeIs('license.info')) {
            return redirect()->route('license.info');
        }
    }

    return $next($request);
}
```

#### 2.6 — Middleware: `CheckModuleEnabled`

Dipasang per route group per modul (hanya modul yang punya route group sendiri).

```php
public function handle(Request $request, Closure $next, string $module)
{
    $license = LicenseConfig::current();

    if ($license && !$license->isModuleEnabled($module)) {
        if ($request->wantsJson()) {
            return response()->json(['error' => 'Modul tidak aktif di paket Anda.'], 403);
        }
        abort(403, 'Modul tidak aktif di paket Anda.');
    }

    return $next($request);
}
```

Penggunaan di `routes/web.php`:
```php
Route::middleware(['auth', 'verified', 'check.license', 'module:pos'])->group(function () {
    Route::get('/pos', ...);
});
```

#### 2.7 — Guard Limit di Controller

**UserController::store():**
```php
$license = LicenseConfig::current();
if ($license && User::count() >= $license->max_users) {
    return back()->withErrors(['limit' => 'Batas jumlah user ('.$license->max_users.') tercapai.']);
}
```

**WarehouseController::store():**
```php
$license = LicenseConfig::current();
if ($license && Warehouse::count() >= $license->max_outlets) {
    return back()->withErrors(['limit' => 'Batas jumlah outlet ('.$license->max_outlets.') tercapai.']);
}
```

#### 2.8 — Share License Info ke Frontend

Di `HandleInertiaRequests.php`, tambah ke `share()`:

```php
'license' => function () {
    $l = LicenseConfig::current();
    if (!$l) return null;
    return [
        'status'       => $l->status,
        'tenant_name'  => $l->tenant_name,
        'modules'      => $l->modules,     // null = all
        'max_users'    => $l->max_users,
        'max_outlets'  => $l->max_outlets,
        'expires_at'   => $l->expires_at?->format('Y-m-d'),
    ];
},
```

#### 2.9 — Sidebar: Sembunyikan Modul Tidak Aktif

Di `nav-main.tsx`, filter nav items:
```tsx
const { license } = usePage().props;
const enabledModules = license?.modules ?? null; // null = all

// Filter: tampilkan nav item hanya jika modul enabled
const visibleItems = items.filter(item =>
    !item.module || enabledModules === null || enabledModules.includes(item.module)
);
```

Requires: setiap nav item di `app-sidebar.tsx` harus punya field `module: ModuleKey`.

#### 2.10 — Halaman `/license-info` (Read-Only)

Halaman sederhana yang ditampilkan ketika:
- Status suspended/expired
- Atau admin ingin lihat info paket

Konten:
- Nama tenant, status, expiry date
- Modul yang aktif (list)
- Batas user + outlet vs usage saat ini
- Tombol "Coba sync ulang" (trigger `license:sync` on-demand)

---

## Fase 3 — Polish (Opsional, Setelah Fase 1+2 Stabil)

| Task | Detail |
|------|--------|
| Email notifikasi H-7 expired | Dari control panel, cek tenant `expires_at <= now+7days` setiap hari |
| Webhook push dari control panel | POST ke tenant saat ada perubahan → instant update tanpa tunggu 6 jam |
| Audit log di control panel | Log kapan tenant di-suspend, perpanjang, dll |
| Usage stats di control panel | Tampilkan jumlah user aktif + outlet dari setiap tenant |

---

## Urutan Eksekusi

```
Fase 1 (Control Panel — repo baru)
  1.1 Setup project + Filament
  1.2 Migration + Model Tenant
  1.3 TenantResource (Filament CRUD)
  1.4 Dashboard widgets
  1.5 API endpoint license
  1.6 Deploy ke Coolify
        ↓
Fase 2 (POS App — repo ini)
  2.1 Migration license_config
  2.2 Model LicenseConfig
  2.3 license:sync command + scheduler
  2.4 .env vars
  2.5 Middleware CheckLicense
  2.6 Middleware CheckModuleEnabled
  2.7 Guard limits di UserController + WarehouseController
  2.8 Share license ke frontend
  2.9 Sidebar filter modul
  2.10 Halaman /license-info
        ↓
Fase 3 (Optional)
  Email notifikasi, webhook, audit log
```

---

## File yang Akan Dibuat/Diubah

### Control Panel (repo baru)
| File | Action |
|------|--------|
| `app/Models/Tenant.php` | Baru |
| `app/Http/Controllers/LicenseController.php` | Baru |
| `app/Filament/Resources/TenantResource.php` | Baru |
| `app/Filament/Widgets/TenantStatsWidget.php` | Baru |
| `database/migrations/*_create_tenants_table.php` | Baru |
| `routes/api.php` | Modifikasi |
| `Dockerfile` + `docker-compose.yml` | Baru |

### POS App (repo ini)
| File | Action |
|------|--------|
| `database/migrations/*_create_license_config_table.php` | Baru |
| `app/Models/LicenseConfig.php` | Baru |
| `app/Console/Commands/LicenseSync.php` | Baru |
| `app/Http/Middleware/CheckLicense.php` | Baru |
| `app/Http/Middleware/CheckModuleEnabled.php` | Baru |
| `app/Http/Controllers/LicenseInfoController.php` | Baru |
| `app/Http/Middleware/HandleInertiaRequests.php` | Modifikasi |
| `app/Http/Controllers/UserController.php` | Modifikasi (guard limit) |
| `app/Http/Controllers/WarehouseController.php` | Modifikasi (guard limit) |
| `routes/web.php` | Modifikasi (tambah middleware + route) |
| `routes/console.php` | Modifikasi (scheduler) |
| `bootstrap/app.php` | Modifikasi (register middleware alias) |
| `resources/js/components/nav-main.tsx` | Modifikasi (filter modul) |
| `resources/js/components/app-sidebar.tsx` | Modifikasi (tambah module key per nav item) |
| `resources/js/pages/license/Info.tsx` | Baru |
| `resources/js/types/index.d.ts` | Modifikasi (tambah `license` ke SharedData) |

---

## Estimasi Token per Fase

| Fase | Task | Estimasi |
|------|------|----------|
| Fase 1 | Setup + model + Filament + API + deploy | ~3-4 sesi |
| Fase 2 | Migration + middleware + guard + frontend | ~2-3 sesi |
| Fase 3 | Polish | ~1-2 sesi |
