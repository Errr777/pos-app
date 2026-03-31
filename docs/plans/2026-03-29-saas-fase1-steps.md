# SaaS Fase 1 — Step by Step (Control Panel App)

> Status: **READY — menunggu perintah**
> Dibuat: 2026-03-29
> Parent plan: `docs/plans/2026-03-29-saas-implementation-plan.md`

---

## Overview

Fase 1 menghasilkan satu Laravel app baru (`pos-app-panel`) yang bisa:
- Login sebagai owner
- CRUD tenant (bisnis klien)
- Konfigurasi modul, limit user/outlet, status, expiry per tenant
- Expose API `GET /api/license/{key}` yang di-consume POS App
- Di-deploy ke Coolify

**Tech Stack:** Laravel 12 + Inertia.js v2 + React 19 + TypeScript + Tailwind CSS v4
(sama persis dengan pos-app — familiar, tidak perlu belajar Filament)

**Total steps: 13**

---

## Step 1 — Buat Project Laravel Baru

**Lokasi:** sejajar dengan `pos-app`
```
/Users/errr/Developer/Project/my/pos-app-panel/
```

```bash
cd /Users/errr/Developer/Project/my
composer create-project laravel/laravel pos-app-panel --prefer-dist
cd pos-app-panel
```

**Verifikasi:** `php artisan --version` → Laravel 12.x

---

## Step 2 — Install Frontend Stack

```bash
# Inertia server-side
composer require inertiajs/inertia-laravel

# Publish middleware
php artisan inertia:middleware

# Frontend
npm install @inertiajs/react react react-dom
npm install -D @types/react @types/react-dom typescript vite @vitejs/plugin-react
npm install -D tailwindcss @tailwindcss/vite
npm install lucide-react clsx
```

**Setup files yang perlu dikonfigurasi:**
- `vite.config.ts` — laravel-vite-plugin + react + tailwind
- `resources/css/app.css` — `@import "tailwindcss"`
- `resources/js/app.tsx` — Inertia createInertiaApp
- `resources/js/ssr.tsx` — SSR entry (opsional, skip dulu)
- `resources/views/app.blade.php` — root template dengan `@inertiaHead` + `@inertia`
- `bootstrap/app.php` — register `HandleInertiaRequests` middleware
- `tsconfig.json` — path alias `@/` → `resources/js/`

**Copy komponen UI dari pos-app** (shadcn pattern sudah ada):
- `resources/js/components/ui/` — Button, Input, Label, Card, Badge, Select, Dialog, Table, dll
- `resources/js/lib/utils.ts` — `cn()` helper

**Verifikasi:** `npm run dev` + `php artisan serve` → halaman welcome render via Inertia

---

## Step 3 — Setup Database & Auth

**Edit `.env`:**
```env
APP_NAME="POS Panel"
APP_KEY=         # generate
APP_URL=http://localhost:8001
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=pos_panel
DB_USERNAME=root
DB_PASSWORD=
SESSION_DRIVER=database
```

```bash
php artisan key:generate
php artisan migrate
```

**Auth:** tidak pakai Breeze/Jetstream — buat manual sederhana:
- `LoginController` dengan `Auth::attempt()`
- Halaman `pages/Login.tsx` — form email + password
- Route: `GET /login`, `POST /login`, `POST /logout`
- Middleware `auth` sudah ada di Laravel, pakai langsung

**Verifikasi:** bisa login/logout, redirect ke `/dashboard` setelah login

---

## Step 4 — Migration & Model: Tenant

```bash
php artisan make:migration create_tenants_table
php artisan make:model Tenant
```

**Schema migration:**
```php
Schema::create('tenants', function (Blueprint $table) {
    $table->id();
    $table->string('business_name');
    $table->string('contact_email')->nullable();
    $table->string('contact_phone')->nullable();
    $table->text('notes')->nullable();
    $table->string('license_key')->unique();   // UUID, auto-generated
    $table->enum('status', ['active', 'trial', 'suspended', 'expired'])->default('trial');
    $table->json('modules');                    // array ModuleKey strings
    $table->unsignedInteger('max_users')->default(5);
    $table->unsignedInteger('max_outlets')->default(2);
    $table->timestamp('expires_at')->nullable();
    $table->timestamp('last_synced_at')->nullable();
    $table->timestamps();
    $table->softDeletes();
});
```

