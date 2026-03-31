# Feature Upgrades — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the highest-impact missing features identified from competitor analysis, in priority order.

**Architecture:** Each feature is self-contained — new routes, controller methods, frontend pages, and DB migrations added incrementally without breaking existing functionality. All monetary values remain integers (no floats). All new pages follow AppLayout + Inertia pattern.

**Tech Stack:** Laravel 12, Inertia.js v2, React 19, TypeScript, Tailwind CSS v4, SQLite, Vite 6

---

## Status Implementasi (dicek 2026-03-29)

| # | Feature | Impact | Effort | Status |
|---|---|---|---|---|
| 1 | Export Laporan (Excel/PDF) | High | Low | ✅ Selesai — `app/Exports/`, `ReportController::exportStockExcel/Csv/exportSalesExcel()`, UI buttons di Report_Sales + Report_Stock + Report_ProfitLoss |
| 2 | Auto Draft PO dari Stok Minim | High | Medium | ✅ Selesai — `PurchaseOrderController::suggestions()`, halaman `purchase-orders/Suggestions.tsx`, bulk PO creation |
| 3 | Laporan Laba Rugi (P&L) | High | Low | ✅ Selesai — `ReportController::profitLoss()`, halaman `report/Report_ProfitLoss.tsx`, monthly/quarterly/YoY breakdown |
| 4 | Diskon & Promo Berbasis Aturan | Medium | High | ✅ Selesai — `Promotion` model dengan applies_to/min_purchase/max_discount, `Terminal.tsx::getBestPromo()`, auto-apply di POS |
| 5 | Multi Payment Split | Medium | Medium | ⚠️ Sebagian — kredit cicilan sudah ada, tapi split payment (2+ metode dalam 1 transaksi) belum ada. `sale_headers` masih single `payment_method` |

---

## Priority Order & Rationale

| # | Feature | Impact | Effort | Why First |
|---|---|---|---|---|
| 1 | Export Laporan (Excel/PDF) | High | Low | No new model, just format existing data |
| 2 | Auto Draft PO dari Stok Minim | High | Medium | Builds on existing PO module |
| 3 | Laporan Laba Rugi (P&L) | High | Low | Query only, no new model |
| 4 | Diskon & Promo Berbasis Aturan | Medium | High | Needs new model + POS UI changes |
| 5 | Multi Payment Split | Medium | Medium | POS UI + sale_headers schema change |

---

---

# PHASE 1 — Export Laporan ke Excel & PDF

**Goal:** Tambahkan tombol download di halaman Report_Sales, Report_Stock, dan Report_Cashflow untuk export ke Excel (.xlsx) dan PDF.

**Packages needed:**
```bash
composer require maatwebsite/excel
composer require barryvdh/laravel-dompdf
```

---

### Task 1: Install & Setup Export Packages

**Files:**
- Modify: `composer.json` (via composer)
- Create: `config/excel.php` (auto-published)
- Create: `config/dompdf.php` (auto-published)

**Step 1: Install packages**
```bash
composer require maatwebsite/excel barryvdh/laravel-dompdf
php artisan vendor:publish --provider="Maatwebsite\Excel\ExcelServiceProvider" --tag=config
php artisan vendor:publish --provider="Barryvdh\DomPDF\ServiceProvider"
```

**Step 2: Verify installation**
```bash
php artisan about | grep -i excel
# Should show Excel package registered
```

**Step 3: Commit**
```bash
git add composer.json composer.lock config/excel.php config/dompdf.php
git commit -m "feat: install maatwebsite/excel and dompdf for report export"
```

---

### Task 2: Export Class — Sales Report

**Files:**
- Create: `app/Exports/SalesReportExport.php`

