# Bugs & Todos Aktif

Update file ini setiap sesi. Hapus item yang sudah selesai.

---

## 🐛 Bug Aktif
*(tidak ada saat ini)*

---

## ✅ Todo / Plan Aktif
*(tidak ada saat ini)*

---

## 📋 Backlog (diketahui tapi belum dikerjakan)

*(tidak ada saat ini)*

## ✅ Sudah Selesai (dari backlog lama)

- Void transaksi kredit orphan installment — sudah di-block di `PosController::void()` L661-668
- `$allDone` OR logic — sudah pakai `whereNotIn('status',['paid'])` di `InstallmentController::pay()` L650
- Credit schedule total validation — sudah ada di `PosController::store()` L449-452
- Overpayment guard — sudah ada validasi `max:{$remainingDue}` + `$totalObligation` check di `InstallmentController::pay()` L579-597
- Hashid implementation — selesai 2026-03-25, semua controller + frontend sudah diupdate
- PO number consistency — `createFromSuggestions()` sudah pakai `PO-YYYYMMDD-XXXX` sequential format
- QR code URL encoding — semua halaman sudah pakai `encodeURIComponent()`
- `dangerouslySetInnerHTML` pagination — diperbaiki di `CreditHistory.tsx` dan `KreditPelanggan.tsx`, decode HTML entities
- Memory leak `URL.createObjectURL` — `Add_Items.tsx` sudah ada `useEffect` cleanup; `Stock_Adjustment.tsx` + `Stock_Transfer.tsx` ditambah `revokeObjectURL` setelah `a.click()`
