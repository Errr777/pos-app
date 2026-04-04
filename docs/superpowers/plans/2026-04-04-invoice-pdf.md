# Invoice PDF Download Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add "Download PDF" buttons next to existing "Invoice" buttons on POS sale, installment, and purchase order pages — streaming A4 PDF via DomPDF with no disk storage.

**Architecture:** Three new `invoicePdf()` controller methods mirror the existing `invoice()` methods but return `response()->streamDownload()` instead of `Inertia::render()`. Two Blade templates (`invoices/sale.blade.php` and `invoices/purchase-order.blade.php`) replicate the HTML invoice layout using inline CSS only (no Tailwind). Three new GET routes registered immediately after their HTML counterparts.

**Tech Stack:** `barryvdh/laravel-dompdf` ^2.x, Laravel 12 Blade, existing `App\Models\AppSetting::allAsArray()`, existing `App\Helpers\InvoiceNumber::generate()`

---

## File Structure

| Action | File | Responsibility |
|---|---|---|
| Install | `composer.json` / `vendor/` | DomPDF library |
| Add | `resources/views/invoices/sale.blade.php` | PDF template for POS sale + installment plan |
| Add | `resources/views/invoices/purchase-order.blade.php` | PDF template for purchase orders |
| Modify | `app/Http/Controllers/PosController.php` | Add `invoicePdf()` after `invoice()` |
| Modify | `app/Http/Controllers/InstallmentController.php` | Add `invoicePdf()` after `invoice()` |
| Modify | `app/Http/Controllers/PurchaseOrderController.php` | Add `invoicePdf()` after `invoice()` |
| Modify | `routes/web.php` | 3 new PDF routes |
| Modify | `resources/js/pages/pos/Show.tsx` | Add "Download PDF" button |
| Modify | `resources/js/pages/pos/CreditHistory.tsx` | Add "PDF" button next to "Invoice" |
| Modify | `resources/js/pages/purchase-orders/Show.tsx` | Add "Download PDF" button |

---

### Task 1: Install DomPDF

**Files:**
- Modify: `composer.json` (via composer command)

- [ ] **Step 1: Install the package**

```bash
cd /Users/errr/Developer/Project/my/pos/pos-app
composer require barryvdh/laravel-dompdf
```

Expected output: `barryvdh/laravel-dompdf` added to `composer.json`, no errors.

- [ ] **Step 2: Verify the facade is available**

