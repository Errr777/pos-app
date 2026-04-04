---
date: 2026-04-04
status: approved
supersedes: 2026-03-20-invoice-design.md
---

# Invoice + PDF Download Feature Design

## Goal

Add a formal A4 invoice to the POS app with two delivery modes:
1. **HTML popup** — printable in browser (existing design, now implemented)
2. **PDF download** — on-demand streaming via DomPDF, zero disk storage (Plan B, new addition)

Accessible from sale detail pages, customer installment plan rows, and purchase order detail pages. Each invoice has a persistent `INV-YYYYMMDD-XXXX` number stored in the database and auto-generated on first access.

## Scope

Three entry points × two modes = 6 controller methods:

| Entry Point | HTML Route | PDF Route |
|---|---|---|
| Sale (POS) | `pos/{saleHeader}/invoice` | `pos/{saleHeader}/invoice/pdf` |
| Installment plan | `pos/installments/{plan}/invoice` | `pos/installments/{plan}/invoice/pdf` |
| Purchase order | `purchase-orders/{po}/invoice` | `purchase-orders/{po}/invoice/pdf` |

---

## Data Layer

### Migrations

Add two columns to each of three existing tables:

| Table | Columns |
|---|---|
| `sale_headers` | `invoice_number VARCHAR(30) NULL UNIQUE`, `invoice_issued_at TIMESTAMP NULL` |
| `installment_plans` | `invoice_number VARCHAR(30) NULL UNIQUE`, `invoice_issued_at TIMESTAMP NULL` |
| `purchase_orders` | `invoice_number VARCHAR(30) NULL UNIQUE`, `invoice_issued_at TIMESTAMP NULL` |

One additional migration creates the `invoice_sequences` table.

### Invoice Number Format

`INV-YYYYMMDD-XXXX` where `XXXX` is a zero-padded 4-digit sequence, globally unique across all three tables for a given date.

### Helper: `App\Helpers\InvoiceNumber::generate()`

Generates the next available invoice number atomically:

1. Wraps in `DB::transaction()`
2. Uses `->lockForUpdate()` on the `invoice_sequences` row for today (no-op on SQLite dev, effective on MariaDB production)
3. Upserts via `updateOrInsert(['date' => today], ['sequence' => DB::raw('sequence + 1')])` then re-reads
4. Returns `INV-YYYYMMDD-XXXX`

The `UNIQUE` constraint on `invoice_number` remains as a hard safety net.

**`invoice_sequences` table:**
```
id, date DATE UNIQUE, sequence UNSIGNED INT DEFAULT 0, timestamps
```

---

## Dependencies

```bash
composer require barryvdh/laravel-dompdf
```

No config publish needed — defaults are sufficient. DomPDF streams PDFs directly without writing to disk.

---

## Backend

### Routes

All routes sit within the existing `auth` + `verified` middleware group in `routes/web.php`.

```php
// POS invoice — placed alongside existing pos/{saleHeader}/print and void routes
GET  pos/{saleHeader}/invoice          → PosController::invoice()       → pos.invoice
GET  pos/{saleHeader}/invoice/pdf      → PosController::invoicePdf()    → pos.invoice.pdf

// Installments — MUST be above pos/{saleHeader} wildcard to avoid capture
GET  pos/installments/{plan}/invoice     → InstallmentController::invoice()      → installments.invoice
GET  pos/installments/{plan}/invoice/pdf → InstallmentController::invoicePdf()   → installments.invoice.pdf

// Purchase orders
GET  purchase-orders/{po}/invoice        → PurchaseOrderController::invoice()    → po.invoice
GET  purchase-orders/{po}/invoice/pdf    → PurchaseOrderController::invoicePdf() → po.invoice.pdf
```

**Route ordering note:** `pos/installments/{plan}/invoice` must be registered before `pos/{saleHeader}` (the wildcard) to prevent swallowing.

### Permission Checks

| Controller method | Module | Action |
|---|---|---|
| `PosController::invoice()` + `invoicePdf()` | `pos` | `can_view` |
| `InstallmentController::invoice()` + `invoicePdf()` | `pos` | `can_view` |
| `PurchaseOrderController::invoice()` + `invoicePdf()` | `purchase_orders` | `can_view` |