**Model Tenant:**
- `$fillable` semua kolom
- `$casts`: `modules → array`, `expires_at → datetime`, `last_synced_at → datetime`
- `boot()`: auto-generate `license_key = Str::uuid()` pada event `creating`
- Scope `active()`, `expiringSoon(int $days)`

```bash
php artisan migrate
```

**Verifikasi:** tabel `tenants` terbuat

---

## Step 5 — Layout & Struktur Halaman

**Buat layout utama** `resources/js/layouts/PanelLayout.tsx`:
- Sidebar kiri: navigasi (Dashboard, Tenants)
- Header: nama app + tombol logout
- Slot konten kanan

**Struktur halaman:**
```
resources/js/
  layouts/
    PanelLayout.tsx       ← main layout dengan sidebar
  pages/
    Login.tsx             ← halaman login
    Dashboard.tsx         ← overview stats + tabel
    tenants/
      Index.tsx           ← tabel semua tenant
      Create.tsx          ← form tambah tenant
      Edit.tsx            ← form edit tenant
      Show.tsx            ← detail + license key
  components/
    ui/                   ← Button, Input, Badge, Card, dll (copy dari pos-app)
    TenantStatusBadge.tsx ← badge warna per status
    StatsCard.tsx         ← card angka untuk dashboard
```

**Verifikasi:** layout render dengan benar, navigasi berfungsi

---

## Step 6 — TenantController (CRUD)

```bash
php artisan make:controller TenantController --resource
```

**Methods yang dibutuhkan:**

| Method | Route | Halaman |
|--------|-------|---------|
| `index()` | `GET /tenants` | `tenants/Index.tsx` |
| `create()` | `GET /tenants/create` | `tenants/Create.tsx` |
| `store()` | `POST /tenants` | redirect → index |
| `show()` | `GET /tenants/{id}` | `tenants/Show.tsx` |
| `edit()` | `GET /tenants/{id}/edit` | `tenants/Edit.tsx` |
| `update()` | `PUT /tenants/{id}` | redirect → show |
| `destroy()` | `DELETE /tenants/{id}` | redirect → index (soft delete) |

**Tambahan non-resource:**

| Method | Route | Fungsi |
|--------|-------|--------|
| `suspend()` | `PATCH /tenants/{id}/suspend` | Toggle active ↔ suspended |
| `extend()` | `PATCH /tenants/{id}/extend` | Set `expires_at` baru |

**Props yang dikirim ke setiap halaman:**
- `index`: `tenants` (paginated), `filters` (search, status)
- `create`: `availableModules` (array semua ModuleKey)
- `edit`/`show`: `tenant`, `availableModules`

**Validasi di `store()` dan `update()`:**
```php
$request->validate([
    'business_name' => 'required|string|max:255',
    'contact_email' => 'nullable|email',
    'status'        => 'required|in:active,trial,suspended,expired',
    'modules'       => 'required|array|min:1',
    'modules.*'     => 'in:dashboard,pos,items,inventory,warehouses,purchase_orders,customers,suppliers,reports,returns,users',
    'max_users'     => 'required|integer|min:1',
    'max_outlets'   => 'required|integer|min:1',
    'expires_at'    => 'nullable|date|after:today',
]);
```

**Verifikasi:** CRUD tenant berfungsi penuh

---

## Step 7 — Halaman Tenants (Frontend)

### `tenants/Index.tsx`
- Tabel: business_name, status badge, expires_at, max_users, max_outlets, last_synced_at, aksi
- Filter: search by name, filter by status
- Tombol: "Tambah Tenant" → `/tenants/create`
- Row actions: Detail, Edit, Suspend/Aktifkan, Hapus
- Pagination

### `tenants/Create.tsx` & `Edit.tsx`
Form fields:
- **Nama Bisnis** — text input, required
- **Email Kontak** — email input
- **No. Telepon** — text input
- **Status** — select dropdown
- **Tanggal Expired** — date picker
- **Modul Aktif** — checkbox grid (3 kolom, semua 11 modul)
- **Max Users** — number input
- **Max Outlets** — number input
- **Catatan** — textarea

### `tenants/Show.tsx`
- Info lengkap tenant
- **License Key** — tampil dengan tombol copy, monospace font
- Tombol: Edit, Suspend/Aktifkan, Perpanjang (modal dengan date picker)
- Info terakhir sync: `last_synced_at` relative time

