# Session Log

Catatan ringkasan per sesi kerja. Terbaru di atas.

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