### HTML Methods (`invoice()`)

Each `invoice()` method:
1. Permission check
2. If `invoice_number` is null: call `InvoiceNumber::generate()` inside a DB transaction, save with `invoice_issued_at = now()`
3. Load related data
4. Return `Inertia::render(...)` — do NOT pass `storeSettings` (already shared globally via `HandleInertiaRequests.php`)

### PDF Methods (`invoicePdf()`)

Each `invoicePdf()` method:
1. Same permission check
2. Same `InvoiceNumber::generate()` logic (idempotent — reuses existing number if already set)
3. Load identical related data
4. Build a `$data` array with the same shape as the Inertia props
5. Append `storeSettings` to `$data` (not globally shared in Blade context)
6. Generate PDF via DomPDF:

```php
$pdf = Pdf::loadView('invoices.sale', $data);
$filename = $record->invoice_number . '.pdf';
return response()->streamDownload(
    fn () => print($pdf->output()),
    $filename,
    ['Content-Type' => 'application/pdf']
);
```

No files are written to disk. The PDF streams directly to the browser.

### Inertia Props Shape

**`PosController::invoice()` → `pos/Invoice`**

Load: `$saleHeader->load(['warehouse', 'customer', 'cashier', 'saleItems'])`

For credit sales, load installment plan separately:
```php
$plan = \App\Models\InstallmentPlan::where('sale_header_id', $saleHeader->id)
    ->with('payments')
    ->first();
```

```php
'invoice' => [
    'invoiceNumber'  => $saleHeader->invoice_number,
    'issuedAt'       => $saleHeader->invoice_issued_at->toISOString(),
    'saleNumber'     => $saleHeader->sale_number,
    'date'           => $saleHeader->occurred_at?->toISOString(),
    'cashier'        => $saleHeader->cashier?->name ?? '-',
    'status'         => $saleHeader->status,
    'paymentMethod'  => $saleHeader->payment_method,
    'paymentAmount'  => $saleHeader->payment_amount,
    'changeAmount'   => $saleHeader->change_amount,
    'note'           => $saleHeader->note,
    'customer'       => ['name' => $saleHeader->customer?->name ?? 'Walk-in', 'phone' => $saleHeader->customer?->phone, 'address' => $saleHeader->customer?->address],
    'warehouse'      => ['name' => $saleHeader->warehouse?->name, 'address' => $saleHeader->warehouse?->location, 'phone' => $saleHeader->warehouse?->phone],
    'subtotal'       => $saleHeader->subtotal,
    'discountAmount' => $saleHeader->discount_amount,
    'taxAmount'      => $saleHeader->tax_amount,
    'grandTotal'     => $saleHeader->grand_total,
    'items'          => $saleHeader->saleItems->map(fn($si) => [
                           'name' => $si->item_name_snapshot, 'code' => $si->item_code_snapshot,
                           'unitPrice' => $si->unit_price, 'quantity' => $si->quantity,
                           'discountAmount' => $si->discount_amount, 'lineTotal' => $si->line_total,
                       ]),
    'schedule'       => $plan ? $plan->payments->map(fn($p) => [
                           'dueDate' => $p->due_date->toDateString(), 'amountDue' => $p->amount_due,
                           'interestAmount' => $p->interest_amount, 'lateFeeApplied' => $p->late_fee_applied,
                           'totalDue' => $p->totalDue(), 'status' => $p->status,
                       ]) : null,
]
```

**`InstallmentController::invoice()` → `pos/Invoice`**

Load: `$plan->load(['payments', 'saleHeader.saleItems', 'customer', 'saleHeader.warehouse'])`

Same prop shape. `paymentMethod` = `'credit'`, `cashier` = null, `schedule` is always present.

**`PurchaseOrderController::invoice()` → `purchase-orders/Invoice`**

Load: `$po->load(['supplier', 'warehouse', 'orderedBy', 'items'])`

