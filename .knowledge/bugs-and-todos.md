# Bugs & Todos Aktif

Update file ini setiap sesi. Hapus item yang sudah selesai.

---

## 🐛 Bug Aktif
*(tidak ada saat ini)*

## ✅ Bug Selesai (sesi ini)
- **Settings page crash** — `React.Children.only` error di `Button` component saat `asChild=true`; fix: wrap kondisional (2026-03-31)
- **Panel: input text tidak terlihat** — tambah `text-gray-900` di Edit.tsx via `INPUT` constant (2026-04-01)
- **Panel: webhook_url tidak tersimpan** — `webhook_url` hilang dari `update()` validate rules; fix: tambah ke rules (2026-04-01)
- **Panel: monitoring tidak jalan** — `supervisord.conf` tidak punya scheduler; fix: tambah `[program:scheduler]` (2026-04-01)
- **Panel: app_url tolak `http://`** — regex `^https://` terlalu ketat; fix: `^https?://` (2026-04-01)
- **Container crash: "An option named 'version' already exists"** — `{--version=}` konflik dengan Artisan built-in; fix: rename ke `{--app-version=}` + `|| true` di start.sh (2026-04-01)

---

## ✅ Todo / Plan Aktif

- **SaaS Control Panel** — Fase 1 ✅ + Fase 2 ✅ + Fase 3 ✅ + Laporan/Analytics ✅ selesai.
- **Multi Payment Split** ✅ selesai (2026-03-31)
- **Subscription Plans** ✅ selesai (2026-04-03)
- **Onboarding Wizard Polish** ✅ selesai (2026-04-05)
- **Module Sync (webhook enkripsi + auto-push)** ✅ selesai (2026-04-05)

## 📋 Pending Deploy
- `php artisan migrate` di production pos-app (`add_tenant_pushed_at_to_license_configs`)
- Deploy pos-app-panel bersamaan agar webhook encryption sinkron

## 📋 Backlog
- DashboardTest pre-existing failure (factory user tanpa role → 403) — perlu fix terpisah
- Edge case: tenant tanpa plan → effective price 0 di Subscription P&L (opsional: UI nudge)
- Future: email notifikasi expired tenant, CSV export P&L

---

## 📋 Backlog (diketahui tapi belum dikerjakan)

*(tidak ada)*

## ✅ Refactor Selesai (audit 2026-03-31)

- Stock History + Log → sudah di-merge ke `StockViewPage` component
- Customers + Suppliers Index → sudah di-merge ke `ContactsPage` component
- InstallmentPlanMapper → sudah ada di `app/Helpers/InstallmentPlanMapper.php`, dipakai di CustomerController + InstallmentController
- Stock In + Out → sudah di-merge ke `StockMovementPage` component

## ✅ Sudah Selesai (dari backlog lama)

- **Docker: `start.sh` tidak pernah dipanggil** — CMD langsung ke supervisord, migrasi tidak pernah jalan; fix: wire `start.sh` ke CMD (2026-03-28)
- **Docker: `bootstrap/cache` tidak ada saat build** — `composer install` gagal karena direktori missing; fix: `mkdir -p bootstrap/cache` di Dockerfile sebelum composer (2026-03-28)
- **Docker: volume mount menghapus `storage/framework/*`** — `view:cache` crash "View path not found"; fix: `mkdir -p` semua storage subdirs di `start.sh` runtime (2026-03-28)
- **Docker: brace expansion `{}` tidak bekerja di Alpine sh** — direktori tidak terbuat; fix: explicit mkdir per path (2026-03-28)
- **Docker: PHP extension `calendar` tidak terinstall** — `cal_days_in_month()` undefined di seeder; fix: tambah `calendar` ke `docker-php-ext-install` (2026-03-28)
- **Coolify: 419 CSRF error saat login** — `TRUSTED_PROXIES` tidak di-set; fix: `TRUSTED_PROXIES=*` + `SESSION_SECURE_COOKIE=false` di Coolify env vars (2026-03-28)

- **RangeError: Invalid time value** saat edit promo — `PromotionController` kirim ISO 8601 string karena Eloquent `'date'` cast; fix: `->format('Y-m-d')` eksplisit di response (2026-03-27)
- **Beban date filter no data** — `whereDate()` tidak reliable di MariaDB; fix: `>= $date . ' 00:00:00'` / `<= $date . ' 23:59:59'` pattern (2026-03-27)
- **Beban warehouse filter no data** — `dhid()` return `0` pada input invalid → `WHERE warehouse_id = 0`; fix: guard `$wId > 0` sebelum apply filter (2026-03-27)
- **Beban category filter no effect** — `->when()` closure edge case; fix: explicit `if ($category !== '') { $query->where(...) }` (2026-03-27)

- Void transaksi kredit orphan installment — sudah di-block di `PosController::void()` L661-668
- `$allDone` OR logic — sudah pakai `whereNotIn('status',['paid'])` di `InstallmentController::pay()` L650
- Credit schedule total validation — sudah ada di `PosController::store()` L449-452
- Overpayment guard — sudah ada validasi `max:{$remainingDue}` + `$totalObligation` check di `InstallmentController::pay()` L579-597
- Hashid implementation — selesai 2026-03-25, semua controller + frontend sudah diupdate
- PO number consistency — `createFromSuggestions()` sudah pakai `PO-YYYYMMDD-XXXX` sequential format
- QR code URL encoding — semua halaman sudah pakai `encodeURIComponent()`
- `dangerouslySetInnerHTML` pagination — diperbaiki di `CreditHistory.tsx` dan `KreditPelanggan.tsx`, decode HTML entities
- Memory leak `URL.createObjectURL` — `Add_Items.tsx` sudah ada `useEffect` cleanup; `Stock_Adjustment.tsx` + `Stock_Transfer.tsx` ditambah `revokeObjectURL` setelah `a.click()`
