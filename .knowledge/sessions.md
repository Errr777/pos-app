# Session Log

Catatan ringkasan per sesi kerja. Terbaru di atas.

---

## 2026-04-07 (sesi 11)

### Yang dikerjakan

**Fix item delete FK constraint violation**
- `ItemController::destroy()` sebelumnya langsung `$item->delete()` → SQL FK error tanpa pesan jelas
- Sekarang cek 2 level: **transaksi historis** (saleItems, purchaseOrderItems, returnItems) dan **operasional gudang** (deliveryOrderItems, stockTransfers)
- Transaksi historis → pesan: "sudah pernah digunakan dalam transaksi X. Data historis harus tetap terjaga. Nonaktifkan item jika tidak ingin ditampilkan."
- Operasional → pesan: "terdapat data surat jalan/transfer stok yang masih terkait"
- Tambah 5 relasi baru ke `Item` model: `saleItems()`, `purchaseOrderItems()`, `returnItems()`, `deliveryOrderItems()`, `stockTransfers()`
- Frontend: ganti `alert()` dengan dialog modal styled (ikon warning, judul, tombol Mengerti)
- Inertia flash.error dibaca dari `page.props` di `onSuccess` callback (bukan `onError`) karena backend return redirect

### Commits
- `9340c4d` fix: block item delete when linked to delivery orders or stock transfers
- `4528818` fix: block item delete with clear error when linked to transactions

---

## 2026-04-06 (sesi 10)

### Yang dikerjakan

**Bug fix: timestamp mismatch di webhook** (panel)
- `WebhookDispatcher` kirim `timestamp` sebagai ISO string → tenant cast ke int selalu dapat 0 → business info tidak pernah terupdate via webhook
- Fix: `now()->toISOString()` → `now()->timestamp` di `app/Services/WebhookDispatcher.php`

**HTTPS fix (Mixed Content errors di production)**
- `bootstrap/app.php` — tambah `$middleware->trustProxies(at: '*')` (kedua repo)
- `app/Providers/AppServiceProvider.php` — tambah `URL::forceScheme('https')` saat production
- Root cause: Traefik terminate SSL, forward ke container via HTTP → Laravel generate `http://` URLs

**Fix test webhook 500**
- `TenantController::testWebhook()` pakai `Http::post($url, $array)` → PHP re-encode JSON berbeda → HMAC mismatch + body tidak terenkripsi
- Fix: encrypt dulu dengan AES-256-CBC, sign dengan HMAC-SHA256, kirim via `withBody($body, 'application/json')`

**Fix delivery order / stok opname 404**
- URL pakai hashid tapi implicit model binding expect integer
- Fix: tambah `Route::bind('deliveryOrder', ...)` + `Route::bind('opname', ...)` di `AppServiceProvider::boot()`

**Fix stok tidak masuk warehouse saat tambah barang**
- `ItemController::store()` hanya simpan ke `items.stok`, tidak buat `warehouse_items` records
- Fix: loop semua active warehouses, buat `WarehouseItem` per warehouse (default warehouse dapat stok dari form, lainnya 0)
- Backfill existing items via tinker

**Fix promotions integer validation error**
- `min_purchase`/`max_discount` dikirim sebagai string `'0'` → gagal validasi `integer`
- Fix: `emptyForm` pakai integer `0`, onChange pakai `parseInt()`, hapus `String()` cast di edit mode

**Fix POS 500 Undefined array key payment_method**
- Split payment tidak kirim field `payment_method` → `$data['payment_method']` undefined
- Fix: `($data['payment_method'] ?? null) === 'credit'`

**POS Terminal: outlet dropdown**
- Ganti tombol-tombol outlet dengan `<select>` dropdown + tombol "Pilih"
- Two-state: `warehouseId` (aktif) + `pendingWarehouseId` (dipilih tapi belum apply)
- Warning "Belum diterapkan" jika pending ≠ active
- `outletData` state: `Record<string, {price: number; stock: number}>` — resolved dari `/pos/items?warehouse_id=X`

**Disable stock input saat edit item**
- Stock field disabled jika `form.data.id` ada (edit mode), tampilkan hint "(ubah via Stok Opname)"