**Verifikasi:** semua halaman render, form submit bekerja, validasi error tampil

---

## Step 8 — Dashboard Page

`pages/Dashboard.tsx`

**Stats cards (4 kartu):**
- Tenant Aktif (hijau)
- Tenant Trial (kuning)
- Tenant Suspended (merah)
- Akan Expired ≤7 hari (oranye)

**Tabel "Akan Expired (7 hari)":**
- Kolom: nama bisnis, status, expires_at (highlight merah jika < 3 hari)
- Link ke detail tenant

**Tabel "Belum Sync (> 3 hari)":**
- Tenant dengan `last_synced_at < now-3days` atau null
- Kolom: nama bisnis, last_synced_at ("Belum pernah" jika null), status
- Indikasi: instance POS mungkin down

**DashboardController:**
```php
return Inertia::render('Dashboard', [
    'stats' => [
        'active'         => Tenant::where('status','active')->count(),
        'trial'          => Tenant::where('status','trial')->count(),
        'suspended'      => Tenant::where('status','suspended')->count(),
        'expiring_soon'  => Tenant::active()->expiringSoon(7)->count(),
    ],
    'expiring'  => Tenant::active()->expiringSoon(7)->orderBy('expires_at')->get(...),
    'stale'     => Tenant::where(fn($q) => $q->whereNull('last_synced_at')
                       ->orWhere('last_synced_at','<', now()->subDays(3))
                   )->get(...),
]);
```

**Verifikasi:** angka stats benar, tabel muncul dengan data

---

## Step 9 — API: LicenseController + Route

```bash
php artisan make:controller Api/LicenseController
```

**Logic `show(string $key)`:**
1. Cari tenant `where('license_key', $key)->withTrashed()`
2. Jika null → `response()->json(['error' => 'License not found'], 404)`
3. Jika `trashed()` → `response()->json(['error' => 'License revoked'], 403)`
4. Jika `expires_at` sudah lewat && status bukan `expired` → update status `expired`
5. Update `last_synced_at = now()`
6. Return 200 JSON:

```json
{
    "status": "active",
    "tenant_name": "Toko ABC",
    "expires_at": "2026-12-31T23:59:59Z",
    "modules": ["dashboard","pos","items"],
    "limits": {
        "max_users": 5,
        "max_outlets": 2
    },
    "synced_at": "2026-03-29T10:00:00Z"
}
```

**`routes/api.php`:**
```php
Route::middleware('throttle:10,1')->group(function () {
    Route::get('/license/{key}', [LicenseController::class, 'show']);
});
```

**Verifikasi:**
- Valid key → 200
- Invalid key → 404
- Deleted key → 403
- Hit 11x dalam 1 menit → 429

---

## Step 10 — Seeder

```bash
php artisan make:seeder AdminUserSeeder
php artisan make:seeder DemoTenantSeeder
```

**AdminUserSeeder** — idempotent:
```php
User::firstOrCreate(
    ['email' => env('PANEL_ADMIN_EMAIL', 'owner@panel.local')],
    ['name' => 'Owner', 'password' => bcrypt(env('PANEL_ADMIN_PASSWORD', 'password'))]
);
```

**DemoTenantSeeder** — 2 tenant contoh (1 aktif, 1 trial):
- Tenant A: status `active`, semua modul, expires 1 tahun
- Tenant B: status `trial`, modul terbatas (pos + items + dashboard), expires 14 hari

**Verifikasi:** `php artisan db:seed` → tenant muncul di halaman index

---

## Step 11 — Dockerfile & docker-compose.yml

**`Dockerfile`** — single stage (tidak ada Node di runtime):
```dockerfile
# Stage 1: Build frontend
FROM node:22.22.2-alpine AS frontend-builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: PHP runtime
FROM php:8.3.30-fpm-alpine

RUN apk add --no-cache nginx supervisor libpng-dev libxml2-dev zip unzip libzip-dev
RUN docker-php-ext-install pdo_mysql bcmath gd zip

COPY ./docker/nginx/default.conf /etc/nginx/http.d/default.conf
COPY ./docker/supervisord.conf /etc/supervisor/conf.d/supervisord.conf

WORKDIR /var/www/html
COPY --chown=www-data:www-data . .
COPY --from=frontend-builder --chown=www-data:www-data /app/public /var/www/html/public

COPY --from=composer:latest /usr/bin/composer /usr/bin/composer
RUN mkdir -p bootstrap/cache storage/logs storage/framework/cache \
        storage/framework/sessions storage/framework/views \
    && chmod -R 775 bootstrap/cache storage \
    && composer install --no-dev --optimize-autoloader

COPY ./docker/start.sh /usr/local/bin/start.sh
RUN chmod +x /usr/local/bin/start.sh

EXPOSE 80
CMD ["/usr/local/bin/start.sh"]
```