**Step 1: Create export class**
```php
<?php
namespace App\Exports;

use App\Models\SaleHeader;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithTitle;
use Maatwebsite\Excel\Concerns\WithStyles;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

class SalesReportExport implements FromCollection, WithHeadings, WithTitle, WithStyles
{
    public function __construct(
        private string $dateFrom,
        private string $dateTo
    ) {}

    public function collection()
    {
        return SaleHeader::with('cashier', 'customer')
            ->where('status', 'completed')
            ->whereBetween('occurred_at', [$this->dateFrom . ' 00:00:00', $this->dateTo . ' 23:59:59'])
            ->orderBy('occurred_at')
            ->get()
            ->map(fn($s) => [
                $s->sale_number,
                $s->occurred_at->format('d/m/Y H:i'),
                $s->cashier?->name ?? '-',
                $s->customer?->name ?? 'Walk-in',
                $s->subtotal,
                $s->discount_amount,
                $s->grand_total,
                $s->payment_method,
                $s->status,
            ]);
    }

    public function headings(): array
    {
        return ['No. Transaksi', 'Waktu', 'Kasir', 'Pelanggan', 'Subtotal', 'Diskon', 'Grand Total', 'Metode Bayar', 'Status'];
    }

    public function title(): string { return 'Laporan Penjualan'; }

    public function styles(Worksheet $sheet)
    {
        return [1 => ['font' => ['bold' => true]]];
    }
}
```

**Step 2: Commit**
```bash
git add app/Exports/SalesReportExport.php
git commit -m "feat: add SalesReportExport class"
```

---

### Task 3: Export Class — Stock Report

**Files:**
- Create: `app/Exports/StockReportExport.php`

**Step 1: Create export class**
```php
<?php
namespace App\Exports;

use App\Models\Item;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithTitle;
use Maatwebsite\Excel\Concerns\WithStyles;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

class StockReportExport implements FromCollection, WithHeadings, WithTitle, WithStyles
{
    public function collection()
    {
        return Item::with('kategoriRelation')
            ->orderBy('nama')
            ->get()
            ->map(fn($i) => [
                $i->kode_item,
                $i->nama,
                $i->kategoriRelation?->nama ?? $i->kategori,
                $i->stok,
                $i->stok_minimal,
                $i->stok < $i->stok_minimal ? 'MINIM' : 'AMAN',
                $i->harga_beli,
                $i->harga_jual,
                $i->stok * $i->harga_beli, // nilai stok
            ]);
    }

    public function headings(): array
    {
        return ['Kode', 'Nama', 'Kategori', 'Stok', 'Min. Stok', 'Status', 'Harga Beli', 'Harga Jual', 'Nilai Stok'];
    }

    public function title(): string { return 'Laporan Stok'; }

    public function styles(Worksheet $sheet)
    {
        return [1 => ['font' => ['bold' => true]]];
    }
}
```

**Step 2: Commit**
```bash
git add app/Exports/StockReportExport.php
git commit -m "feat: add StockReportExport class"
```

---

### Task 4: Export Routes & Controller Methods

**Files:**
- Modify: `app/Http/Controllers/ReportController.php`
- Modify: `routes/web.php`

**Step 1: Add export methods to ReportController**

In `ReportController.php`, add these methods:
```php
use App\Exports\SalesReportExport;
use App\Exports\StockReportExport;
use Maatwebsite\Excel\Facades\Excel;
use Barryvdh\DomPDF\Facade\Pdf;

public function exportSalesExcel(Request $request)
{
    $from = $request->get('date_from', now()->startOfMonth()->format('Y-m-d'));
    $to   = $request->get('date_to', now()->format('Y-m-d'));
    $filename = 'laporan-penjualan-' . $from . '-' . $to . '.xlsx';
    return Excel::download(new SalesReportExport($from, $to), $filename);
}

public function exportStockExcel()
{
    return Excel::download(new StockReportExport(), 'laporan-stok-' . now()->format('Y-m-d') . '.xlsx');
}
```

**Step 2: Add routes in `routes/web.php`** (inside auth middleware group):
```php
Route::get('/report/sales/export/excel', [ReportController::class, 'exportSalesExcel'])->name('report.sales.excel');
Route::get('/report/stock/export/excel', [ReportController::class, 'exportStockExcel'])->name('report.stock.excel');
```

**Step 3: Commit**
```bash
git add app/Http/Controllers/ReportController.php routes/web.php
git commit -m "feat: add report export routes and controller methods"
```

---

### Task 5: Frontend — Export Buttons on Report Pages

**Files:**
- Modify: `resources/js/pages/report/Report_Sales.tsx`
- Modify: `resources/js/pages/report/Report_Stock.tsx`