**AdminSeeder**
- `database/seeders/AdminSeeder.php` — interaktif, idempotent
- Command: `php artisan db:seed --class=AdminSeeder`

### Commits
- `fd32baf` fix(tenant): force HTTPS scheme and trust all proxies behind Traefik
- `b3e5aff` chore(tenant): update knowledge base

---

## 2026-04-05 (sesi 9)

### Yang dikerjakan

**Sub-project B: Onboarding Wizard Polish**
- `resources/js/components/logo-upload.tsx` — baru; drag-and-drop + preview, objectUrlRef cleanup, keyboard accessible, drop validation inline
- `resources/js/pages/onboarding/Index.tsx` — step indicator polish (Langkah N dari 2), `key={step}` slide animation, LogoUpload
- `resources/js/pages/settings/store.tsx` — LogoUpload, outlet section (name/city/phone), `outlet != null` guard
- `resources/js/pages/auth/register.tsx` — 9 copy Indonesia
- `app/Http/Controllers/AppSettingController.php` — edit() load warehouse default, update() validasi outlet fields

**Module Sync (dari panel)**
- `database/migrations/2026_04_05_000001_add_tenant_pushed_at_to_license_configs.php` — baru
- `app/Models/LicenseConfig.php` — `tenant_pushed_at` di `$fillable` + `$casts`
- `app/Http/Controllers/Api/PanelWebhookController.php` — decrypt AES-256-CBC payload; handle `license.modules_updated` (modules selalu update, business info hanya jika panel lebih baru dari `tenant_pushed_at`)
- `app/Jobs/LicenseSyncJob.php` — tambah sync `contact_email` → `store_email`, `contact_address` → `store_address`
- `app/Jobs/PushSettingsToPanelJob.php` — push `store_email` + `store_address`; set `tenant_pushed_at` setelah sukses

### Deploy Status
- Perlu `php artisan migrate` di production (migration `add_tenant_pushed_at_to_license_configs`)
- Setelah deploy: webhook dari panel akan terenkripsi AES-256-CBC — pastikan panel juga sudah di-deploy

---

## 2026-04-03 (sesi 7)

### Yang dikerjakan (pos-app-panel)
- **Tenant Create/Edit — Subscription section**: tambah plan selector (auto-fill expires_at), field `monthly_price`, `discount_pct`, `billing_cycle_days`, live effective price preview — `TenantController::create()/edit()/store()/update()` diupdate
- **PanelExpense module**: migration `panel_expenses`, Model `PanelExpense`, `PanelExpenseController` (index/store/update/destroy, filter year/month, monthly summary, category breakdown), halaman `expenses/Index.tsx` (3-col layout, modal CRUD, category autocomplete)
- **Subscription P&L Report**: `ReportController::subscriptions()` — MRR via `effectivePrice()`, expiry calendar 3 bucket (30/60/90d), monthly P&L vs beban, lifecycle funnel; halaman `reports/Subscriptions.tsx` (4 top cards, PnlBar SVG, expiry list badge, funnel, MRR breakdown table)
- Sidebar: tambah "Subscription P&L" di section Laporan + section "Keuangan" (Beban Operasional)
- Build sukses — commit `874bc02`

### Deploy Status
- pos-app-panel: commit `874bc02` — perlu Coolify redeploy + `php artisan migrate` (3 migration baru)
- pos-app-production: tidak ada perubahan sesi ini

### Plan / Todo Berikutnya
- Coolify redeploy pos-app-panel dengan `php artisan migrate`
- Edge case: tenant tanpa plan assigned → effective price 0 di MRR breakdown (UI nudge opsional)
- Future: email notifikasi saat tenant expires, CSV export subscription P&L

---

## 2026-04-03 (sesi 6)

