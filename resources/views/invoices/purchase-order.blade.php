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
