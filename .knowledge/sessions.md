# Session Log

Catatan ringkasan per sesi kerja. Terbaru di atas.

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