### Yang dikerjakan (pos-app-panel)
- **Priority #1 Dashboard Health Overview**: sparkline 24 jam (hijau/kuning/merah per jam), uptime rate %, avg response ms, tenant online count — commit `3c5e522`
- **Priority #2 `/reports/tenants`** — Tenant Overview table: 8 summary cards, filter status+uptime, tabel semua tenant (uptime rate 7d bar, avg RT, trx kemarin, last sync), export CSV — commit `4fcc60e`
- **Priority #3 `/reports/uptime`** — Uptime & SLA: platform aggregate cards, period 7/14/30d, tabel sorted uptime terendah, incident count, baris merah <95%, export CSV — commit `4fcc60e`
- **Priority #4 `/reports/usage`** — Usage Trends: SVG line chart (no lib), churn risk detection (<50% reporting days), per-tenant trend vs prior period, export CSV — commit `a17fbf7`
- **Priority #5 Dashboard Growth + Usage Aggregate**: Growth card (new tenants, converted, expiring 30d) + Usage Aggregate (trx 7d delta %) — commit `a17fbf7`
- **Subscription Plans feature**: migration `subscription_plans` + kolom di tenants (`plan_id`, `monthly_price`, `discount_pct`, `billing_cycle_days`), Model `SubscriptionPlan`, `Tenant::effectivePrice()` + `effectiveDurationDays()`, `SubscriptionPlanController` CRUD, halaman `/plans` dengan card grid + modal, MRR estimate — commit `ef4f1ad`

### Deploy Status
- pos-app-panel: 4 commits baru (3c5e522, 4fcc60e, a17fbf7, ef4f1ad) — perlu Coolify redeploy + `php artisan migrate`
- pos-app-production: belum di-sync sesi ini (tidak ada perubahan di pos-app)

### Plan / Todo Berikutnya (sesi 7)
1. Update `Create.tsx` + `Edit.tsx` tenant — tambah plan selector (auto-fill harga/durasi) + discount_pct field
2. `ReportController::subscriptions()` — MRR aktual (pakai `effectivePrice()`), expiry calendar 30/60/90d, lifecycle funnel
3. `reports/Subscriptions.tsx` — halaman subscription report
4. `PanelExpenseController` + migration `panel_expenses` + `expenses/Index.tsx`
5. Laporan P&L panel (pendapatan dari subscription - beban operasional)

---

## 2026-04-01 (sesi 5)

### Yang dikerjakan (pos-app-panel)
- **Auto-save webhook_url saat tenant sync**: `LicenseSyncJob` mengirim `X-App-Url` header; `LicenseController` membaca header, validasi, simpan `app_url` + derive `webhook_url` = `app_url + /api/panel-webhook`
- **Fix "An option named 'version' already exists"**: `SetDeployTimestamp.php` rename `{--version=}` → `{--app-version=}`; `start.sh` tambah `|| true` agar container tidak crash
- **Fix input text tidak terlihat** di panel Edit/Create tenant: tambah `text-gray-900` via shared `INPUT` constant
- **Fix app_url accept `http://`**: backend regex `^https://` → `^https?://`; frontend hint update ke `http://` atau `https://`
- **Fix webhook_url paste tidak berfungsi**: tambah `onPaste` handler eksplisit di Edit.tsx
- **Fix webhook_url tidak tersimpan saat edit**: `webhook_url` tidak ada di `update()` validate rules — tambah ke rules
- **Fix monitoring tidak berjalan**: `supervisord.conf` panel tidak punya scheduler — tambah `[program:scheduler]` process
- **Tombol Ping Manual**: `pingNow()` di TenantController + route `POST /tenants/{tenant}/ping`; Show.tsx ping button dengan 15-menit cooldown, result card, countdown timer
- **Update docs**: `DEPLOYMENT.md` rewrite, `USER_GUIDE.md` pos-app tambah Section 19, `USER_GUIDE.md` panel baru, `setup-guide.html` + PDF via puppeteer
- **Max outlet/user enforcement**: lewati — sudah ada di `WarehouseController` + `UserController` dari sesi sebelumnya

### Deploy Status
- pos-app-panel: commit `9099a8e` (build sukses) — perlu Coolify redeploy untuk supervisord + ping button
- pos-app-production: mass commit `ec9e933` (SetDeployTimestamp fix)

### Plan / Todo Berikutnya
- Coolify redeploy: pos-app-panel (scheduler + ping) + pos-app-production (start.sh fix)
- Setelah redeploy: monitoring uptime check otomatis berjalan setiap 15 menit

---

## 2026-03-31 (sesi 4)