**Step 1: Add export button to Report_Sales.tsx**

Find the header area (where filter/search buttons are) and add:
```tsx
<a
    href={`/report/sales/export/excel?date_from=${dateFrom}&date_to=${dateTo}`}
    className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700"
>
    <Download className="h-4 w-4" />
    Export Excel
</a>
```
Import `Download` from `lucide-react`.

**Step 2: Add export button to Report_Stock.tsx** similarly:
```tsx
<a
    href="/report/stock/export/excel"
    className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700"
>
    <Download className="h-4 w-4" />
    Export Excel
</a>
```

**Step 3: Test manually**
- Buka `/report/sales` → klik Export Excel → file `.xlsx` terdownload
- Buka `/report/stock` → klik Export Excel → file `.xlsx` terdownload

**Step 4: Commit**
```bash
git add resources/js/pages/report/Report_Sales.tsx resources/js/pages/report/Report_Stock.tsx
git commit -m "feat: add export excel buttons to report pages"
```

---

---

# PHASE 2 — Auto Draft PO dari Stok Minim

**Goal:** Tambahkan fitur "Buat PO Otomatis" yang men-generate draft Purchase Order untuk semua item yang stoknya di bawah minimum, dikelompokkan per supplier.

**Architecture:** Tombol di halaman Stok Minim (`/stock_alerts`) → POST request → controller generate satu PO per supplier → redirect ke halaman PO.

---

### Task 6: Migration — Tambah `default_supplier_id` ke `items`

**Files:**
- Create: `database/migrations/2026_03_10_000001_add_default_supplier_to_items.php`
- Modify: `app/Models/Item.php`

**Step 1: Create migration**
```php
<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('items', function (Blueprint $table) {
            $table->foreignId('default_supplier_id')->nullable()->constrained('suppliers')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('items', function (Blueprint $table) {
            $table->dropForeignIdFor(\App\Models\Supplier::class, 'default_supplier_id');
        });
    }
};
```

**Step 2: Run migration**
```bash
php artisan migrate
```

**Step 3: Add relation to Item model** (`app/Models/Item.php`):
```php
public function defaultSupplier()
{
    return $this->belongsTo(\App\Models\Supplier::class, 'default_supplier_id');
}
```

**Step 4: Add `default_supplier_id` to `$fillable` in Item model**

**Step 5: Commit**
```bash
git add database/migrations/2026_03_10_000001_add_default_supplier_to_items.php app/Models/Item.php
git commit -m "feat: add default_supplier_id to items for auto-PO"
```

---

### Task 7: Auto PO Controller Method

**Files:**
- Modify: `app/Http/Controllers/PurchaseOrderController.php`
- Modify: `routes/web.php`

**Step 1: Add `autoGenerate` method to PurchaseOrderController**
```php
public function autoGenerate(Request $request)
{
    // Get all items below minimum stock that have a default supplier
    $lowItems = Item::with('defaultSupplier')
        ->whereColumn('stok', '<', 'stok_minimal')
        ->whereNotNull('default_supplier_id')
        ->get();

    if ($lowItems->isEmpty()) {
        return back()->with('error', 'Tidak ada item stok minim dengan supplier default.');
    }

    // Group by supplier
    $bySupplier = $lowItems->groupBy('default_supplier_id');

    $defaultWarehouse = \App\Models\Warehouse::where('is_default', true)->first()
        ?? \App\Models\Warehouse::first();

    $created = 0;
    foreach ($bySupplier as $supplierId => $items) {
        $next   = PurchaseOrder::max('id') + 1;
        $number = 'PO-' . str_pad($next, 6, '0', STR_PAD_LEFT);

        $po = PurchaseOrder::create([
            'po_number'    => $number,
            'supplier_id'  => $supplierId,
            'warehouse_id' => $defaultWarehouse?->id,
            'status'       => 'draft',
            'note'         => 'Auto-generated dari stok minim pada ' . now()->format('d/m/Y'),
        ]);

        foreach ($items as $item) {
            $qty = max(1, $item->stok_minimal - $item->stok); // jumlah kurang
            $po->items()->create([
                'item_id'           => $item->id,
                'item_name_snapshot'=> $item->nama,
                'quantity'          => $qty,
                'unit_price'        => $item->harga_beli,
                'line_total'        => $qty * $item->harga_beli,
            ]);
        }
        $created++;
    }

    return redirect()->route('po.index')
        ->with('success', "$created PO draft berhasil dibuat dari stok minim.");
}
```

