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

One additional migration creates the `invoice_sequences` table (see helper below).

### Invoice Number Format

`INV-YYYYMMDD-XXXX` where `XXXX` is a zero-padded 4-digit sequence, globally unique across all three tables for a given date.

### Helper: `App\Helpers\InvoiceNumber::generate()`

Generates the next available invoice number atomically:

1. Wraps in `DB::transaction()`
2. Uses `->lockForUpdate()` on the `invoice_sequences` row for today (no-op on SQLite dev, effective on MariaDB production)
3. Upserts the row via `updateOrInsert(['date' => today], ['sequence' => DB::raw('sequence + 1')])`  then re-reads the sequence
4. Returns `INV-YYYYMMDD-XXXX`

The `UNIQUE` constraint on `invoice_number` remains as a hard safety net in both environments.

**`invoice_sequences` table:**
```
id, date DATE UNIQUE, sequence UNSIGNED INT DEFAULT 0, timestamps
```

---

## Backend

### Routes

All routes sit within the existing `auth` + `verified` middleware group in `routes/web.php`.

```
GET  pos/{saleHeader}/invoice                → PosController::invoice()              → pos.invoice
GET  pos/installments/{plan}/invoice         → InstallmentController::invoice()      → installments.invoice
GET  purchase-orders/{purchaseOrder}/invoice → PurchaseOrderController::invoice()    → po.invoice
```

**Route ordering:**
- `pos/installments/{plan}/invoice` must be registered within the existing `pos/installments/...` block, **above** `pos/{saleHeader}` (the wildcard route), to prevent the wildcard from swallowing it.
- `pos/{saleHeader}/invoice` should be placed alongside the existing `pos/{saleHeader}/print` and `pos/{saleHeader}/void` routes.

### Permission Checks

| Controller method | Module | Action |
|---|---|---|
| `PosController::invoice()` | `pos` | `can_view` |
| `InstallmentController::invoice()` | `pos` | `can_view` (consistent with existing `InstallmentController` middleware) |
| `PurchaseOrderController::invoice()` | `purchase_orders` | `can_view` |

### Controller Methods

Each method:

1. Permission check (see table above)
2. If `invoice_number` is null on the record: call `InvoiceNumber::generate()` inside a DB transaction and save with `invoice_issued_at = now()`
3. Load related data
4. Return `Inertia::render(...)` — **do not pass `storeSettings`** (already shared globally via `HandleInertiaRequests.php`; access on frontend via `usePage().props.storeSettings`)

### Inertia Props

**`PosController::invoice()` → `pos/Invoice`**

Load: `$saleHeader->load(['warehouse', 'customer', 'cashier', 'saleItems'])`.

For credit sales, load the installment plan separately (no relation exists on `SaleHeader`):
```php
$plan = \App\Models\InstallmentPlan::where('sale_header_id', $saleHeader->id)
    ->with('payments')
    ->first();
```

```php
[
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
    'customer'       => [
                          'name'    => $saleHeader->customer?->name ?? 'Walk-in',
                          'phone'   => $saleHeader->customer?->phone,
                          'address' => $saleHeader->customer?->address,
                        ],
    'warehouse'      => [
                          'name'    => $saleHeader->warehouse?->name,
                          'address' => $saleHeader->warehouse?->location,
                          'phone'   => $saleHeader->warehouse?->phone,
                        ],
    'subtotal'       => $saleHeader->subtotal,
    'discountAmount' => $saleHeader->discount_amount,
    'taxAmount'      => $saleHeader->tax_amount,
    'grandTotal'     => $saleHeader->grand_total,
    'items'          => $saleHeader->saleItems->map(fn($si) => [
                          'name'           => $si->item_name_snapshot,
                          'code'           => $si->item_code_snapshot,
                          'unitPrice'      => $si->unit_price,
                          'quantity'       => $si->quantity,
                          'discountAmount' => $si->discount_amount,
                          'lineTotal'      => $si->line_total,
                        ]),
    'schedule'       => $plan ? $plan->payments->map(fn($p) => [
                          'dueDate'        => $p->due_date->toDateString(),
                          'amountDue'      => $p->amount_due,
                          'interestAmount' => $p->interest_amount,
                          'lateFeeApplied' => $p->late_fee_applied,
                          'totalDue'       => $p->totalDue(),
                          'status'         => $p->status,
                        ]) : null,
  ],
]
```

**`InstallmentController::invoice()` → `pos/Invoice`**

Load: `$plan->load(['payments', 'saleHeader.saleItems', 'customer', 'saleHeader.warehouse'])`.