### Yang dikerjakan
- **Multi Payment Split** (pos-app) — selesai penuh
  - Migration `sale_payment_splits`, Model `SalePaymentSplit`, `SaleHeader::paymentSplits()` hasMany
  - `PosController::store()`: terima `payments[]` array, validasi `sum === grandTotal`, set `payment_method='multiple'`, buat split rows
  - `show()` / `print()` / `invoice()`: eager-load paymentSplits, kirim ke props
  - `Terminal.tsx`: state `splitPayments[]`, UI split rows, `splitRemaining` counter, auto-fill single row
  - `Show.tsx`, `Print.tsx`, `Invoice.tsx`: conditional display jika `paymentMethod === 'multiple'`
- **Phase 3 SaaS** (pos-app-panel) — selesai penuh
  - **Audit Log**: migration `audit_logs`, `AuditLog` model, `Auditable` trait (model events + explicit `audit()`), Dashboard section 50 entries terbaru
  - **Email Notifications**: `TenantNotificationMail`, blade template untuk semua event, `CheckExpiringLicenses` command, schedule `dailyAt('08:00')`, dispatch di suspend/activate/extend/auto-expire
  - **Webhooks**: `WebhookDispatcher` service, `SendWebhookJob` (3 retries, HMAC-SHA256), `WebhookLog` model, migrations (webhook_logs, webhook_url/secret di tenants), field di Edit form
- Fix dpAmount clamp di Terminal.tsx (`Math.min(dpAmount, grandTotal)`)
- Indonesianize breadcrumbs Stock_In.tsx + Stock_Out.tsx

### Plan / Todo Berikutnya
- Tidak ada. Semua plan selesai.

---

## 2026-03-31 (sesi 3)

### Yang dikerjakan
- **Fix settings page crash** — `React.Children.only` error saat buka `/settings/profile`
  - Root cause: `Button` component dengan `asChild=true` menggunakan Radix `Slot`; `{loading && <Loader2>}` selalu render (sebagai `false`) sebagai child kedua → `Slot` hanya terima 1 child
  - Fix: kondisional — jika `asChild`, render `children` saja; jika tidak, render `<>{spinner}{children}</>`
  - Deploy via git push + Coolify redeploy

### Plan / Todo Berikutnya
- Phase 3 SaaS (opsional): email notifikasi expired, webhook, audit log

---

## 2026-03-31 (sesi 2)

### Yang dikerjakan
- Phase 2 SaaS integrasi pos-app ↔ panel — selesai penuh
  - Migration + Model `LicenseConfig`
  - `LicenseSyncJob` polling panel API setiap 6 jam
  - `CheckLicense` middleware — block jika suspended/expired
  - `license:setup` artisan command
  - Sidebar filter berdasarkan `license.modules`
  - Guard `max_users` di UserController, `max_outlets` di WarehouseController
  - `LicenseInvalid` page
- Merge `feature/saas-license-integration` → main
- Sync ke production folder + redeploy Coolify
- License aktif di production:
  - Key: 6d76248c-09bd-4338-9271-1b093ac6cd5a
  - Panel: rb0g3451ec7bg1pici3c9f1z.72.62.125.181.sslip.io
  - Status: active, semua modul aktif

### Plan / Todo Berikutnya
- Phase 3 (opsional): email notifikasi expired, webhook, audit log

---

## 2026-03-31 (sesi 1)

### Yang dikerjakan
- SaaS Control Panel Fase 1 selesai penuh:
  - Step 10: DemoTenantSeeder (5 tenant demo)
  - Step 11: Docker setup (start.sh auto-seed on first boot)
  - Step 12: Deploy ke Coolify (panel_db MariaDB terpisah, coolify network)
  - Step 13: E2E testing via Playwright — semua 11 test PASS
- Bug fix: Dashboard.tsx case sensitivity (Linux case-sensitive fs)
- Bug fix: login input text color (tambah text-gray-900 bg-white)
- Panel live di: rb0g3451ec7bg1pici3c9f1z.72.62.125.181.sslip.io

### Plan / Todo Berikutnya
- Fase 2: Modifikasi pos-app untuk integrasi license panel

---

## 2026-03-29 (sesi 2)