```bash
php artisan tinker --execute="echo class_exists(\Barryvdh\DomPDF\Facade\Pdf::class) ? 'ok' : 'not found';"
```

Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add composer.json composer.lock
git commit -m "feat: install barryvdh/laravel-dompdf for PDF invoice generation"
```

---

### Task 2: Create Sale Invoice Blade Template

**Files:**
- Create: `resources/views/invoices/sale.blade.php`

This template is used for both POS sale PDFs and installment plan PDFs. The `$invoice` variable has the same shape as the Inertia props in `PosController::invoice()`. The `$storeSettings` variable is the result of `AppSetting::allAsArray()` (a flat key→value array).

Monetary values are stored as integers and formatted as Indonesian Rupiah without any division (same as the React `formatRp` which just does `toLocaleString('id-ID')`).

- [ ] **Step 1: Create the Blade file**

Create `resources/views/invoices/sale.blade.php` with this content:

```blade
<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<title>Invoice {{ $invoice['invoiceNumber'] }}</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: DejaVu Sans, Arial, sans-serif; font-size: 12px; color: #111; background: #fff; }
.root { padding: 15mm; }
.header { display: table; width: 100%; margin-bottom: 14px; }
.from { display: table-cell; vertical-align: top; }
.meta-right { display: table-cell; vertical-align: top; text-align: right; }
.logo { height: 36px; margin-bottom: 5px; }
.store-name { font-size: 15px; font-weight: bold; margin-bottom: 2px; }
.small { font-size: 10px; }
.muted { color: #666; }
.invoice-number { font-size: 17px; font-weight: bold; margin-bottom: 5px; color: #1d4ed8; }
.meta-row { font-size: 11px; margin-bottom: 2px; }
.void-badge { display: inline-block; margin-top: 5px; padding: 1px 8px; border-radius: 9999px; font-size: 10px; font-weight: bold; background: #fee2e2; color: #b91c1c; }
hr { border: none; border-top: 2px solid #111; margin: 10px 0; }
.to-section { margin-bottom: 14px; }
.label { font-size: 9px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; color: #888; margin-bottom: 3px; }
.to-name { font-size: 13px; font-weight: bold; }
table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
th { font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.3px; padding: 5px 6px; border-bottom: 1px solid #ddd; border-top: 1px solid #ddd; background: #f9f9f9; }
.th-left { text-align: left; }
.th-right { text-align: right; }
.th-center { text-align: center; }
td { padding: 7px 6px; font-size: 11px; vertical-align: top; border-bottom: 1px solid #f0f0f0; }
.td-right { text-align: right; }
.td-center { text-align: center; }
.item-name { font-weight: 500; }
.item-code { font-size: 10px; color: #666; }
.discount { color: #dc2626; }
.totals-wrap { text-align: right; margin-bottom: 14px; }
.totals { display: inline-block; width: 240px; }
.total-row { font-size: 11px; padding: 2px 0; display: table; width: 100%; }
.total-label { display: table-cell; text-align: left; color: #666; }
.total-value { display: table-cell; text-align: right; }
.grand-total-row { font-size: 14px; font-weight: bold; border-top: 2px solid #111; border-bottom: 1px solid #ddd; padding: 5px 0; color: #1d4ed8; }
.change { color: #16a34a; font-weight: 600; }
.section-title { font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; color: #888; margin-bottom: 5px; }
.note { border: 1px solid #e5e7eb; border-radius: 4px; padding: 7px 9px; font-size: 11px; margin-bottom: 14px; }
.signature { display: table; width: 100%; margin-top: 28px; margin-bottom: 14px; }
.sig-col { display: table-cell; width: 50%; text-align: center; }
.sig-line { border-bottom: 1px solid #999; margin: 36px 0 5px; }
.footer { text-align: center; font-size: 10px; color: #888; border-top: 1px dashed #ccc; padding-top: 9px; }
</style>
</head>
<body>
<div class="root">

{{-- Header --}}
<div class="header">
    <div class="from">
        @if(!empty($storeSettings['store_logo']))
            <img src="{{ storage_path('app/public/' . $storeSettings['store_logo']) }}" class="logo" alt="">
        @endif
        <div class="store-name">{{ $storeSettings['store_name'] ?? 'Toko' }}</div>
        @if(!empty($storeSettings['store_address']))<div class="small muted">{{ $storeSettings['store_address'] }}</div>@endif
        @if(!empty($storeSettings['store_phone']))<div class="small muted">{{ $storeSettings['store_phone'] }}</div>@endif
    </div>
    <div class="meta-right">
        <div class="invoice-number">{{ $invoice['invoiceNumber'] }}</div>
        <div class="meta-row"><span class="muted">Tanggal: </span>{{ $invoice['issuedAt'] ? \Carbon\Carbon::parse($invoice['issuedAt'])->translatedFormat('d F Y') : '-' }}</div>
        <div class="meta-row"><span class="muted">Transaksi: </span>{{ $invoice['saleNumber'] }}</div>
        @if(!empty($invoice['schedule']))
            @php $lastDue = collect($invoice['schedule'])->last()['dueDate'] ?? null; @endphp
            @if($lastDue)<div class="meta-row"><span class="muted">Jatuh Tempo: </span>{{ \Carbon\Carbon::parse($lastDue)->translatedFormat('d F Y') }}</div>@endif
        @endif
        @if($invoice['status'] === 'void')<div class="void-badge">VOID</div>@endif
    </div>
</div>

<hr>

{{-- To --}}
<div class="to-section">
    <div class="label">KEPADA:</div>
    <div class="to-name">{{ $invoice['customer']['name'] }}</div>
    @if(!empty($invoice['customer']['phone']))<div class="small">{{ $invoice['customer']['phone'] }}</div>@endif
    @if(!empty($invoice['customer']['address']))<div class="small">{{ $invoice['customer']['address'] }}</div>@endif
</div>

{{-- Items table --}}
<table>
    <thead>
        <tr>
            <th class="th-center" style="width:24px">No</th>
            <th class="th-left">Produk</th>
            <th class="th-right">Harga Satuan</th>
            <th class="th-center" style="width:36px">Qty</th>
            <th class="th-right">Diskon</th>
            <th class="th-right">Total</th>
        </tr>
    </thead>
    <tbody>
        @foreach($invoice['items'] as $i => $item)
        <tr>
            <td class="td-center">{{ $i + 1 }}</td>
            <td>
                <div class="item-name">{{ $item['name'] }}</div>
                @if(!empty($item['code']))<div class="item-code">{{ $item['code'] }}</div>@endif
            </td>
            <td class="td-right">Rp {{ number_format($item['unitPrice'], 0, ',', '.') }}</td>
            <td class="td-center">{{ $item['quantity'] }}</td>
            <td class="td-right">
                @if($item['discountAmount'] > 0)
                    <span class="discount">-Rp {{ number_format($item['discountAmount'], 0, ',', '.') }}</span>
                @else
                    -
                @endif
            </td>
            <td class="td-right" style="font-weight:600">Rp {{ number_format($item['lineTotal'], 0, ',', '.') }}</td>
        </tr>
        @endforeach
    </tbody>
</table>

{{-- Totals --}}
<div class="totals-wrap">
    <div class="totals">
        <div class="total-row">
            <span class="total-label muted">Subtotal</span>
            <span class="total-value">Rp {{ number_format($invoice['subtotal'], 0, ',', '.') }}</span>
        </div>
        @if($invoice['discountAmount'] > 0)
        <div class="total-row discount">
            <span class="total-label">Diskon</span>
            <span class="total-value">-Rp {{ number_format($invoice['discountAmount'], 0, ',', '.') }}</span>
        </div>
        @endif
        @if($invoice['taxAmount'] > 0)
        <div class="total-row">
            <span class="total-label muted">Pajak</span>
            <span class="total-value">Rp {{ number_format($invoice['taxAmount'], 0, ',', '.') }}</span>
        </div>
        @endif
        <div class="total-row grand-total-row">
            <span class="total-label">Total</span>
            <span class="total-value">Rp {{ number_format($invoice['grandTotal'], 0, ',', '.') }}</span>
        </div>
        @if($invoice['paymentMethod'] === 'multiple' && !empty($invoice['paymentSplits']))
            @foreach($invoice['paymentSplits'] as $sp)
            <div class="total-row muted">
                <span class="total-label">Bayar ({{ $sp['paymentMethod'] }})</span>
                <span class="total-value">Rp {{ number_format($sp['amount'], 0, ',', '.') }}</span>
            </div>
            @endforeach
        @else
        <div class="total-row muted">
            <span class="total-label">Bayar ({{ $invoice['paymentMethod'] }})</span>
            <span class="total-value">Rp {{ number_format($invoice['paymentAmount'], 0, ',', '.') }}</span>
        </div>
        @endif
        @if($invoice['changeAmount'] > 0)
        <div class="total-row change">
            <span class="total-label">Kembalian</span>
            <span class="total-value">Rp {{ number_format($invoice['changeAmount'], 0, ',', '.') }}</span>
        </div>
        @endif
    </div>
</div>

{{-- Installment schedule --}}
@if(!empty($invoice['schedule']))
<div class="section-title">Jadwal Cicilan</div>
<table>
    <thead>
        <tr>
            <th class="th-center" style="width:24px">No</th>
            <th class="th-left">Jatuh Tempo</th>
            <th class="th-right">Jumlah</th>
            <th class="th-right">Bunga</th>
            <th class="th-left">Status</th>
        </tr>
    </thead>
    <tbody>
        @foreach($invoice['schedule'] as $j => $row)
        <tr>
            <td class="td-center">{{ $j + 1 }}</td>
            <td>{{ $j === 0 ? 'Sekarang (DP)' : \Carbon\Carbon::parse($row['dueDate'])->translatedFormat('d F Y') }}</td>
            <td class="td-right">Rp {{ number_format($row['amountDue'], 0, ',', '.') }}</td>
            <td class="td-right">{{ $row['interestAmount'] > 0 ? 'Rp ' . number_format($row['interestAmount'], 0, ',', '.') : '-' }}</td>
            <td>{{ $row['status'] }}</td>
        </tr>
        @endforeach
    </tbody>
</table>
@endif

{{-- Note --}}
@if(!empty($invoice['note']))
<div class="note"><span class="muted">Catatan: </span>{{ $invoice['note'] }}</div>
@endif

{{-- Signature --}}
<div class="signature">
    <div class="sig-col">
        <div class="small muted">Hormat kami,</div>
        <div class="sig-line"></div>
        <div class="small">{{ $storeSettings['store_name'] ?? 'Toko' }}</div>
    </div>
    <div class="sig-col">
        <div class="small muted">Penerima,</div>
        <div class="sig-line"></div>
        <div class="small">{{ $invoice['customer']['name'] }}</div>
    </div>
</div>

{{-- Footer --}}
@if(!empty($storeSettings['receipt_footer']))
<div class="footer">{{ $storeSettings['receipt_footer'] }}</div>
@endif

</div>
</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add resources/views/invoices/sale.blade.php
git commit -m "feat: add Blade template for sale/installment PDF invoice"
```

---

### Task 3: Create Purchase Order Invoice Blade Template

**Files:**
- Create: `resources/views/invoices/purchase-order.blade.php`

The `$invoice` variable shape matches `PurchaseOrderController::invoice()` Inertia props. No `discountAmount`, no `paymentSplits`, no `schedule`. Items have `code: null`.

- [ ] **Step 1: Create the Blade file**

Create `resources/views/invoices/purchase-order.blade.php`:

```blade
<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<title>Invoice PO {{ $invoice['invoiceNumber'] }}</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: DejaVu Sans, Arial, sans-serif; font-size: 12px; color: #111; background: #fff; }
.root { padding: 15mm; }
.header { display: table; width: 100%; margin-bottom: 14px; }
.from { display: table-cell; vertical-align: top; }
.meta-right { display: table-cell; vertical-align: top; text-align: right; }
.logo { height: 36px; margin-bottom: 5px; }
.store-name { font-size: 15px; font-weight: bold; margin-bottom: 2px; }
.small { font-size: 10px; }
.muted { color: #666; }
.invoice-number { font-size: 17px; font-weight: bold; margin-bottom: 5px; color: #1d4ed8; }
.meta-row { font-size: 11px; margin-bottom: 2px; }
hr { border: none; border-top: 2px solid #111; margin: 10px 0; }
.to-section { margin-bottom: 12px; }
.label { font-size: 9px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; color: #888; margin-bottom: 3px; }
.to-name { font-size: 13px; font-weight: bold; }
table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
th { font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.3px; padding: 5px 6px; border-bottom: 1px solid #ddd; border-top: 1px solid #ddd; background: #f9f9f9; }
.th-left { text-align: left; }
.th-right { text-align: right; }
.th-center { text-align: center; }
td { padding: 7px 6px; font-size: 11px; vertical-align: top; border-bottom: 1px solid #f0f0f0; }
.td-right { text-align: right; }
.td-center { text-align: center; }
.item-name { font-weight: 500; }
.totals-wrap { text-align: right; margin-bottom: 14px; }
.totals { display: inline-block; width: 240px; }
.total-row { font-size: 11px; padding: 2px 0; display: table; width: 100%; }
.total-label { display: table-cell; text-align: left; color: #666; }
.total-value { display: table-cell; text-align: right; }
.grand-total-row { font-size: 14px; font-weight: bold; border-top: 2px solid #111; border-bottom: 1px solid #ddd; padding: 5px 0; color: #1d4ed8; }
.signature { display: table; width: 100%; margin-top: 28px; margin-bottom: 14px; }
.sig-col { display: table-cell; width: 50%; text-align: center; }
.sig-line { border-bottom: 1px solid #999; margin: 36px 0 5px; }
.footer { text-align: center; font-size: 10px; color: #888; border-top: 1px dashed #ccc; padding-top: 9px; }
</style>
</head>
<body>
<div class="root">

{{-- Header --}}
<div class="header">
    <div class="from">
        @if(!empty($storeSettings['store_logo']))
            <img src="{{ storage_path('app/public/' . $storeSettings['store_logo']) }}" class="logo" alt="">
        @endif
        <div class="store-name">{{ $storeSettings['store_name'] ?? 'Toko' }}</div>
        @if(!empty($storeSettings['store_address']))<div class="small muted">{{ $storeSettings['store_address'] }}</div>@endif
        @if(!empty($storeSettings['store_phone']))<div class="small muted">{{ $storeSettings['store_phone'] }}</div>@endif
    </div>
    <div class="meta-right">
        <div class="invoice-number">{{ $invoice['invoiceNumber'] }}</div>
        <div class="meta-row"><span class="muted">Tanggal: </span>{{ \Carbon\Carbon::parse($invoice['issuedAt'])->translatedFormat('d F Y') }}</div>
        <div class="meta-row"><span class="muted">No. PO: </span>{{ $invoice['poNumber'] }}</div>
        @if(!empty($invoice['expectedDate']))<div class="meta-row"><span class="muted">Tgl. Pengiriman: </span>{{ \Carbon\Carbon::parse($invoice['expectedDate'])->translatedFormat('d F Y') }}</div>@endif
        <div class="meta-row"><span class="muted">Status: </span>{{ $invoice['status'] }}</div>
    </div>
</div>

<hr>

{{-- Supplier --}}
<div class="to-section">
    <div class="label">KEPADA (SUPPLIER):</div>
    <div class="to-name">{{ $invoice['supplier']['name'] ?? '-' }}</div>
    @if(!empty($invoice['supplier']['phone']))<div class="small">{{ $invoice['supplier']['phone'] }}</div>@endif
    @if(!empty($invoice['supplier']['address']))<div class="small">{{ $invoice['supplier']['address'] }}</div>@endif
</div>

{{-- Warehouse --}}
<div class="to-section">
    <div class="label">KIRIM KE:</div>
    <div class="to-name">{{ $invoice['warehouse']['name'] ?? '-' }}</div>
    @if(!empty($invoice['warehouse']['address']))<div class="small">{{ $invoice['warehouse']['address'] }}</div>@endif
    @if(!empty($invoice['warehouse']['phone']))<div class="small">{{ $invoice['warehouse']['phone'] }}</div>@endif
</div>

{{-- Items table --}}
<table>
    <thead>
        <tr>
            <th class="th-center" style="width:24px">No</th>
            <th class="th-left">Produk</th>
            <th class="th-right">Harga Satuan</th>
            <th class="th-center" style="width:36px">Qty</th>
            <th class="th-right">Total</th>
        </tr>
    </thead>
    <tbody>
        @foreach($invoice['items'] as $i => $item)
        <tr>
            <td class="td-center">{{ $i + 1 }}</td>
            <td><div class="item-name">{{ $item['name'] }}</div></td>
            <td class="td-right">Rp {{ number_format($item['unitPrice'], 0, ',', '.') }}</td>
            <td class="td-center">{{ $item['quantity'] }}</td>
            <td class="td-right" style="font-weight:600">Rp {{ number_format($item['lineTotal'], 0, ',', '.') }}</td>
        </tr>
        @endforeach
    </tbody>
</table>

{{-- Totals --}}
<div class="totals-wrap">
    <div class="totals">
        <div class="total-row">
            <span class="total-label muted">Subtotal</span>
            <span class="total-value">Rp {{ number_format($invoice['subtotal'], 0, ',', '.') }}</span>
        </div>
        @if($invoice['taxAmount'] > 0)
        <div class="total-row">
            <span class="total-label muted">Pajak</span>
            <span class="total-value">Rp {{ number_format($invoice['taxAmount'], 0, ',', '.') }}</span>
        </div>
        @endif
        <div class="total-row grand-total-row">
            <span class="total-label">Total</span>
            <span class="total-value">Rp {{ number_format($invoice['grandTotal'], 0, ',', '.') }}</span>
        </div>
    </div>
</div>

{{-- Signature --}}
<div class="signature">
    <div class="sig-col">
        <div class="small muted">Dipesan oleh,</div>
        <div class="sig-line"></div>
        <div class="small">{{ $storeSettings['store_name'] ?? 'Toko' }}</div>
    </div>
    <div class="sig-col">
        <div class="small muted">Disetujui oleh,</div>
        <div class="sig-line"></div>
        <div class="small">{{ $invoice['supplier']['name'] ?? 'Supplier' }}</div>
    </div>
</div>

@if(!empty($storeSettings['receipt_footer']))
<div class="footer">{{ $storeSettings['receipt_footer'] }}</div>
@endif

</div>
</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add resources/views/invoices/purchase-order.blade.php
git commit -m "feat: add Blade template for purchase order PDF invoice"
```

---

### Task 4: Add PDF Routes

**Files:**
- Modify: `routes/web.php`

The three PDF routes go immediately after their HTML counterparts. All three are within the existing middleware groups (`auth` + `verified` + the module middleware).

- [ ] **Step 1: Add the three PDF routes**

In `routes/web.php`, make these three targeted edits:

**Edit 1** — After line `Route::get('pos/installments/{plan}/invoice', ...)` (line ~148), add:
```php
        Route::get('pos/installments/{plan}/invoice/pdf', [InstallmentController::class, 'invoicePdf'])->name('installments.invoice.pdf');
```

**Edit 2** — After line `Route::get('pos/{saleHeader}/invoice', ...)` (line ~159), add:
```php
        Route::get('pos/{saleHeader}/invoice/pdf', [PosController::class, 'invoicePdf'])->name('pos.invoice.pdf');
```

**Edit 3** — After line `Route::get('purchase-orders/{purchaseOrder}/invoice', ...)` (line ~204), add:
```php
        Route::get('purchase-orders/{purchaseOrder}/invoice/pdf', [PurchaseOrderController::class, 'invoicePdf'])->name('po.invoice.pdf');
```

- [ ] **Step 2: Verify routes exist**

```bash
php artisan route:list --name=invoice
```

Expected output includes:
```
pos.invoice         GET  pos/{saleHeader}/invoice
pos.invoice.pdf     GET  pos/{saleHeader}/invoice/pdf
installments.invoice     GET  pos/installments/{plan}/invoice
installments.invoice.pdf GET  pos/installments/{plan}/invoice/pdf
po.invoice          GET  purchase-orders/{purchaseOrder}/invoice
po.invoice.pdf      GET  purchase-orders/{purchaseOrder}/invoice/pdf
```

- [ ] **Step 3: Commit**

```bash
git add routes/web.php
git commit -m "feat: add PDF download routes for sale, installment, and PO invoices"
```

---

### Task 5: Add `invoicePdf()` Methods to Controllers

**Files:**
- Modify: `app/Http/Controllers/PosController.php`
- Modify: `app/Http/Controllers/InstallmentController.php`
- Modify: `app/Http/Controllers/PurchaseOrderController.php`

Each `invoicePdf()` method:
1. Same permission check as its `invoice()` sibling
2. Same `InvoiceNumber::generate()` logic (idempotent — if `invoice_number` already set, keeps it)
3. Same data loading
4. Builds identical `$invoice` array
5. Appends `$storeSettings = AppSetting::allAsArray()`
6. Loads the Blade template via `Pdf::loadView()` and streams it

Add this import to each controller that doesn't already have it:
```php
use Barryvdh\DomPDF\Facade\Pdf;
use App\Models\AppSetting;
```

**`PosController.php`** — add `invoicePdf()` immediately after `invoice()` (after line ~706):

```php
public function invoicePdf(SaleHeader $saleHeader)
{
    abort_unless(auth()->user()->hasPermission('pos', 'can_view'), 403);

    $saleHeader->load(['warehouse', 'customer', 'cashier', 'saleItems', 'paymentSplits']);

    if (! $saleHeader->invoice_number) {
        $saleHeader->update([
            'invoice_number'   => InvoiceNumber::generate(),
            'invoice_issued_at' => now(),
        ]);
        $saleHeader->refresh();
    }

    $plan = null;
    if ($saleHeader->payment_method === 'credit') {
        $plan = \App\Models\InstallmentPlan::where('sale_header_id', $saleHeader->id)
            ->with('payments')
            ->first();
    }

    $invoice = [
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
        'paymentSplits'  => $saleHeader->paymentSplits->map(fn ($ps) => [
            'paymentMethod' => $ps->payment_method,
            'amount'        => $ps->amount,
        ])->toArray(),
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
        'items'          => $saleHeader->saleItems->map(fn ($si) => [
            'name'           => $si->item_name_snapshot,
            'code'           => $si->item_code_snapshot,
            'unitPrice'      => $si->unit_price,
            'quantity'       => $si->quantity,
            'discountAmount' => $si->discount_amount,
            'lineTotal'      => $si->line_total,
        ])->toArray(),
        'schedule'       => $plan ? $plan->payments->map(fn ($p) => [
            'dueDate'        => $p->due_date->toDateString(),
            'amountDue'      => $p->amount_due,
            'interestAmount' => $p->interest_amount,
            'lateFeeApplied' => $p->late_fee_applied,
            'totalDue'       => $p->totalDue(),
            'status'         => $p->status,
        ])->toArray() : null,
    ];

    $pdf = Pdf::loadView('invoices.sale', [
        'invoice'       => $invoice,
        'storeSettings' => AppSetting::allAsArray(),
    ])->setPaper('a4');

    return response()->streamDownload(
        fn () => print($pdf->output()),
        $saleHeader->invoice_number . '.pdf',
        ['Content-Type' => 'application/pdf']
    );
}
```

**`InstallmentController.php`** — add `invoicePdf()` immediately after `invoice()` (after line ~553):

```php
public function invoicePdf(InstallmentPlan $plan)
{
    // Permission enforced by constructor middleware (pos / can_view for GET).
    $plan->load(['payments', 'saleHeader.saleItems', 'customer', 'saleHeader.warehouse']);

    abort_if(! $plan->saleHeader, 404);

    if (! $plan->invoice_number) {
        $plan->update([
            'invoice_number'   => InvoiceNumber::generate(),
            'invoice_issued_at' => now(),
        ]);
        $plan->refresh();
    }

    $invoice = [
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
        'paymentSplits'  => [],
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
        'items'          => $plan->saleHeader->saleItems->map(fn ($si) => [
            'name'           => $si->item_name_snapshot,
            'code'           => $si->item_code_snapshot,
            'unitPrice'      => $si->unit_price,
            'quantity'       => $si->quantity,
            'discountAmount' => $si->discount_amount,
            'lineTotal'      => $si->line_total,
        ])->toArray(),
        'schedule'       => $plan->payments->map(fn ($p) => [
            'dueDate'        => $p->due_date->toDateString(),
            'amountDue'      => $p->amount_due,
            'interestAmount' => $p->interest_amount,
            'lateFeeApplied' => $p->late_fee_applied,
            'totalDue'       => $p->totalDue(),
            'status'         => $p->status,
        ])->toArray(),
    ];

    $pdf = Pdf::loadView('invoices.sale', [
        'invoice'       => $invoice,
        'storeSettings' => AppSetting::allAsArray(),
    ])->setPaper('a4');

    return response()->streamDownload(
        fn () => print($pdf->output()),
        $plan->invoice_number . '.pdf',
        ['Content-Type' => 'application/pdf']
    );
}
```

**`PurchaseOrderController.php`** — add `invoicePdf()` immediately after `invoice()` (after line ~406):

```php
public function invoicePdf(PurchaseOrder $purchaseOrder)
{
    abort_unless(auth()->user()->hasPermission('purchase_orders', 'can_view'), 403);

    $purchaseOrder->load(['supplier', 'warehouse', 'items']);

    if (! $purchaseOrder->invoice_number) {
        $purchaseOrder->update([
            'invoice_number'   => InvoiceNumber::generate(),
            'invoice_issued_at' => now(),
        ]);
        $purchaseOrder->refresh();
    }

    $invoice = [
        'invoiceNumber' => $purchaseOrder->invoice_number,
        'issuedAt'      => $purchaseOrder->invoice_issued_at->toISOString(),
        'poNumber'      => $purchaseOrder->po_number,
        'date'          => $purchaseOrder->ordered_at->toISOString(),
        'expectedDate'  => $purchaseOrder->expected_at?->toDateString(),
        'status'        => $purchaseOrder->status,
        'supplier'      => [
            'name'    => $purchaseOrder->supplier?->name,
            'phone'   => $purchaseOrder->supplier?->phone,
            'address' => $purchaseOrder->supplier?->address,
        ],
        'warehouse'     => [
            'name'    => $purchaseOrder->warehouse?->name,
            'address' => $purchaseOrder->warehouse?->location,
            'phone'   => $purchaseOrder->warehouse?->phone,
        ],
        'subtotal'      => $purchaseOrder->subtotal,
        'taxAmount'     => $purchaseOrder->tax_amount,
        'grandTotal'    => $purchaseOrder->grand_total,
        'items'         => $purchaseOrder->items->map(fn ($i) => [
            'name'      => $i->item_name_snapshot,
            'code'      => null,
            'unitPrice' => $i->unit_price,
            'quantity'  => $i->ordered_qty,
            'lineTotal' => $i->line_total,
        ])->toArray(),
    ];

    $pdf = Pdf::loadView('invoices.purchase-order', [
        'invoice'       => $invoice,
        'storeSettings' => AppSetting::allAsArray(),
    ])->setPaper('a4');

    return response()->streamDownload(
        fn () => print($pdf->output()),
        $purchaseOrder->invoice_number . '.pdf',
        ['Content-Type' => 'application/pdf']
    );
}
```

- [ ] **Step 2: Add imports to the three controllers**

In `PosController.php`, add after existing `use` statements if not already present:
```php
use Barryvdh\DomPDF\Facade\Pdf;
```
(`AppSetting` and `InvoiceNumber` are already imported in this file — verify with `grep "use App\Models\AppSetting\|use App\Helpers\InvoiceNumber" app/Http/Controllers/PosController.php`)

In `InstallmentController.php`, same — add:
```php
use Barryvdh\DomPDF\Facade\Pdf;
```

In `PurchaseOrderController.php`, add:
```php
use Barryvdh\DomPDF\Facade\Pdf;
```

- [ ] **Step 3: Verify imports and no syntax errors**

```bash
php artisan route:list --name=invoice.pdf 2>&1
```

Expected: lists the 3 PDF routes with no PHP parse errors.

- [ ] **Step 4: Commit**

```bash
git add app/Http/Controllers/PosController.php \
        app/Http/Controllers/InstallmentController.php \
        app/Http/Controllers/PurchaseOrderController.php
git commit -m "feat: add invoicePdf() methods to POS, Installment, and PO controllers"
```

---

### Task 6: Add "Download PDF" Buttons to Frontend Pages

**Files:**
- Modify: `resources/js/pages/pos/Show.tsx`
- Modify: `resources/js/pages/pos/CreditHistory.tsx`
- Modify: `resources/js/pages/purchase-orders/Show.tsx`

Each button uses `window.location.href` (triggers browser file download, no popup blocker).

- [ ] **Step 1: Add PDF button to `pos/Show.tsx`**

Find the existing "Invoice" button block (around line 91–96):
```tsx
            <Button variant="outline" size="sm" onClick={() => {
              const w = window.open(route('pos.invoice', { saleHeader: sale.id }), 'invoice', 'width=900,height=700,toolbar=no,location=no,menubar=no,scrollbars=yes,resizable=yes');
              if (!w) alert('Popup diblokir oleh browser. Izinkan popup untuk halaman ini agar bisa membuka invoice.');
            }}>
              <Printer size={15} className="mr-1" /> Invoice
            </Button>
```

Add immediately after it:
```tsx
            <Button variant="outline" size="sm" onClick={() => {
              window.location.href = route('pos.invoice.pdf', { saleHeader: sale.id });
            }}>
              <FileDown size={15} className="mr-1" /> PDF
            </Button>
```

Also add `FileDown` to the import at the top of the file. The existing import is:
```tsx
import { ArrowLeft, Ban, Printer } from 'lucide-react';
```
Change to:
```tsx
import { ArrowLeft, Ban, FileDown, Printer } from 'lucide-react';
```

- [ ] **Step 2: Add PDF button to `pos/CreditHistory.tsx`**

Find the existing "Invoice" button block (around line 227–233):
```tsx
                                                    <button
                                                        type="button"
                                                        onClick={() => openInvoice(plan.id)}
                                                        title="Cetak Invoice"
                                                        className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded border hover:bg-muted transition-colors">
                                                        <FileText size={12} /> Invoice
                                                    </button>
```

Add immediately after it:
```tsx
                                                    <button
                                                        type="button"
                                                        onClick={() => { window.location.href = route('installments.invoice.pdf', { plan: plan.id }); }}
                                                        title="Download PDF Invoice"
                                                        className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded border hover:bg-muted transition-colors">
                                                        <FileDown size={12} /> PDF
                                                    </button>
```

Add `FileDown` to the existing lucide import in that file. Find the line that imports `FileText` and add `FileDown` to it.

- [ ] **Step 3: Add PDF button to `purchase-orders/Show.tsx`**

Find the existing "Invoice" button block (around line 106–112):
```tsx
            <Button size="sm" variant="outline" onClick={() => window.open(
              route('po.invoice', { purchaseOrder: po.id }),
              'invoice',
              'width=900,height=700,toolbar=no,location=no,menubar=no,scrollbars=yes,resizable=yes'
            )}>
              Invoice
            </Button>
```

Add immediately after it:
```tsx
            <Button size="sm" variant="outline" onClick={() => {
              window.location.href = route('po.invoice.pdf', { purchaseOrder: po.id });
            }}>
              <FileDown size={15} className="mr-1" /> PDF
            </Button>
```

Add `FileDown` to the existing lucide import. The current import is:
```tsx
import { ArrowLeft, XCircle, CheckCircle, Printer } from 'lucide-react';
```
Change to:
```tsx
import { ArrowLeft, CheckCircle, FileDown, Printer, XCircle } from 'lucide-react';
```

- [ ] **Step 4: Build and check for TypeScript errors**

```bash
npm run types 2>&1 | tail -20
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add resources/js/pages/pos/Show.tsx \
        resources/js/pages/pos/CreditHistory.tsx \
        resources/js/pages/purchase-orders/Show.tsx
git commit -m "feat: add Download PDF buttons to sale, installment, and PO pages"
```

---

### Task 7: Manual Smoke Test

- [ ] **Step 1: Test POS invoice PDF**

1. Log in as admin
2. Navigate to any completed sale: `/pos/{id}`
3. Click "PDF" — browser should download a file named `INV-YYYYMMDD-XXXX.pdf`
4. Open the PDF — verify: store name, invoice number, items table, totals, signature row

- [ ] **Step 2: Test installment plan invoice PDF**

1. Navigate to `/pos/kredit`
2. Find a plan row and click "PDF" next to "Invoice"
3. Open the PDF — verify: installment schedule table is present, customer name shown

- [ ] **Step 3: Test purchase order invoice PDF**

1. Navigate to any PO: `/purchase-orders/{id}`
2. Click "PDF" — browser should download PDF
3. Open the PDF — verify: supplier section, "KIRIM KE" warehouse section, items table, no discount column

- [ ] **Step 4: Verify idempotent invoice number**

After clicking PDF on a sale that already has an HTML invoice, check that the same `INV-...` number appears in both (not a new one generated).
