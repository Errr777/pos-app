# Invoice Feature Design

## Goal

Add a formal A4 invoice to the POS app, accessible from sale detail pages, customer installment plan rows, and purchase order detail pages. Each invoice has a persistent `INV-YYYYMMDD-XXXX` number stored in the database and auto-generated on first print.

## Scope

Three entry points, each producing a printable invoice in a popup window with no app chrome:

1. **Sale invoice** — from `pos/Show.tsx`, covers both regular and credit sales
2. **Installment plan invoice** — from `customers/Show.tsx`, per plan row
3. **Purchase order invoice** — from `purchase-orders/Show.tsx`

---

## Data Layer

### Migrations

Add two columns to each of three existing tables:

| Table | Columns |
|---|---|
| `sale_headers` | `invoice_number VARCHAR(30) NULL UNIQUE`, `invoice_issued_at TIMESTAMP NULL` |
| `installment_plans` | `invoice_number VARCHAR(30) NULL UNIQUE`, `invoice_issued_at TIMESTAMP NULL` |
| `purchase_orders` | `invoice_number VARCHAR(30) NULL UNIQUE`, `invoice_issued_at TIMESTAMP NULL` |

No new table. `invoice_number` is nullable until first print. Unique constraint prevents duplicates.

### Invoice Number Format

`INV-YYYYMMDD-XXXX` where `XXXX` is a zero-padded 4-digit sequence, globally unique across all three tables for a given date.

### Helper: `App\Helpers\InvoiceNumber::generate()`

Queries the max sequence number used today across all three tables, increments by 1. Returns the next available number. Called only when `invoice_number IS NULL` on the record — subsequent prints reuse the stored number.

---

## Backend

### Routes

```
GET pos/{saleHeader}/invoice                   → PosController::invoice()              → pos.invoice
GET pos/installments/{plan}/invoice            → InstallmentController::invoice()      → installments.invoice
GET purchase-orders/{purchaseOrder}/invoice    → PurchaseOrderController::invoice()    → purchase-orders.invoice
```

All three routes sit within the existing `auth` + `verified` middleware group.

### Controller Methods

Each method follows the same pattern:

1. Check `invoice_number` on the record — if null, call `InvoiceNumber::generate()` and save with `invoice_issued_at = now()` inside a DB transaction
2. Load related data (items, customer/supplier, warehouse, installment payments if credit)
3. Return `Inertia::render('pos/Invoice', [...])` or `Inertia::render('purchase-orders/Invoice', [...])`

Permission checks reuse existing patterns (`can_view` on `pos` / `purchase_orders` module).

---

## Frontend

### Pages

**`resources/js/pages/pos/Invoice.tsx`**
- No `AppLayout` — bare page, full white background
- A4 paper via `@page { size: A4; margin: 15mm; }`
- Auto-triggers `window.print()` after 400ms (same pattern as `pos/Print.tsx`)
- Handles both regular sales and credit sales
- Credit sales: renders an additional installment schedule table

**`resources/js/pages/purchase-orders/Invoice.tsx`**
- Same bare page structure
- Supplier direction (FROM: store, TO: supplier)
- Shows ordered items, expected delivery date, PO status

### Invoice Layout (both pages)

```
Header row
  Left:  Store logo + name + address + phone
  Right: Invoice number (INV-...), Issue date, Due date / Delivery date

KEPADA section
  Customer or supplier name, phone, address

Items table
  Columns: No | Produk | Harga Satuan | Qty | Diskon | Total
  Each row: item name (bold) + item code (muted below)

Totals block (right-aligned)
  Subtotal | Diskon | Pajak (if > 0) | Total (bold, primary color) | Bayar

Installment schedule table (credit sales only)
  Columns: No | Jatuh Tempo | Jumlah | Bunga | Denda | Status

Signature row
  Left: Hormat kami + store name + blank line
  Right: Pelanggan / Penerima + blank line

Footer
  receipt_footer text (centered, muted), preserves line breaks
```

### Buttons Added

| Page | Button label | Opens |
|---|---|---|
| `pos/Show.tsx` | Cetak Invoice | `route('pos.invoice', {saleHeader: id})` |
| `customers/Show.tsx` | Invoice (per plan row) | `route('installments.invoice', {plan: id})` |
| `purchase-orders/Show.tsx` | Cetak Invoice | `route('purchase-orders.invoice', {purchaseOrder: id})` |

All buttons use `window.open(url, 'invoice', 'width=900,height=700,toolbar=no,location=no,menubar=no,scrollbars=yes,resizable=yes')`.

---

## Out of Scope

- Invoice list / management page (no dedicated `/invoices` index)
- Email / PDF export
- Invoice editing or voiding (invoice number is permanent once issued)
- Multi-language support