### Yang dikerjakan
- SaaS Control Panel Fase 1, Step 1–9 selesai di `/pos-app-panel/` (repo terpisah)
  - Stack: Laravel 12 + Inertia v2 + React 19 + TypeScript + Tailwind v4 (mirror pos-app, tanpa Filament)
  - Step 1-4: project setup, auth, migrasi, Model Tenant (uuid license_key, scopes)
  - Step 5: PanelLayout, Login page, Dashboard (stats cards, expiring, stale tables)
  - Step 6: TenantController CRUD + suspend/activate/extend actions
  - Step 7: tenants/Index, Create, Edit, Show pages
  - Step 8: DashboardController (stats + expiring + stale queries)
  - Step 9: Api/LicenseController (GET /api/license/{key}) + throttle
  - Build `npm run build` sukses, semua routes resolve

### Plan / Todo Berikutnya
- Step 10: DemoTenantSeeder
- Step 11: Dockerfile + docker-compose untuk pos-app-panel
- Step 12: Deploy ke Coolify
- Step 13: End-to-end testing
- Fase 2: Modifikasi POS App (license sync middleware, guard limits, sidebar filter)

---

## 2026-03-29 (sesi 1)

### Yang dikerjakan
- Cek status semua 5 fitur di `docs/plans/2026-03-10-feature-upgrades.md`:
  - ✅ Export Laporan — sudah selesai
  - ✅ Auto Draft PO — sudah selesai
  - ✅ Laporan P&L — sudah selesai
  - ✅ Diskon & Promo — sudah selesai
  - ⚠️ Multi Payment Split — sebagian (kredit cicilan ada, split payment belum)
- Update `docs/plans/2026-03-10-feature-upgrades.md` dengan tabel status implementasi
- Merge & hapus branch `feature/hash-ids` + `feature/umkm-settings` (main sudah lebih lengkap)
- Buat plan detail SaaS Control Panel di `docs/plans/2026-03-29-saas-implementation-plan.md`

### Plan / Todo Berikutnya
- Lanjut SaaS Control Panel Fase 1 step 10+

---

## 2026-03-28

### Yang dikerjakan
- **Buat `sync-to-production.sh`** — script rsync dev → production folder, lalu docker build + up
- **Analisis & fix Docker setup** (semua masalah kritis + medium):
  - Fix: `start.sh` tidak pernah dipanggil (CMD langsung ke supervisord) — wire ke CMD
  - Fix: `start.sh` punya blok SQLite padahal DB adalah MySQL — hapus blok itu
  - Fix: tidak ada MySQL healthcheck → app start sebelum DB siap — ganti dengan wait loop PDO di start.sh
  - Fix: tidak ada `.dockerignore` → `.env`, `node_modules/`, `.knowledge/` ikut masuk image — buat `.dockerignore`
  - Fix: tidak ada queue worker di supervisord — tambah `[program:queue-worker]` dengan `queue:work`
  - Fix: brace expansion `{}` tidak bekerja di Alpine `/bin/sh` — ganti dengan explicit mkdir per path
  - Fix: `bootstrap/cache` dan `storage/framework/*` dihapus volume mount → `view:cache` crash — buat dir di `start.sh` runtime
  - Fix: `npm install` → `npm ci` di Dockerfile Stage 1 (reproducible build)
  - Fix: pin base images ke versi spesifik: `node:22.22.2-alpine`, `php:8.3.30-fpm-alpine`
  - Fix: install PHP extension `calendar` (dibutuhkan `cal_days_in_month()` di seeder)
- **Setup Coolify deployment** (MySQL container dihapus, pakai MariaDB di jaringan Coolify):
  - Remove MySQL service dari docker-compose, tambah `coolify` external network
  - `DB_HOST` = hostname container MariaDB (`r11dbyuafh32c0kx8ikqh1n9`)
  - Semua env vars di-set di Coolify dashboard (`.env` excluded dari image via `.dockerignore`)