**Step 2: Add route** in `routes/web.php`:
```php
Route::post('/purchase-orders/auto-generate', [PurchaseOrderController::class, 'autoGenerate'])->name('po.auto_generate');
```
> Place this BEFORE `Route::post('/purchase-orders', ...)` to avoid route conflict.

**Step 3: Commit**
```bash
git add app/Http/Controllers/PurchaseOrderController.php routes/web.php
git commit -m "feat: add auto-generate PO from low stock items"
```

---

### Task 8: Frontend — Supplier Default di Edit Item & Tombol Auto PO

**Files:**
- Modify: `resources/js/pages/Items/Index.tsx` (form edit item, tambah field supplier)
- Modify: `resources/js/pages/Items/Stock_alerts.tsx` (tambah tombol Auto PO)

**Step 1: Tambah field `defaultSupplierId` di form edit item (Index.tsx)**

Di form edit/tambah item, tambahkan select untuk supplier default:
```tsx
<div>
    <label className="text-sm font-medium">Supplier Default (untuk Auto PO)</label>
    <select
        value={form.data.default_supplier_id ?? ''}
        onChange={e => form.setData('default_supplier_id', e.target.value)}
        className="w-full border rounded-md px-3 py-2 text-sm"
    >
        <option value="">-- Pilih Supplier --</option>
        {suppliers.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
        ))}
    </select>
</div>
```

Pass `suppliers` from ItemController (add to `index()` method props).

**Step 2: Tambah tombol "Auto Buat PO" di Stock_alerts.tsx**

```tsx
import { router } from '@inertiajs/react';

// Di header halaman, setelah judul:
<button
    onClick={() => {
        if (confirm('Buat draft PO otomatis untuk semua item stok minim yang punya supplier default?')) {
            router.post(route('po.auto_generate'));
        }
    }}
    className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
>
    <ShoppingCart className="h-4 w-4" />
    Auto Buat PO
</button>
```

**Step 3: Test manual**
1. Edit item, set supplier default
2. Buka `/stock_alerts`
3. Klik "Auto Buat PO"
4. Cek halaman `/purchase-orders` → draft PO baru muncul

**Step 4: Commit**
```bash
git add resources/js/pages/Items/Index.tsx resources/js/pages/Items/Stock_alerts.tsx
git commit -m "feat: auto PO button on stock alerts page and supplier field on item form"
```

---

---

# PHASE 3 — Laporan Laba Rugi (P&L)

**Goal:** Halaman laporan Laba Rugi yang menampilkan Omzet, HPP, Laba Kotor, per periode, dengan breakdown bulanan.

---

### Task 9: P&L Controller & Route

**Files:**
- Modify: `app/Http/Controllers/ReportController.php`
- Modify: `routes/web.php`

**Step 1: Add `profitLoss` method to ReportController**
```php
public function profitLoss(Request $request)
{
    $year  = $request->get('year', now()->year);

    // Monthly breakdown
    $monthly = [];
    for ($m = 1; $m <= 12; $m++) {
        $start = \Carbon\Carbon::create($year, $m, 1)->startOfMonth();
        $end   = $start->copy()->endOfMonth();

        $revenue = (int) \App\Models\SaleHeader::where('status', 'completed')
            ->whereBetween('occurred_at', [$start, $end])
            ->sum('grand_total');

        $cogs = (int) \App\Models\SaleItem::whereHas('saleHeader', fn($q) =>
            $q->where('status', 'completed')->whereBetween('occurred_at', [$start, $end])
        )->join('items', 'items.id', '=', 'sale_items.item_id')
         ->sum(\Illuminate\Support\Facades\DB::raw('sale_items.quantity * items.harga_beli'));

        $monthly[] = [
            'month'       => $start->format('M'),
            'month_num'   => $m,
            'revenue'     => $revenue,
            'cogs'        => $cogs,
            'gross_profit'=> $revenue - $cogs,
        ];
    }

    $totals = [
        'revenue'      => array_sum(array_column($monthly, 'revenue')),
        'cogs'         => array_sum(array_column($monthly, 'cogs')),
        'gross_profit' => array_sum(array_column($monthly, 'gross_profit')),
    ];

    return Inertia::render('report/Report_ProfitLoss', [
        'monthly' => $monthly,
        'totals'  => $totals,
        'year'    => (int) $year,
        'years'   => range(now()->year, now()->year - 3),
    ]);
}
```