Same prop shape as `PosController::invoice()`:
```php
[
  'invoice' => [
    'invoiceNumber'  => $plan->invoice_number,
    'issuedAt'       => $plan->invoice_issued_at->toISOString(),
    'saleNumber'     => $plan->saleHeader->sale_number,
    'date'           => $plan->created_at->toISOString(),
    'cashier'        => null,
    'status'         => $plan->status,
    'paymentMethod'  => 'credit',
    'paymentAmount'  => $plan->paid_amount,
    'changeAmount'   => 0,
    'note'           => $plan->note,
    'customer'       => [
                          'name'    => $plan->customer->name,
                          'phone'   => $plan->customer->phone,
                          'address' => $plan->customer->address,
                        ],
    'warehouse'      => [
                          'name'    => $plan->saleHeader->warehouse?->name,
                          'address' => $plan->saleHeader->warehouse?->location,
                          'phone'   => $plan->saleHeader->warehouse?->phone,
                        ],
    'subtotal'       => $plan->total_amount,
    'discountAmount' => 0,
    'taxAmount'      => 0,
    'grandTotal'     => $plan->total_amount,
    'items'          => $plan->saleHeader->saleItems->map(fn($si) => [
                          'name'           => $si->item_name_snapshot,
                          'code'           => $si->item_code_snapshot,
                          'unitPrice'      => $si->unit_price,
                          'quantity'       => $si->quantity,
                          'discountAmount' => $si->discount_amount,
                          'lineTotal'      => $si->line_total,
                        ]),
    'schedule'       => $plan->payments->map(fn($p) => [
                          'dueDate'        => $p->due_date->toDateString(),
                          'amountDue'      => $p->amount_due,
                          'interestAmount' => $p->interest_amount,
                          'lateFeeApplied' => $p->late_fee_applied,
                          'totalDue'       => $p->totalDue(),
                          'status'         => $p->status,
                        ]),
  ],
]
```

**`PurchaseOrderController::invoice()` → `purchase-orders/Invoice`**

Load: `$po->load(['supplier', 'warehouse', 'orderedBy', 'items'])`.

**Real field names from `PurchaseOrder` model:**
- Date: `ordered_at` (datetime), `expected_at` (date) — no `discount_amount` column
- **`PurchaseOrderItem`** has: `item_name_snapshot`, `ordered_qty`, `unit_price`, `line_total` — no `item_code_snapshot`, no `discount_amount`

```php
[
  'invoice' => [
    'invoiceNumber' => $po->invoice_number,
    'issuedAt'      => $po->invoice_issued_at->toISOString(),
    'poNumber'      => $po->po_number,
    'date'          => $po->ordered_at->toISOString(),
    'expectedDate'  => $po->expected_at?->toDateString(),
    'status'        => $po->status,
    'supplier'      => [
                         'name'    => $po->supplier?->name,
                         'phone'   => $po->supplier?->phone,
                         'address' => $po->supplier?->address,
                       ],
    'warehouse'     => [
                         'name'    => $po->warehouse?->name,
                         'address' => $po->warehouse?->location,
                         'phone'   => $po->warehouse?->phone,
                       ],
    'subtotal'      => $po->subtotal,
    'taxAmount'     => $po->tax_amount,
    'grandTotal'    => $po->grand_total,
    'items'         => $po->items->map(fn($i) => [
                         'name'      => $i->item_name_snapshot,
                         'code'      => null, // PurchaseOrderItem has no code snapshot
                         'unitPrice' => $i->unit_price,
                         'quantity'  => $i->ordered_qty,   // column is ordered_qty
                         'lineTotal' => $i->line_total,
                       ]),
  ],
]
```

---

## Frontend

### Pages

**`resources/js/pages/pos/Invoice.tsx`**
- No `AppLayout` — bare page, full white background
- `@page { size: A4; margin: 15mm; }` in inline `<style>`
- Auto-triggers `window.print()` after 400ms (same pattern as `pos/Print.tsx`)
- Reads `storeSettings` from `usePage().props.storeSettings` (globally shared)
- Handles both regular and credit sales
- Renders installment schedule table when `invoice.schedule !== null`

**`resources/js/pages/purchase-orders/Invoice.tsx`**
- Same bare page structure
- Supplier direction (FROM: store, TO: supplier)
- No `discountAmount` column on PO — omit that row from totals
- Shows `expectedDate` as due date in header

### Invoice Layout (both pages)

```
Header row
  Left:  Store logo + name + address + phone
  Right: Invoice number (INV-...), Tanggal terbit, Jatuh tempo / Tgl pengiriman

KEPADA section
  Customer or supplier name, phone, address

Items table
  Columns: No | Produk | Harga Satuan | Qty | Diskon | Total
  Each row: item name (bold) + item code (muted, smaller — null for PO items)

Totals block (right-aligned)
  Subtotal | Diskon (if > 0) | Pajak (if > 0) | Total (bold, primary color) | Bayar

Installment schedule table (credit only — when invoice.schedule !== null)
  Columns: No | Jatuh Tempo | Jumlah | Bunga | Status

Signature row
  Left: Hormat kami / [store name] / ______
  Right: Penerima / ______

Footer
  receipt_footer from storeSettings (centered, muted, white-space: pre-wrap)
```

### Buttons Added

| Page | Button label | Route |
|---|---|---|
| `pos/Show.tsx` | Cetak Invoice | `pos.invoice` |
| `customers/Show.tsx` | Invoice (per plan row) | `installments.invoice` |
| `purchase-orders/Show.tsx` | Cetak Invoice | `po.invoice` |

All buttons use:
```ts
window.open(route('...', { id }), 'invoice',
  'width=900,height=700,toolbar=no,location=no,menubar=no,scrollbars=yes,resizable=yes')
```

---

## Out of Scope

- Invoice list / management page
- Email / PDF export
- Invoice editing or voiding (number is permanent once issued)
- Multi-language support