- **Fix 419 CSRF error saat login**:
  - Root cause: `TRUSTED_PROXIES` tidak di-set → Laravel tidak detect HTTPS dari proxy Coolify → session cookie salah
  - Fix: tambah `TRUSTED_PROXIES=*` di Coolify env vars
  - Fix: `SESSION_SECURE_COOKIE=false` (container menerima HTTP, SSL di-terminate di Coolify proxy)
  - Fix: `APP_URL=http://...` (bukan https — container side adalah HTTP)

### Coolify Env Vars yang Wajib Ada
Lihat bagian Docker di `docs/KNOWLEDGE_BASE.md`

### Plan / Todo Berikutnya
*(tidak ada)*

---

## 2026-03-27

### Yang dikerjakan
- **Fix RangeError crash di promo edit** (`PromotionController.php`)
  - Root cause: Eloquent `'date'` cast menyebabkan `$p->start_date` / `$p->end_date` di-serialize ke ISO 8601 (`"2026-03-15T00:00:00.000000Z"`) saat dikirim via Inertia — bukan `"YYYY-MM-DD"`
  - DatePickerInput menambahkan `'T00:00:00'` ke string yang sudah ada `T...Z` → invalid Date → react-day-picker crash
  - Fix: tambah `->format('Y-m-d')` eksplisit di dua tempat (Inertia response ~L62 + JSON API response ~L165)
- **Fix Beban date filter no data** (`ExpenseController.php`)
  - First attempt: `whereDate()` — masih tidak bekerja di MariaDB/MySQL production
  - Final fix: pakai pattern established `>= $dateFrom . ' 00:00:00'` dan `<= $dateTo . ' 23:59:59'` (sama seperti ReturnController / ReportController)
  - Fix `$request->get('date_from', $default)` tidak handle empty string → pakai `$request->get('date_from') ?: $default`
- **Fix Beban warehouse/outlet filter no data**
  - Root cause: `dhid()` return `0` pada input invalid/empty → `WHERE warehouse_id = 0` → no results
  - Fix: decode dulu, guard `$wId > 0 && (empty($allowedIds) || in_array($wId, $allowedIds))` sebelum apply filter
- **Fix Beban category filter no effect**
  - Root cause: `->when($category !== '', fn($q) => ...)` closure pattern bermasalah dengan null/empty edge cases
  - Fix: ganti dengan explicit `if ($category !== '') { $query->where('category', $category); }`
- **Perbaiki pagination Beban** (`resources/js/pages/expenses/Index.tsx`)
  - Ganti flat page buttons dengan windowed pagination (max 10 tombol, ellipsis, Prev/Next, Go-to-page input)
  - Tidak ada perubahan UI lainnya

### Plan / Todo Berikutnya
*(tidak ada)*

---

## 2026-03-26 (hashid implementation — lanjutan multi-sesi)

### Yang dikerjakan
- Selesaikan Task 4 (controller encode/decode):
  - `ItemVariantController` — encode `id` di `store()` dan `update()` response
  - `AuditLogController` — encode `id`, `userId`, `subjectId` di through()
  - `KategoriController::show()` — fix `toArray()` yang bocorkan integer `id`
  - `InstallmentPlanMapper::forCustomer()` — encode plan `id` dan payment `id`
- Task 5 (TypeScript types):
  - `index.d.ts` — `User.id: number → string`, `allowedWarehouseIds: number[] → string[]`
  - `lib/db.ts` — semua entity ID fields diubah ke `string`; tambah Dexie v2 upgrade (clear stale numeric-ID data)
  - `hooks/use-offline-cart.ts` — `warehouseId: string | null`, fix restore logic pakai `safeStr`
- Task 6 (frontend pages — 76 file diupdate):
  - Semua `id: number` di interfaces/types diubah ke `string`
  - Hapus semua `parseInt(id)` / `Number(id)` casts di entity IDs
  - Fix `=== 0` ID comparisons → `=== ''`
  - Fix `Suggestions.tsx` supplier override dari `Number(e.target.value)` → string langsung
  - `pos/Terminal.tsx` — fix `updateQty`, `updateDiscount`, `removeFromCart` parameter types
- TypeScript check: **0 errors**

### Plan / Todo Berikutnya
- Task 7: Full type check + smoke test (sudah done TypeScript, perlu smoke test manual di browser)
- Deploy: pastikan offline transactions sudah sync sebelum deploy (Dexie v2 upgrade akan clear cart)