**`docker/start.sh`:**
```sh
#!/bin/sh
set -e

echo "[start] Waiting for MySQL..."
until php -r "new PDO('mysql:host=${DB_HOST};port=${DB_PORT:-3306};dbname=${DB_DATABASE}', '${DB_USERNAME}', '${DB_PASSWORD}');" 2>/dev/null; do
    sleep 2
done
echo "[start] MySQL ready."

mkdir -p storage/framework/cache storage/framework/sessions \
         storage/framework/views storage/logs
chown -R www-data:www-data storage bootstrap/cache
chmod -R 775 storage bootstrap/cache

php artisan migrate --force --ansi
php artisan db:seed --class=AdminUserSeeder --force --ansi

php artisan config:cache --ansi
php artisan route:cache --ansi
php artisan view:cache --ansi

exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
```

**`docker-compose.yml`:**
```yaml
services:
  panel:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: pos_panel
    restart: always
    ports:
      - "8080:80"
    volumes:
      - ./storage:/var/www/html/storage
    env_file:
      - .env
    networks:
      - default
      - coolify

networks:
  coolify:
    external: true
```

**`docker/nginx/default.conf`** dan **`docker/supervisord.conf`** — copy identik dari pos-app.

**`.dockerignore`** — copy identik dari pos-app.

**Verifikasi:** `docker compose build` berhasil, `docker compose up -d` → panel jalan di port 8080

---

## Step 12 — Deploy ke Coolify

**Di Coolify:**
1. Project baru: `POS Panel`
2. Source: GitHub repo `pos-app-panel`
3. Environment variables:
```
APP_NAME=POS Panel
APP_ENV=production
APP_KEY=base64:...
APP_URL=https://<domain-panel>
APP_DEBUG=false
DB_CONNECTION=mysql
DB_HOST=<mariadb-hostname-coolify>
DB_PORT=3306
DB_DATABASE=pos_panel
DB_USERNAME=...
DB_PASSWORD=...
SESSION_DRIVER=database
SESSION_SECURE_COOKIE=false
TRUSTED_PROXIES=*
PANEL_ADMIN_EMAIL=owner@...
PANEL_ADMIN_PASSWORD=<kuat>
```
4. Network: tambahkan `coolify` network
5. Deploy

**Verifikasi:**
- Panel bisa diakses di domain
- Login berhasil
- `GET <domain>/api/license/<key>` → 200 JSON

---

## Step 13 — Test End-to-End Fase 1

**Checklist:**

- [ ] Login dengan email+password owner → redirect ke dashboard
- [ ] Dashboard: 4 stat cards menampilkan angka yang benar
- [ ] Dashboard: tabel "Akan Expired" muncul tenant yang expires ≤7 hari
- [ ] Dashboard: tabel "Belum Sync" muncul tenant dengan last_synced_at null/lama
- [ ] Tambah tenant baru → license_key ter-generate otomatis (UUID)
- [ ] Edit tenant → perubahan modul/limit/status tersimpan
- [ ] Halaman Show tenant → license key bisa di-copy
- [ ] Suspend tenant → status berubah, badge merah
- [ ] Aktifkan kembali → status active, badge hijau
- [ ] Perpanjang expired → expires_at terupdate
- [ ] `GET /api/license/{valid_key}` → 200, JSON benar, last_synced_at terupdate
- [ ] `GET /api/license/{invalid_key}` → 404
- [ ] `GET /api/license/{deleted_key}` → 403
- [ ] Hit API > 10x / menit → 429
- [ ] Soft delete tenant → tidak muncul di list, API return 403

**Fase 1 selesai jika semua ✅**

---

## Setelah Fase 1 Selesai → Lanjut Fase 2

Fase 2: modifikasi `pos-app` untuk consume API panel ini.
Detail di `docs/plans/2026-03-29-saas-implementation-plan.md` bagian Fase 2.