```php
'invoice' => [
    'invoiceNumber' => $po->invoice_number,
    'issuedAt'      => $po->invoice_issued_at->toISOString(),
    'poNumber'      => $po->po_number,
    'date'          => $po->ordered_at->toISOString(),
    'expectedDate'  => $po->expected_at?->toDateString(),
    'status'        => $po->status,
    'supplier'      => ['name' => $po->supplier?->name, 'phone' => $po->supplier?->phone, 'address' => $po->supplier?->address],
    'warehouse'     => ['name' => $po->warehouse?->name, 'address' => $po->warehouse?->location, 'phone' => $po->warehouse?->phone],
    'subtotal'      => $po->subtotal,
    'taxAmount'     => $po->tax_amount,
    'grandTotal'    => $po->grand_total,
    'items'         => $po->items->map(fn($i) => [
                        'name' => $i->item_name_snapshot, 'code' => null,
                        'unitPrice' => $i->unit_price, 'quantity' => $i->ordered_qty, 'lineTotal' => $i->line_total,
                    ]),
]
```

Note: `PurchaseOrderItem` has no `item_code_snapshot` or `discount_amount` — set `code: null`, omit discount row.

---

## Frontend

### Inertia Pages (HTML Invoice)

**`resources/js/pages/pos/Invoice.tsx`**
- No `AppLayout` — bare page, full white background
- `@page { size: A4; margin: 15mm; }` in inline `<style>`
- Auto-triggers `window.print()` after 400ms (same pattern as `pos/Print.tsx`)
- Reads `storeSettings` from `usePage().props.storeSettings` (globally shared)
- Handles both regular and credit sales; renders installment schedule when `invoice.schedule !== null`

**`resources/js/pages/purchase-orders/Invoice.tsx`**
- Same bare page structure
- Supplier direction (FROM: store, TO: supplier)
- No discount row in totals (PO items have no discount)
- Shows `expectedDate` in header

### Invoice Layout (both Inertia pages and Blade templates)

```
Header row
  Left:  Store logo + name + address + phone
  Right: Invoice number (INV-...), Tanggal terbit, Jatuh tempo / Tgl pengiriman

KEPADA section
  Customer or supplier name, phone, address

Items table
  Columns: No | Produk | Harga Satuan | Qty | Diskon | Total
  Each row: item name (bold) + item code (muted, smaller) — code omitted for PO

Totals block (right-aligned)
  Subtotal | Diskon (if > 0) | Pajak (if > 0) | Total (bold) | Bayar

Installment schedule table (credit sales only — when schedule !== null)
  Columns: No | Jatuh Tempo | Jumlah | Bunga | Status

Signature row
  Left: Hormat kami / [store name] / ______
  Right: Penerima / ______

Footer
  receipt_footer from storeSettings (centered, muted, white-space: pre-wrap)
```

### Blade Templates (PDF via DomPDF)

Located in `resources/views/invoices/`:

| File | Used by |
|---|---|
| `resources/views/invoices/sale.blade.php` | `PosController::invoicePdf()` and `InstallmentController::invoicePdf()` |
| `resources/views/invoices/purchase-order.blade.php` | `PurchaseOrderController::invoicePdf()` |

Both templates replicate the same layout as the Inertia pages above. Key DomPDF constraints:
- Use inline CSS only (no Tailwind, no external stylesheets)
- Monetary values are integers — format with `number_format($value / 100, 0, ',', '.')` in Blade (or a `@php` block helper)
- No external images — embed store logo as base64 data URI if present, or skip

### Buttons Added to Existing Pages

| Page | Button 1 | Button 2 |
|---|---|---|
| `pos/Show.tsx` | "Cetak Invoice" → opens HTML popup | "Download PDF" → `window.location.href = route(...)` |
| `customers/Show.tsx` (per plan row) | "Invoice" → opens HTML popup | "PDF" → download link |
| `purchase-orders/Show.tsx` | "Cetak Invoice" → opens HTML popup | "Download PDF" → download link |

HTML popup pattern (existing):
```ts
window.open(route('pos.invoice', { saleHeader: id }), 'invoice',
  'width=900,height=700,toolbar=no,location=no,menubar=no,scrollbars=yes,resizable=yes')
```

PDF download pattern (new — triggers browser download):
```ts
window.location.href = route('pos.invoice.pdf', { saleHeader: id })
```

---

## Out of Scope

- Invoice list / management page
- Email delivery
- Invoice editing or voiding (number is permanent once issued)
- Storing PDFs on disk or in object storage
- Multi-language support