**Step 2: Add route in `routes/web.php`**:
```php
Route::get('/report/profit-loss', [ReportController::class, 'profitLoss'])->name('Report_ProfitLoss');
```

**Step 3: Commit**
```bash
git add app/Http/Controllers/ReportController.php routes/web.php
git commit -m "feat: add profit & loss report controller and route"
```

---

### Task 10: P&L Frontend Page

**Files:**
- Create: `resources/js/pages/report/Report_ProfitLoss.tsx`

**Step 1: Create page**
```tsx
import AppLayout from '@/layouts/app-layout';
import { Head, usePage } from '@inertiajs/react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const breadcrumbs = [
    { title: 'Laporan', href: '/report/stock' },
    { title: 'Laba Rugi', href: '/report/profit-loss' },
];

function formatRp(n: number) {
    return 'Rp ' + n.toLocaleString('id-ID');
}

interface MonthData {
    month: string; month_num: number;
    revenue: number; cogs: number; gross_profit: number;
}

interface PageProps {
    monthly: MonthData[];
    totals: { revenue: number; cogs: number; gross_profit: number };
    year: number;
    years: number[];
    [key: string]: unknown;
}

export default function ReportProfitLoss() {
    const { monthly, totals, year, years } = usePage<PageProps>().props;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Laporan Laba Rugi" />
            <div className="flex flex-col gap-6 p-6">
                {/* Header + Year selector */}
                <div className="flex items-center justify-between">
                    <h1 className="text-xl font-bold">Laporan Laba Rugi {year}</h1>
                    <select
                        defaultValue={year}
                        onChange={e => window.location.href = `/report/profit-loss?year=${e.target.value}`}
                        className="border rounded-md px-3 py-2 text-sm"
                    >
                        {years.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>

                {/* Summary cards */}
                <div className="grid grid-cols-3 gap-4">
                    <div className="rounded-xl border bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 p-4">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Total Omzet</p>
                        <p className="text-2xl font-bold text-indigo-700 dark:text-indigo-300 mt-1">{formatRp(totals.revenue)}</p>
                    </div>
                    <div className="rounded-xl border bg-rose-50 dark:bg-rose-950/40 border-rose-200 p-4">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Total HPP</p>
                        <p className="text-2xl font-bold text-rose-700 dark:text-rose-300 mt-1">{formatRp(totals.cogs)}</p>
                    </div>
                    <div className="rounded-xl border bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 p-4">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Laba Kotor</p>
                        <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 mt-1">{formatRp(totals.gross_profit)}</p>
                    </div>
                </div>

                {/* Chart */}
                <div className="rounded-xl border bg-card p-4">
                    <h2 className="text-sm font-semibold mb-4">Tren Bulanan</h2>
                    <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={monthly} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                            <YAxis tickFormatter={v => 'Rp ' + (v/1000) + 'rb'} tick={{ fontSize: 10 }} width={80} />
                            <Tooltip formatter={(v: any) => formatRp(v)} />
                            <Legend />
                            <Bar dataKey="revenue" name="Omzet" fill="oklch(0.511 0.262 277)" radius={[4,4,0,0]} />
                            <Bar dataKey="cogs" name="HPP" fill="oklch(0.645 0.246 16)" radius={[4,4,0,0]} />
                            <Bar dataKey="gross_profit" name="Laba Kotor" fill="oklch(0.627 0.194 149)" radius={[4,4,0,0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Monthly breakdown table */}
                <div className="rounded-xl border bg-card overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                            <tr>
                                <th className="text-left px-4 py-2 font-medium text-xs">Bulan</th>
                                <th className="text-right px-4 py-2 font-medium text-xs">Omzet</th>
                                <th className="text-right px-4 py-2 font-medium text-xs">HPP</th>
                                <th className="text-right px-4 py-2 font-medium text-xs">Laba Kotor</th>
                                <th className="text-right px-4 py-2 font-medium text-xs">Margin %</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {monthly.map(row => (
                                <tr key={row.month_num} className="hover:bg-muted/30">
                                    <td className="px-4 py-2.5 font-medium text-xs">{row.month} {year}</td>
                                    <td className="px-4 py-2.5 text-right text-xs">{formatRp(row.revenue)}</td>
                                    <td className="px-4 py-2.5 text-right text-xs text-rose-600">{formatRp(row.cogs)}</td>
                                    <td className={`px-4 py-2.5 text-right text-xs font-semibold ${row.gross_profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                        {formatRp(row.gross_profit)}
                                    </td>
                                    <td className="px-4 py-2.5 text-right text-xs">
                                        {row.revenue > 0 ? ((row.gross_profit / row.revenue) * 100).toFixed(1) + '%' : '-'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="bg-muted font-semibold">
                            <tr>
                                <td className="px-4 py-2.5 text-xs">TOTAL</td>
                                <td className="px-4 py-2.5 text-right text-xs">{formatRp(totals.revenue)}</td>
                                <td className="px-4 py-2.5 text-right text-xs text-rose-600">{formatRp(totals.cogs)}</td>
                                <td className="px-4 py-2.5 text-right text-xs text-emerald-600">{formatRp(totals.gross_profit)}</td>
                                <td className="px-4 py-2.5 text-right text-xs">
                                    {totals.revenue > 0 ? ((totals.gross_profit / totals.revenue) * 100).toFixed(1) + '%' : '-'}
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        </AppLayout>
    );
}
```

**Step 2: Add sidebar nav item for P&L**

In `resources/js/components/app-sidebar.tsx`, tambahkan di bawah grup Laporan:
```tsx
{ title: 'Laba Rugi', url: '/report/profit-loss', icon: TrendingUp, iconColor: 'text-green-400' }
```
Import `TrendingUp` from `lucide-react`.

**Step 3: Test**
- Buka `/report/profit-loss` → tabel 12 bulan + 3 chart bars tampil
- Ganti tahun di dropdown → data berubah

**Step 4: Commit**
```bash
git add resources/js/pages/report/Report_ProfitLoss.tsx resources/js/components/app-sidebar.tsx
git commit -m "feat: profit & loss report page with monthly chart and table"
```

---

---

# PHASE 4 — Diskon & Promo Berbasis Aturan

**Goal:** Admin bisa membuat aturan promo (persentase diskon, berlaku untuk item/kategori tertentu atau semua, batas waktu). POS terminal membaca promo aktif dan mengaplikasikan otomatis.

---

### Task 11: Migration — Tabel `promotions`

**Files:**
- Create: `database/migrations/2026_03_10_000002_create_promotions_table.php`

**Step 1: Create migration**
```php
<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('promotions', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('code')->unique()->nullable(); // kode promo opsional
            $table->enum('type', ['percentage', 'fixed'])->default('percentage');
            $table->integer('value'); // persen atau Rupiah (integer)
            $table->enum('applies_to', ['all', 'category', 'item'])->default('all');
            $table->foreignId('applies_id')->nullable(); // id kategori atau item
            $table->integer('min_purchase')->default(0); // min. pembelian
            $table->integer('max_discount')->default(0); // maks diskon (0 = unlimited)
            $table->date('start_date');
            $table->date('end_date');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('promotions');
    }
};
```

**Step 2: Run migration**
```bash
php artisan migrate
```

**Step 3: Commit**
```bash
git add database/migrations/2026_03_10_000002_create_promotions_table.php
git commit -m "feat: create promotions table migration"
```

---

### Task 12: Promotion Model & Controller

**Files:**
- Create: `app/Models/Promotion.php`
- Create: `app/Http/Controllers/PromotionController.php`

**Step 1: Create Model**
```php
<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Promotion extends Model
{
    protected $fillable = [
        'name', 'code', 'type', 'value', 'applies_to',
        'applies_id', 'min_purchase', 'max_discount',
        'start_date', 'end_date', 'is_active',
    ];

    protected $casts = [
        'value'        => 'integer',
        'min_purchase' => 'integer',
        'max_discount' => 'integer',
        'is_active'    => 'boolean',
        'start_date'   => 'date',
        'end_date'     => 'date',
    ];

    // Scope: promo aktif hari ini
    public function scopeActive($query)
    {
        return $query->where('is_active', true)
            ->where('start_date', '<=', today())
            ->where('end_date', '>=', today());
    }
}
```

**Step 2: Create Controller**
```php
<?php
namespace App\Http\Controllers;