---

## 2026-03-26

### Yang dikerjakan
- Fix date picker tidak bisa diklik di dalam Radix Dialog (modal PO Tambah PO)
  - Root cause: Radix Dialog menyetel `pointer-events: none` pada body; PopoverContent mewarisi ini
  - Fix: tambah `pointer-events-auto` ke base class `PopoverContent` di `components/ui/popover.tsx`
- Fix hashid ID type mismatch di semua halaman:
  - `purchase-orders/Index.tsx` — `ItemOption`, `SupplierOption`, `WarehouseOption`, `PoRow`, `CartLine.itemId` diubah ke `string`; hapus `Number()` conversion
  - `inventory/Stock_Adjustment.tsx`, `Stock_Transfer.tsx`, `Stock_Opname.tsx`, `DeliveryOrders.tsx`, `CreateDeliveryOrder.tsx`
  - `Items/Add_Items.tsx`, `Items/Index.tsx`, `category/Index.tsx`
  - `pos/Terminal.tsx` — fix customer select race condition + credit payment flow
  - `hooks/use-offline-cart.ts`, `lib/db.ts` — `customerId` type `number → string`
- Update dokumentasi: `APP_DOCUMENTATION.md`, `USER_GUIDE.md`, `KNOWLEDGE_BASE.md`
- Sync semua perubahan ke production folder

### Plan / Todo Berikutnya
- Setup hook Claude Code session logging (SessionStart + Stop di `.claude/settings.json`) — **selesai di sesi lanjutan**

---

## 2026-03-26 (sesi audit & patch)

### Yang dikerjakan
- Full QA audit: cek koneksi frontend–backend di semua modul
- **Temuan utama**: hashid di frontend-only (TypeScript types `id: string`) tapi backend tidak pernah diimplementasi — semua controller masih kirim integer ID
- **Fix #1 & #4**: Revert semua TypeScript `id: string → id: number` di 13 file frontend:
  - `purchase-orders/Index.tsx`, `inventory/DeliveryOrders.tsx`, `inventory/Stock_Opname.tsx`
  - `category/Index.tsx`, `inventory/Stock_Adjustment.tsx`, `inventory/Stock_Transfer.tsx`
  - `inventory/CreateDeliveryOrder.tsx`, `Items/Index.tsx`, `Items/Add_Items.tsx`
  - `pos/Terminal.tsx` — fix customer select `Number(v)` conversion
  - `hooks/use-offline-cart.ts`, `lib/db.ts` — `customerId: string|null → number|null`
- **Fix #2**: Tambah try-catch ke `ReturnController::store()` around `DB::transaction()` — catch `\RuntimeException`, return 422 JSON atau `back()->withErrors()`
- Update memory: `feedback_hashid_string_type.md` — dikoreksi dari "string hashids" ke "plain integers"

### Plan / Todo Berikutnya
- Hashid implementation masih bisa dilakukan di masa depan (lihat plan di `docs/superpowers/plans/2026-03-23-api-access.md`)

---

## 2026-03-26 (lanjutan)

### Yang dikerjakan
- Setup hooks di `.claude/settings.json`:
  - `SessionStart` hook: inject reminder untuk membaca `.knowledge/sessions.md` dan `.knowledge/bugs-and-todos.md`
  - `Stop` hook: inject reminder untuk mengupdate kedua file di akhir sesi
  - JSON valid, hooks terdaftar
- Audit HIGH priority bugs dari backlog:
  - Semua 3 bug HIGH priority sudah selesai di codebase (bukan baru dikerjakan, tapi sudah ada sebelumnya)
  - Bug #1 (void orphan): `PosController::void()` L661-668 sudah ada guard
  - Bug #2 ($allDone OR): `InstallmentController::pay()` L650 sudah pakai `whereNotIn`
  - Bug #3 (schedule total): `PosController::store()` L449-452 sudah ada validasi
  - Update `.knowledge/bugs-and-todos.md` — hapus item yang sudah selesai

### Plan / Todo Berikutnya
- Backlog tersisa: QR code URL encoding & memory leak `URL.createObjectURL` di `Add_Items.tsx` (low priority)

---