use App\Models\Promotion;
use Illuminate\Http\Request;
use Inertia\Inertia;

class PromotionController extends Controller
{
    public function index()
    {
        $promotions = Promotion::orderByDesc('created_at')->paginate(20);
        return Inertia::render('promotions/Index', ['promotions' => $promotions]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name'         => 'required|string|max:100',
            'code'         => 'nullable|string|unique:promotions,code',
            'type'         => 'required|in:percentage,fixed',
            'value'        => 'required|integer|min:1',
            'applies_to'   => 'required|in:all,category,item',
            'applies_id'   => 'nullable|integer',
            'min_purchase' => 'integer|min:0',
            'max_discount' => 'integer|min:0',
            'start_date'   => 'required|date',
            'end_date'     => 'required|date|after_or_equal:start_date',
            'is_active'    => 'boolean',
        ]);
        Promotion::create($data);
        return back()->with('success', 'Promo berhasil ditambahkan.');
    }

    public function update(Request $request, Promotion $promotion)
    {
        $data = $request->validate([
            'name'       => 'required|string|max:100',
            'is_active'  => 'boolean',
            'end_date'   => 'required|date',
        ]);
        $promotion->update($data);
        return back()->with('success', 'Promo diupdate.');
    }

    public function destroy(Promotion $promotion)
    {
        $promotion->delete();
        return back()->with('success', 'Promo dihapus.');
    }

    // Endpoint untuk POS terminal: ambil promo aktif
    public function active()
    {
        return response()->json(Promotion::active()->get());
    }
}
```

**Step 3: Add routes in `routes/web.php`**:
```php
Route::get('/promotions', [PromotionController::class, 'index'])->name('promotions.index');
Route::post('/promotions', [PromotionController::class, 'store'])->name('promotions.store');
Route::put('/promotions/{promotion}', [PromotionController::class, 'update'])->name('promotions.update');
Route::delete('/promotions/{promotion}', [PromotionController::class, 'destroy'])->name('promotions.destroy');
Route::get('/promotions/active', [PromotionController::class, 'active'])->name('promotions.active');
```

**Step 4: Commit**
```bash
git add app/Models/Promotion.php app/Http/Controllers/PromotionController.php routes/web.php
git commit -m "feat: Promotion model, controller, and routes"
```

---

### Task 13: Promotions Frontend Page

**Files:**
- Create: `resources/js/pages/promotions/Index.tsx`
- Modify: `resources/js/components/app-sidebar.tsx`

**Step 1: Create promotions list page** dengan:
- Tabel: Nama, Kode, Tipe, Nilai, Berlaku Untuk, Periode, Status (badge aktif/nonaktif)
- Dialog tambah promo (form lengkap)
- Toggle aktif/nonaktif langsung dari tabel
- Tombol hapus

**Step 2: Add to sidebar** (app-sidebar.tsx):
```tsx
{ title: 'Promo', url: '/promotions', icon: Tag, iconColor: 'text-pink-400' }
```

**Step 3: Integrate di POS Terminal** (`resources/js/pages/pos/Terminal.tsx`):
- Saat menambah item ke keranjang, cek promo aktif yang berlaku untuk item/kategori tersebut
- Tampilkan badge "PROMO X%" di item yang terkena diskon
- Hitung diskon otomatis di total

**Step 4: Commit**
```bash
git add resources/js/pages/promotions/Index.tsx resources/js/components/app-sidebar.tsx
git commit -m "feat: promotions management page and POS integration"
```

---

---

# PHASE 5 — Multi Payment Split

**Goal:** Kasir bisa memproses pembayaran dengan lebih dari satu metode (misal: Rp 50.000 tunai + Rp 30.000 transfer).

---

### Task 14: Migration — Tabel `sale_payments`

**Files:**
- Create: `database/migrations/2026_03_10_000003_create_sale_payments_table.php`

**Step 1: Create migration**
```php
Schema::create('sale_payments', function (Blueprint $table) {
    $table->id();
    $table->foreignId('sale_header_id')->constrained()->cascadeOnDelete();
    $table->enum('method', ['cash', 'transfer', 'qris', 'card']);
    $table->integer('amount');
    $table->string('reference')->nullable(); // no. referensi transfer dll
    $table->timestamps();
});
```

**Step 2: Run migration**
```bash
php artisan migrate
```

**Step 3: Create Model** `app/Models/SalePayment.php`:
```php
class SalePayment extends Model {
    protected $fillable = ['sale_header_id', 'method', 'amount', 'reference'];
    protected $casts = ['amount' => 'integer'];
}
```

**Step 4: Add relation to SaleHeader**:
```php
public function payments() { return $this->hasMany(SalePayment::class); }
```

**Step 5: Commit**
```bash
git add database/migrations/ app/Models/SalePayment.php app/Models/SaleHeader.php
git commit -m "feat: sale_payments table for multi-payment split"
```

---

### Task 15: POS Controller — Handle Split Payment

**Files:**
- Modify: `app/Http/Controllers/PosController.php` — method `store()`

**Step 1: Update `store()` to accept array of payments**

Ubah validasi:
```php
'payments' => 'required|array|min:1',
'payments.*.method' => 'required|in:cash,transfer,qris,card',
'payments.*.amount' => 'required|integer|min:1',
```

Setelah buat `SaleHeader`, simpan payments:
```php
foreach ($request->payments as $pay) {
    $saleHeader->payments()->create([
        'method' => $pay['method'],
        'amount' => $pay['amount'],
    ]);
}
// total bayar = sum of payments
$totalPaid = collect($request->payments)->sum('amount');
$change = max(0, $totalPaid - $saleHeader->grand_total);
$saleHeader->update(['payment_amount' => $totalPaid, 'change_amount' => $change]);
```

**Step 2: Commit**
```bash
git add app/Http/Controllers/PosController.php
git commit -m "feat: POS controller handles multi-payment split"
```

---

### Task 16: POS Terminal UI — Split Payment

**Files:**
- Modify: `resources/js/pages/pos/Terminal.tsx`

**Step 1: Replace single payment field with payment list**

State: `payments: { method: string; amount: number }[]`

UI:
```
[ Metode: [Cash ▼] ] [ Amount: _______ ] [ + Tambah ]
[ Transfer | Rp 50.000 ] [×]
[ Cash     | Rp 30.000 ] [×]
────────────────────────
Total Bayar: Rp 80.000
Kekurangan: Rp 0
Kembalian: Rp 0
```

**Step 2: Kirim `payments` array ke backend** saat proses transaksi

**Step 3: Tampilkan di detail transaksi** (`pos/Show.tsx`) — list metode bayar masing-masing

**Step 4: Commit**
```bash
git add resources/js/pages/pos/Terminal.tsx resources/js/pages/pos/Show.tsx
git commit -m "feat: multi payment split UI in POS terminal"
```

---

## Ringkasan Urutan Eksekusi

```
Phase 1: Export Excel     → Task 1 → 2 → 3 → 4 → 5
Phase 2: Auto PO          → Task 6 → 7 → 8
Phase 3: Laporan P&L      → Task 9 → 10
Phase 4: Diskon & Promo   → Task 11 → 12 → 13
Phase 5: Multi Payment    → Task 14 → 15 → 16
```

**Estimasi per phase:**
- Phase 1 (Export): ~1 jam
- Phase 2 (Auto PO): ~1.5 jam
- Phase 3 (P&L): ~1 jam
- Phase 4 (Promo): ~3 jam
- Phase 5 (Split Pay): ~2 jam
