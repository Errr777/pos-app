# Stock Opname, Barcode Label Printing & Advanced Reporting Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three features to close the gap with premium POS apps: Stock Opname (physical count with auto-adjustment), Barcode Label Printing (per-item printable labels), and Advanced Reporting (ABC analysis + peak hours heatmap).

**Architecture:** Stock Opname has its own migration, model, controller and two Inertia pages. Label printing is a client-side print page invoked from the Items list. Advanced reports are new controller methods on the existing ReportController with new Inertia pages, no new DB tables needed.

**Tech Stack:** Laravel 12, Inertia.js v2, React 19, TypeScript, Tailwind CSS v4, shadcn/ui, Recharts (already used in dashboard), `jsbarcode` npm package for barcode SVG rendering.

---

## Chunk 1: Stock Opname

### Task 1: Stock Opname — Migrations

**Files:**
- Create: `database/migrations/2026_03_11_000000_create_stock_opnames_table.php`
- Create: `database/migrations/2026_03_11_000001_create_stock_opname_items_table.php`

- [ ] **Step 1: Create stock_opnames migration**

```php
<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('stock_opnames', function (Blueprint $table) {
            $table->id();
            $table->string('ref_number', 50)->unique();
            $table->foreignId('warehouse_id')->constrained()->cascadeOnDelete();
            $table->string('status', 20)->default('draft'); // draft | submitted
            $table->date('date');
            $table->string('created_by', 255)->nullable();
            $table->timestamp('submitted_at')->nullable();
            $table->text('note')->nullable();
            $table->timestamps();
        });
    }
    public function down(): void { Schema::dropIfExists('stock_opnames'); }
};
```

- [ ] **Step 2: Create stock_opname_items migration**

```php
<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('stock_opname_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('opname_id')->constrained('stock_opnames')->cascadeOnDelete();
            $table->foreignId('item_id')->nullable()->constrained('items')->nullOnDelete();
            $table->string('item_name_snapshot', 150);
            $table->string('item_code_snapshot', 100)->nullable();
            $table->integer('system_qty')->default(0);
            $table->integer('actual_qty')->nullable();
            $table->integer('variance')->nullable(); // actual_qty - system_qty
            $table->string('note', 500)->nullable();
            $table->unique(['opname_id', 'item_id']);
            $table->timestamps();
        });
    }
    public function down(): void { Schema::dropIfExists('stock_opname_items'); }
};
```

- [ ] **Step 3: Run migrations**

```bash
php artisan migrate
```

Expected: `stock_opnames` and `stock_opname_items` tables created.

- [ ] **Step 4: Commit**

```bash
git add database/migrations/2026_03_11_000000_create_stock_opnames_table.php database/migrations/2026_03_11_000001_create_stock_opname_items_table.php
git commit -m "feat: add stock_opnames and stock_opname_items migrations"
```

---

### Task 2: Stock Opname — Models

**Files:**
- Create: `app/Models/StockOpname.php`
- Create: `app/Models/StockOpnameItem.php`

- [ ] **Step 1: Create StockOpname model**

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class StockOpname extends Model
{
    protected $fillable = [
        'ref_number', 'warehouse_id', 'status',
        'date', 'created_by', 'submitted_at', 'note',
    ];

    protected $casts = [
        'date'         => 'date',
        'submitted_at' => 'datetime',
        'warehouse_id' => 'integer',
    ];

    public function warehouse() { return $this->belongsTo(Warehouse::class); }
    public function items()     { return $this->hasMany(StockOpnameItem::class, 'opname_id'); }
}
```

- [ ] **Step 2: Create StockOpnameItem model**

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class StockOpnameItem extends Model
{
    protected $fillable = [
        'opname_id', 'item_id', 'item_name_snapshot', 'item_code_snapshot',
        'system_qty', 'actual_qty', 'variance', 'note',
    ];

    protected $casts = [
        'system_qty' => 'integer',
        'actual_qty' => 'integer',
        'variance'   => 'integer',
    ];

    public function opname() { return $this->belongsTo(StockOpname::class); }
    public function item()   { return $this->belongsTo(Item::class); }
}
```

- [ ] **Step 3: Commit**

```bash
git add app/Models/StockOpname.php app/Models/StockOpnameItem.php
git commit -m "feat: add StockOpname and StockOpnameItem models"
```

---

### Task 3: Stock Opname — Controller & Routes

**Files:**
- Create: `app/Http/Controllers/StockOpnameController.php`
- Modify: `routes/web.php`

- [ ] **Step 1: Create StockOpnameController**

```php
<?php

namespace App\Http\Controllers;

use App\Models\StockAdjustment;
use App\Models\StockOpname;
use App\Models\StockOpnameItem;
use App\Models\Warehouse;
use App\Models\WarehouseItem;
use App\Traits\FiltersWarehouseByUser;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class StockOpnameController extends Controller
{
    use FiltersWarehouseByUser;

    // GET /inventory/opname — list of opname sessions
    public function index(Request $request)
    {
        $perPage = in_array((int) $request->get('per_page', 20), [10, 20, 50]) ? (int) $request->get('per_page', 20) : 20;

        $query = StockOpname::with('warehouse')
            ->orderBy('created_at', 'desc');

        $this->applyWarehouseFilter($query, 'warehouse_id');

        $opnames = $query->paginate($perPage)->withQueryString()->through(fn($o) => [
            'id'          => $o->id,
            'refNumber'   => $o->ref_number,
            'warehouseId' => $o->warehouse_id,
            'warehouse'   => $o->warehouse?->name ?? '-',
            'date'        => $o->date?->format('Y-m-d'),
            'status'      => $o->status,
            'createdBy'   => $o->created_by,
            'submittedAt' => $o->submitted_at?->format('d/m/Y H:i'),
            'itemCount'   => $o->items()->count(),
        ]);

        $warehouseQuery = Warehouse::where('is_active', true)->orderBy('name');
        $this->applyWarehouseFilter($warehouseQuery, 'id');
        $warehouses = $warehouseQuery->get()->map(fn($w) => ['id' => $w->id, 'name' => $w->name]);

        return Inertia::render('inventory/Stock_Opname', [
            'opnames'    => $opnames,
            'warehouses' => $warehouses,
            'filters'    => $request->only(['per_page']),
        ]);
    }

    // POST /inventory/opname — start new opname session
    public function store(Request $request)
    {
        $data = $request->validate([
            'warehouse_id' => 'required|integer|exists:warehouses,id',
            'date'         => 'required|date_format:Y-m-d',
            'note'         => 'nullable|string|max:1000',
        ]);

        $ref = 'OPN-' . now()->format('Ymd') . '-' . strtoupper(substr(uniqid(), -4));

        $opname = DB::transaction(function () use ($data, $ref) {
            $opname = StockOpname::create([
                'ref_number'   => $ref,
                'warehouse_id' => $data['warehouse_id'],
                'status'       => 'draft',
                'date'         => $data['date'],
                'note'         => $data['note'] ?? null,
                'created_by'   => Auth::user()?->name ?? 'System',
            ]);

            // Snapshot current warehouse stock for each item
            $warehouseItems = WarehouseItem::with('item')
                ->where('warehouse_id', $data['warehouse_id'])
                ->get();

            foreach ($warehouseItems as $wi) {
                if (!$wi->item) continue;
                StockOpnameItem::create([
                    'opname_id'          => $opname->id,
                    'item_id'            => $wi->item_id,
                    'item_name_snapshot' => $wi->item->nama,
                    'item_code_snapshot' => $wi->item->kode_item,
                    'system_qty'         => $wi->stok,
                    'actual_qty'         => null,
                    'variance'           => null,
                ]);
            }

            return $opname;
        });

        return redirect()->route('opname.show', $opname->id)
            ->with('success', "Sesi stock opname {$ref} dimulai.");
    }

    // GET /inventory/opname/{opname} — count entry sheet
    public function show(StockOpname $opname)
    {
        $opname->load(['warehouse', 'items.item']);

        $rows = $opname->items->sortBy('item_name_snapshot')->map(fn($oi) => [
            'id'          => $oi->id,
            'itemId'      => $oi->item_id,
            'name'        => $oi->item_name_snapshot,
            'code'        => $oi->item_code_snapshot,
            'systemQty'   => $oi->system_qty,
            'actualQty'   => $oi->actual_qty,
            'variance'    => $oi->variance,
            'note'        => $oi->note,
        ])->values()->all();

        return Inertia::render('inventory/Stock_Opname_Detail', [
            'opname' => [
                'id'        => $opname->id,
                'refNumber' => $opname->ref_number,
                'warehouse' => $opname->warehouse?->name,
                'date'      => $opname->date?->format('Y-m-d'),
                'status'    => $opname->status,
                'note'      => $opname->note,
                'createdBy' => $opname->created_by,
            ],
            'rows' => $rows,
        ]);
    }

    // PUT /inventory/opname/{opname}/items — save actual counts (draft only)
    public function updateItems(Request $request, StockOpname $opname)
    {
        if ($opname->status !== 'draft') {
            return back()->with('error', 'Opname sudah disubmit, tidak dapat diubah.');
        }

        $data = $request->validate([
            'items'              => 'required|array',
            'items.*.id'         => 'required|integer|exists:stock_opname_items,id',
            'items.*.actual_qty' => 'nullable|integer|min:0',
            'items.*.note'       => 'nullable|string|max:500',
        ]);

        DB::transaction(function () use ($data) {
            foreach ($data['items'] as $row) {
                $oi = StockOpnameItem::findOrFail($row['id']);
                $actual = isset($row['actual_qty']) && $row['actual_qty'] !== null ? (int) $row['actual_qty'] : null;
                $oi->update([
                    'actual_qty' => $actual,
                    'variance'   => $actual !== null ? $actual - $oi->system_qty : null,
                    'note'       => $row['note'] ?? null,
                ]);
            }
        });

        return back()->with('success', 'Data hitungan disimpan.');
    }

    // POST /inventory/opname/{opname}/submit — finalize, create adjustments
    public function submit(StockOpname $opname)
    {
        if ($opname->status !== 'draft') {
            return back()->with('error', 'Opname sudah disubmit.');
        }

        $opname->load('items.item');
        $uncounted = $opname->items->whereNull('actual_qty');
        if ($uncounted->count() > 0) {
            return back()->with('error', "Masih ada {$uncounted->count()} item belum dihitung.");
        }

        DB::transaction(function () use ($opname) {
            foreach ($opname->items as $oi) {
                if ($oi->variance === 0 || $oi->item === null) continue;

                // Update WarehouseItem stock
                $wi = WarehouseItem::where('warehouse_id', $opname->warehouse_id)
                    ->where('item_id', $oi->item_id)
                    ->first();

                if ($wi) {
                    $wi->stok = $oi->actual_qty;
                    $wi->save();
                }

                // Recalculate global item stock
                $oi->item->stok = (int) WarehouseItem::where('item_id', $oi->item_id)->sum('stok');
                $oi->item->save();

                // Create audit record
                StockAdjustment::create([
                    'txn_id'       => 'OPN-' . strtoupper(substr(uniqid(), -8)),
                    'warehouse_id' => $opname->warehouse_id,
                    'item_id'      => $oi->item_id,
                    'old_quantity' => $oi->system_qty,
                    'new_quantity' => $oi->actual_qty,
                    'difference'   => $oi->variance,
                    'reason'       => 'Stok Opname',
                    'actor'        => $opname->created_by ?? Auth::user()?->name ?? 'System',
                    'occurred_at'  => $opname->date->toDateTimeString(),
                    'note'         => "Ref: {$opname->ref_number}",
                ]);
            }

            $opname->update([
                'status'       => 'submitted',
                'submitted_at' => now(),
            ]);
        });

        return redirect()->route('opname.index')
            ->with('success', "Opname {$opname->ref_number} disubmit. Stok diperbarui.");
    }

    // DELETE /inventory/opname/{opname} — delete draft only
    public function destroy(StockOpname $opname)
    {
        if ($opname->status !== 'draft') {
            return back()->with('error', 'Hanya opname draft yang bisa dihapus.');
        }
        $opname->delete();
        return redirect()->route('opname.index')->with('success', 'Opname dihapus.');
    }
}
```

- [ ] **Step 2: Add routes to routes/web.php**

Inside the `auth + verified` middleware group, add after the stock_adjustment routes:

```php
Route::get('inventory/opname',                              [StockOpnameController::class, 'index'])      ->name('opname.index');
Route::post('inventory/opname',                             [StockOpnameController::class, 'store'])      ->name('opname.store');
Route::get('inventory/opname/{opname}',                     [StockOpnameController::class, 'show'])       ->name('opname.show');
Route::put('inventory/opname/{opname}/items',               [StockOpnameController::class, 'updateItems'])->name('opname.update_items');
Route::post('inventory/opname/{opname}/submit',             [StockOpnameController::class, 'submit'])     ->name('opname.submit');
Route::delete('inventory/opname/{opname}',                  [StockOpnameController::class, 'destroy'])    ->name('opname.destroy');
```

Also add import at top of routes/web.php:
```php
use App\Http\Controllers\StockOpnameController;
```

- [ ] **Step 3: Verify routes are registered**

```bash
php artisan route:list --name=opname
```

Expected: 6 opname routes listed.

- [ ] **Step 4: Commit**

```bash
git add app/Http/Controllers/StockOpnameController.php routes/web.php
git commit -m "feat: add StockOpnameController and routes"
```

---

### Task 4: Stock Opname — Frontend Pages

**Files:**
- Create: `resources/js/pages/inventory/Stock_Opname.tsx`
- Create: `resources/js/pages/inventory/Stock_Opname_Detail.tsx`
- Modify: `resources/js/components/app-sidebar.tsx`

- [ ] **Step 1: Create Stock_Opname.tsx (list page)**

```tsx
import { useState } from 'react';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import { PlusIcon, ClipboardCheck, Eye, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Pagination from '@/components/Pagination';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Stock Opname', href: '/inventory/opname' },
];

interface OpnameRow {
    id: number;
    refNumber: string;
    warehouse: string;
    date: string;
    status: 'draft' | 'submitted';
    createdBy: string;
    submittedAt: string | null;
    itemCount: number;
}

interface PageProps {
    opnames: { data: OpnameRow[]; current_page: number; last_page: number; total: number };
    warehouses: { id: number; name: string }[];
    filters: { per_page?: number };
    [key: string]: unknown;
}

const STATUS_CLS: Record<string, string> = {
    draft:     'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    submitted: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
};

export default function StockOpname() {
    const { opnames, warehouses } = usePage<PageProps>().props;
    const [showNew, setShowNew]     = useState(false);
    const [warehouseId, setWarehouseId] = useState('');
    const [date, setDate]           = useState(new Date().toISOString().slice(0, 10));
    const [note, setNote]           = useState('');
    const [submitting, setSubmitting] = useState(false);

    const safeOpnames = opnames ?? { data: [], current_page: 1, last_page: 1, total: 0 };

    const startOpname = () => {
        if (!warehouseId || !date) return;
        setSubmitting(true);
        router.post('/inventory/opname', { warehouse_id: warehouseId, date, note }, {
            onFinish: () => setSubmitting(false),
        });
    };

    const deleteOpname = (id: number, ref: string) => {
        if (!confirm(`Hapus opname ${ref}?`)) return;
        router.delete(`/inventory/opname/${id}`);
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Stock Opname" />
            <div className="p-6 space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-2">
                            <ClipboardCheck className="w-6 h-6 text-amber-500" />
                            Stock Opname
                        </h1>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            Hitung stok fisik dan sesuaikan dengan sistem
                        </p>
                    </div>
                    <Button onClick={() => setShowNew(true)} className="flex items-center gap-2">
                        <PlusIcon className="w-4 h-4" /> Mulai Opname
                    </Button>
                </div>

                {/* New Opname Modal */}
                {showNew && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                        <div className="bg-background rounded-xl shadow-2xl p-6 w-full max-w-md space-y-4">
                            <h2 className="text-lg font-semibold">Mulai Sesi Stock Opname</h2>

                            <div className="space-y-1">
                                <label className="text-sm font-medium">Gudang</label>
                                <select
                                    className="w-full border rounded-lg px-3 py-2 bg-background text-sm"
                                    value={warehouseId}
                                    onChange={e => setWarehouseId(e.target.value)}
                                >
                                    <option value="">-- Pilih Gudang --</option>
                                    {warehouses.map(w => (
                                        <option key={w.id} value={w.id}>{w.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-1">
                                <label className="text-sm font-medium">Tanggal</label>
                                <input
                                    type="date"
                                    className="w-full border rounded-lg px-3 py-2 bg-background text-sm"
                                    value={date}
                                    onChange={e => setDate(e.target.value)}
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-sm font-medium">Catatan (opsional)</label>
                                <textarea
                                    className="w-full border rounded-lg px-3 py-2 bg-background text-sm"
                                    rows={2}
                                    value={note}
                                    onChange={e => setNote(e.target.value)}
                                />
                            </div>

                            <div className="flex justify-end gap-2">
                                <Button variant="outline" onClick={() => setShowNew(false)}>Batal</Button>
                                <Button onClick={startOpname} disabled={submitting || !warehouseId || !date}>
                                    {submitting ? 'Memulai...' : 'Mulai Opname'}
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Table */}
                <div className="rounded-xl border bg-card overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-muted/40 border-b">
                            <tr>
                                <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wide">Ref</th>
                                <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wide">Gudang</th>
                                <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wide">Tanggal</th>
                                <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wide">Item</th>
                                <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wide">Status</th>
                                <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wide">Dibuat Oleh</th>
                                <th className="px-4 py-3 text-right font-semibold text-xs uppercase tracking-wide">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {safeOpnames.data.length === 0 && (
                                <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                                    Belum ada sesi opname. Klik "Mulai Opname" untuk memulai.
                                </td></tr>
                            )}
                            {safeOpnames.data.map(o => (
                                <tr key={o.id} className="hover:bg-muted/30 transition-colors">
                                    <td className="px-4 py-3 font-mono text-xs font-medium">{o.refNumber}</td>
                                    <td className="px-4 py-3">{o.warehouse}</td>
                                    <td className="px-4 py-3">{o.date}</td>
                                    <td className="px-4 py-3 tabular-nums">{o.itemCount} item</td>
                                    <td className="px-4 py-3">
                                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CLS[o.status] ?? ''}`}>
                                            {o.status === 'draft' ? 'Draft' : 'Selesai'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-muted-foreground">{o.createdBy}</td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-1 justify-end">
                                            <button
                                                onClick={() => router.visit(`/inventory/opname/${o.id}`)}
                                                className="p-1.5 rounded hover:bg-indigo-100 text-indigo-600 dark:hover:bg-indigo-900/40"
                                                title="Lihat Detail"
                                            >
                                                <Eye className="w-4 h-4" />
                                            </button>
                                            {o.status === 'draft' && (
                                                <button
                                                    onClick={() => deleteOpname(o.id, o.refNumber)}
                                                    className="p-1.5 rounded hover:bg-rose-100 text-rose-600 dark:hover:bg-rose-900/40"
                                                    title="Hapus"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <Pagination data={safeOpnames} />
            </div>
        </AppLayout>
    );
}
```

- [ ] **Step 2: Create Stock_Opname_Detail.tsx (count entry sheet)**

```tsx
import { useState, useCallback } from 'react';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import { Save, CheckCircle2, AlertTriangle, ClipboardCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface OpnameInfo {
    id: number;
    refNumber: string;
    warehouse: string;
    date: string;
    status: 'draft' | 'submitted';
    note: string | null;
    createdBy: string;
}

interface OpnameRow {
    id: number;
    itemId: number | null;
    name: string;
    code: string | null;
    systemQty: number;
    actualQty: number | null;
    variance: number | null;
    note: string | null;
}

interface PageProps {
    opname: OpnameInfo;
    rows: OpnameRow[];
    [key: string]: unknown;
}

export default function StockOpnameDetail() {
    const { opname, rows: initialRows } = usePage<PageProps>().props;
    const [rows, setRows] = useState<OpnameRow[]>(initialRows);
    const [saving, setSaving]     = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Dashboard', href: '/dashboard' },
        { title: 'Stock Opname', href: '/inventory/opname' },
        { title: opname.refNumber, href: `/inventory/opname/${opname.id}` },
    ];

    const updateRow = useCallback((id: number, field: 'actualQty' | 'note', value: string) => {
        setRows(prev => prev.map(r => {
            if (r.id !== id) return r;
            if (field === 'actualQty') {
                const actual = value === '' ? null : parseInt(value, 10);
                return { ...r, actualQty: actual, variance: actual !== null ? actual - r.systemQty : null };
            }
            return { ...r, note: value };
        }));
    }, []);

    const saveItems = () => {
        setSaving(true);
        router.put(`/inventory/opname/${opname.id}/items`, {
            items: rows.map(r => ({ id: r.id, actual_qty: r.actualQty, note: r.note })),
        }, { onFinish: () => setSaving(false) });
    };

    const submitOpname = () => {
        const uncounted = rows.filter(r => r.actualQty === null).length;
        if (uncounted > 0) {
            alert(`Masih ada ${uncounted} item belum dihitung.`);
            return;
        }
        if (!confirm('Submit opname? Stok akan diperbarui sesuai hitungan aktual.')) return;
        setSubmitting(true);
        router.post(`/inventory/opname/${opname.id}/submit`, {}, {
            onFinish: () => setSubmitting(false),
        });
    };

    const isSubmitted = opname.status === 'submitted';
    const countedCount = rows.filter(r => r.actualQty !== null).length;
    const totalVariance = rows.reduce((sum, r) => sum + Math.abs(r.variance ?? 0), 0);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Stock Opname — ${opname.refNumber}`} />
            <div className="p-6 space-y-6">
                {/* Header */}
                <div className="flex items-start justify-between">
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-2">
                            <ClipboardCheck className="w-6 h-6 text-amber-500" />
                            {opname.refNumber}
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            {opname.warehouse} · {opname.date} · Dibuat oleh {opname.createdBy}
                        </p>
                    </div>
                    {!isSubmitted && (
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={saveItems} disabled={saving}>
                                <Save className="w-4 h-4 mr-1" />
                                {saving ? 'Menyimpan...' : 'Simpan'}
                            </Button>
                            <Button onClick={submitOpname} disabled={submitting}>
                                <CheckCircle2 className="w-4 h-4 mr-1" />
                                {submitting ? 'Memproses...' : 'Submit & Terapkan'}
                            </Button>
                        </div>
                    )}
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-4">
                    <div className="rounded-xl border bg-card p-4">
                        <div className="text-2xl font-bold tabular-nums">{rows.length}</div>
                        <div className="text-sm text-muted-foreground">Total Item</div>
                    </div>
                    <div className="rounded-xl border bg-card p-4">
                        <div className="text-2xl font-bold tabular-nums text-emerald-600">{countedCount}</div>
                        <div className="text-sm text-muted-foreground">Sudah Dihitung</div>
                    </div>
                    <div className="rounded-xl border bg-card p-4">
                        <div className={`text-2xl font-bold tabular-nums ${totalVariance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                            {totalVariance}
                        </div>
                        <div className="text-sm text-muted-foreground">Total Selisih</div>
                    </div>
                </div>

                {/* Count Sheet Table */}
                <div className="rounded-xl border bg-card overflow-hidden">
                    <table className="w-full text-sm table-fixed">
                        <colgroup>
                            <col className="w-[30%]" />
                            <col className="w-[15%]" />
                            <col className="w-[12%]" />
                            <col className="w-[16%]" />
                            <col className="w-[12%]" />
                            <col className="w-[15%]" />
                        </colgroup>
                        <thead className="bg-muted/40 border-b">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Nama Item</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Kode</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide">Stok Sistem</th>
                                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide">Stok Aktual</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide">Selisih</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Catatan</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {rows.map(r => {
                                const varClass = r.variance === null ? '' : r.variance > 0
                                    ? 'text-emerald-600 font-medium'
                                    : r.variance < 0 ? 'text-rose-600 font-medium' : 'text-muted-foreground';
                                return (
                                    <tr key={r.id} className="hover:bg-muted/20 transition-colors">
                                        <td className="px-4 py-2.5 truncate" title={r.name}>{r.name}</td>
                                        <td className="px-4 py-2.5 font-mono text-xs truncate text-muted-foreground">{r.code}</td>
                                        <td className="px-4 py-2.5 text-right tabular-nums">{r.systemQty}</td>
                                        <td className="px-4 py-2.5 text-center">
                                            {isSubmitted ? (
                                                <span className="tabular-nums">{r.actualQty ?? '-'}</span>
                                            ) : (
                                                <input
                                                    type="number"
                                                    min="0"
                                                    className="w-20 text-center border rounded px-2 py-1 bg-background text-sm tabular-nums"
                                                    value={r.actualQty ?? ''}
                                                    onChange={e => updateRow(r.id, 'actualQty', e.target.value)}
                                                    placeholder="—"
                                                />
                                            )}
                                        </td>
                                        <td className={`px-4 py-2.5 text-right tabular-nums ${varClass}`}>
                                            {r.variance !== null
                                                ? (r.variance > 0 ? '+' : '') + r.variance
                                                : '—'}
                                        </td>
                                        <td className="px-4 py-2.5">
                                            {isSubmitted ? (
                                                <span className="text-xs text-muted-foreground">{r.note ?? ''}</span>
                                            ) : (
                                                <input
                                                    type="text"
                                                    className="w-full border rounded px-2 py-1 bg-background text-xs"
                                                    value={r.note ?? ''}
                                                    onChange={e => updateRow(r.id, 'note', e.target.value)}
                                                    placeholder="Opsional..."
                                                />
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {!isSubmitted && (
                    <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        Setelah submit, stok sistem akan diperbarui ke nilai aktual dan tidak dapat dibatalkan.
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
```

- [ ] **Step 3: Add sidebar entry**

In `resources/js/components/app-sidebar.tsx`, find the Inventori items array and add:

```tsx
{ title: 'Stock Opname', href: '/inventory/opname' },
```

after the existing Inventori items (e.g. after 'Penyesuaian Stok').

- [ ] **Step 4: Commit**

```bash
git add resources/js/pages/inventory/Stock_Opname.tsx resources/js/pages/inventory/Stock_Opname_Detail.tsx resources/js/components/app-sidebar.tsx
git commit -m "feat: add Stock Opname list and detail pages with sidebar link"
```

---

## Chunk 2: Barcode Label Printing

### Task 5: Barcode Label Printing — Setup & Backend

**Files:**
- Modify: `app/Http/Controllers/ItemController.php`
- Modify: `routes/web.php`

- [ ] **Step 1: Install jsbarcode**

```bash
npm install jsbarcode
```

- [ ] **Step 2: Add printLabels controller method to ItemController**

Add this method to `app/Http/Controllers/ItemController.php` before the closing brace:

```php
public function printLabels(Request $request)
{
    $ids = array_filter(array_map('intval', explode(',', $request->get('ids', ''))));

    if (empty($ids)) {
        return redirect()->route('item.index')->with('error', 'Pilih item terlebih dahulu.');
    }

    // Limit to 100 items per print job
    $ids = array_slice($ids, 0, 100);

    $items = Item::whereIn('id', $ids)
        ->orderBy('nama')
        ->get()
        ->map(fn($i) => [
            'id'       => $i->id,
            'name'     => $i->nama,
            'code'     => $i->kode_item,
            'price'    => $i->harga_jual,
            'category' => $i->kategori,
        ])
        ->values()
        ->all();

    return Inertia::render('Items/PrintLabels', [
        'items' => $items,
    ]);
}
```

- [ ] **Step 3: Add route in routes/web.php**

Add inside auth+verified group, near existing item routes:

```php
Route::get('/item/print-labels', [ItemController::class, 'printLabels'])->name('item.print_labels');
```

**Important:** Place this route BEFORE `Route::get('/item/{item}', ...)` to prevent `{item}` from capturing "print-labels".

- [ ] **Step 4: Commit**

```bash
git add app/Http/Controllers/ItemController.php routes/web.php
git commit -m "feat: add printLabels controller method and route"
```

---

### Task 6: Barcode Label Printing — Frontend

**Files:**
- Create: `resources/js/pages/Items/PrintLabels.tsx`
- Modify: `resources/js/pages/Items/Index.tsx`

- [ ] **Step 1: Create PrintLabels.tsx**

```tsx
import { useEffect, useRef } from 'react';
import { Head, usePage } from '@inertiajs/react';
import JsBarcode from 'jsbarcode';

interface LabelItem {
    id: number;
    name: string;
    code: string;
    price: number;
    category: string | null;
}

interface PageProps {
    items: LabelItem[];
    [key: string]: unknown;
}

function formatRp(n: number) {
    return 'Rp ' + n.toLocaleString('id-ID');
}

function BarcodeLabel({ item }: { item: LabelItem }) {
    const svgRef = useRef<SVGSVGElement>(null);

    useEffect(() => {
        if (svgRef.current && item.code) {
            try {
                JsBarcode(svgRef.current, item.code, {
                    format: 'CODE128',
                    width: 1.5,
                    height: 40,
                    displayValue: false,
                    margin: 0,
                });
            } catch {
                // invalid barcode value — skip
            }
        }
    }, [item.code]);

    return (
        <div className="label-card">
            <div className="label-name">{item.name}</div>
            {item.category && <div className="label-category">{item.category}</div>}
            <svg ref={svgRef} className="label-barcode" />
            <div className="label-code">{item.code}</div>
            <div className="label-price">{formatRp(item.price)}</div>
        </div>
    );
}

export default function PrintLabels() {
    const { items } = usePage<PageProps>().props;

    useEffect(() => {
        // Auto-trigger print dialog after barcodes render
        const t = setTimeout(() => window.print(), 500);
        return () => clearTimeout(t);
    }, []);

    return (
        <>
            <Head title="Print Labels" />
            <style>{`
                @media screen {
                    body { background: #f1f5f9; padding: 24px; }
                    .print-controls {
                        display: flex; gap: 12px; margin-bottom: 24px;
                        align-items: center; font-family: sans-serif;
                    }
                    .print-btn {
                        background: #4f46e5; color: white; border: none;
                        padding: 8px 20px; border-radius: 8px; cursor: pointer;
                        font-size: 14px; font-weight: 600;
                    }
                    .print-btn:hover { background: #4338ca; }
                    .back-btn {
                        background: white; color: #374151; border: 1px solid #d1d5db;
                        padding: 8px 16px; border-radius: 8px; cursor: pointer;
                        font-size: 14px;
                    }
                    .label-grid {
                        display: grid;
                        grid-template-columns: repeat(4, 62mm);
                        gap: 4mm;
                    }
                }
                @media print {
                    .print-controls { display: none !important; }
                    body { margin: 0; padding: 4mm; background: white; }
                    .label-grid {
                        display: grid;
                        grid-template-columns: repeat(4, 62mm);
                        gap: 2mm;
                    }
                    @page { size: A4; margin: 8mm; }
                }
                .label-card {
                    width: 60mm;
                    border: 1px solid #e5e7eb;
                    border-radius: 4px;
                    padding: 3mm 4mm;
                    background: white;
                    font-family: sans-serif;
                    page-break-inside: avoid;
                    box-sizing: border-box;
                }
                .label-name {
                    font-size: 9pt;
                    font-weight: 700;
                    color: #111827;
                    line-height: 1.3;
                    max-height: 2.6em;
                    overflow: hidden;
                }
                .label-category {
                    font-size: 7pt;
                    color: #6b7280;
                    margin-top: 1mm;
                }
                .label-barcode {
                    width: 100%;
                    height: auto;
                    display: block;
                    margin: 2mm 0 1mm;
                }
                .label-code {
                    font-size: 7pt;
                    font-family: monospace;
                    color: #374151;
                    text-align: center;
                    letter-spacing: 0.5px;
                }
                .label-price {
                    font-size: 11pt;
                    font-weight: 800;
                    color: #1d4ed8;
                    text-align: center;
                    margin-top: 1.5mm;
                    border-top: 1px solid #e5e7eb;
                    padding-top: 1.5mm;
                }
            `}</style>

            <div className="print-controls">
                <button className="print-btn" onClick={() => window.print()}>
                    🖨 Cetak Label
                </button>
                <button className="back-btn" onClick={() => window.history.back()}>
                    ← Kembali
                </button>
                <span style={{ color: '#6b7280', fontSize: 13 }}>
                    {items.length} label · A4 · 4 kolom
                </span>
            </div>

            <div className="label-grid">
                {items.map(item => (
                    <BarcodeLabel key={item.id} item={item} />
                ))}
            </div>
        </>
    );
}
```

- [ ] **Step 2: Add item selection + print button to Items/Index.tsx**

In `resources/js/pages/Items/Index.tsx`:

**a)** Add `selectedIds` state:
```tsx
const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
```

**b)** Add a toggle handler:
```tsx
const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
        const next = new Set(prev);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
    });
};
const toggleAll = () => {
    if (selectedIds.size === items.data.length) {
        setSelectedIds(new Set());
    } else {
        setSelectedIds(new Set(items.data.map(i => i.id)));
    }
};
```

**c)** Add "Print Labels" button in the header area (next to existing buttons):
```tsx
{selectedIds.size > 0 && (
    <a
        href={`/item/print-labels?ids=${[...selectedIds].join(',')}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors"
    >
        <Printer className="w-4 h-4" />
        Print Labels ({selectedIds.size})
    </a>
)}
```

**d)** Add `Printer` to lucide imports.

**e)** Add a `<col>` for the checkbox column (leftmost, `w-8`) in `<colgroup>`.

**f)** Add checkbox header cell (`<th>`) and body cell (`<td>`) for each row:
- Header: `<input type="checkbox" checked={selectedIds.size === items.data.length && items.data.length > 0} onChange={toggleAll} />`
- Body: `<input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggleSelect(item.id)} />`

- [ ] **Step 3: Commit**

```bash
git add resources/js/pages/Items/PrintLabels.tsx resources/js/pages/Items/Index.tsx
git commit -m "feat: add barcode label printing with item selection checkboxes"
```

---

## Chunk 3: Advanced Reporting

### Task 7: ABC Analysis Report

**Files:**
- Modify: `app/Http/Controllers/ReportController.php`
- Create: `resources/js/pages/report/Report_ABC.tsx`
- Modify: `routes/web.php`
- Modify: `resources/js/components/app-sidebar.tsx`

- [ ] **Step 1: Add abcAnalysis() method to ReportController**

```php
public function abcAnalysis(Request $request)
{
    $dateFrom    = $request->get('date_from', now()->startOfYear()->format('Y-m-d'));
    $dateTo      = $request->get('date_to', now()->format('Y-m-d'));
    $warehouseId = $request->get('warehouse_id', '');
    $allowedIds  = $this->allowedWarehouseIds();

    $query = \App\Models\Item::select([
            'items.id',
            'items.kode_item',
            'items.nama',
            'items.kategori',
            'items.harga_beli',
            'items.harga_jual',
            DB::raw('COALESCE(SUM(si.quantity), 0) as total_sold'),
            DB::raw('COALESCE(SUM(si.line_total), 0) as total_revenue'),
            DB::raw('COALESCE(SUM(si.quantity * items.harga_beli), 0) as total_cogs'),
        ])
        ->leftJoin('sale_items as si', function ($join) use ($dateFrom, $dateTo, $allowedIds, $warehouseId) {
            $join->on('si.item_id', '=', 'items.id')
                 ->join('sale_headers as sh', function ($j) use ($dateFrom, $dateTo, $allowedIds, $warehouseId) {
                     $j->on('sh.id', '=', 'si.sale_header_id')
                       ->where('sh.status', 'completed')
                       ->whereBetween('sh.occurred_at', [
                           $dateFrom . ' 00:00:00',
                           $dateTo   . ' 23:59:59',
                       ]);
                     if (!empty($allowedIds)) {
                         $j->whereIn('sh.warehouse_id', $allowedIds);
                     }
                     if ($warehouseId !== '') {
                         $wId = (int) $warehouseId;
                         if (empty($allowedIds) || in_array($wId, $allowedIds)) {
                             $j->where('sh.warehouse_id', $wId);
                         }
                     }
                 });
        })
        ->groupBy('items.id', 'items.kode_item', 'items.nama', 'items.kategori', 'items.harga_beli', 'items.harga_jual')
        ->orderByDesc('total_revenue');

    $items = $query->get();
    $grandTotal = (int) $items->sum('total_revenue');

    $cumulative = 0;
    $result = $items->map(function ($item) use ($grandTotal, &$cumulative) {
        $cumulative += (int) $item->total_revenue;
        $cumulativePct = $grandTotal > 0 ? round($cumulative / $grandTotal * 100, 1) : 0;
        $class = $cumulativePct <= 80 ? 'A' : ($cumulativePct <= 95 ? 'B' : 'C');
        $profit = (int) $item->total_revenue - (int) $item->total_cogs;
        $margin = (int) $item->total_revenue > 0
            ? round($profit / (int) $item->total_revenue * 100, 1)
            : 0;
        return [
            'id'            => $item->id,
            'code'          => $item->kode_item,
            'name'          => $item->nama,
            'category'      => $item->kategori,
            'totalSold'     => (int) $item->total_sold,
            'totalRevenue'  => (int) $item->total_revenue,
            'totalCogs'     => (int) $item->total_cogs,
            'profit'        => $profit,
            'margin'        => $margin,
            'cumulativePct' => $cumulativePct,
            'class'         => $class,
        ];
    })->values()->all();

    $classSummary = [
        'A' => collect($result)->where('class', 'A')->count(),
        'B' => collect($result)->where('class', 'B')->count(),
        'C' => collect($result)->where('class', 'C')->count(),
    ];

    $warehouseQuery = \App\Models\Warehouse::where('is_active', true)->orderBy('name');
    if (!empty($allowedIds)) $warehouseQuery->whereIn('id', $allowedIds);
    $warehouses = $warehouseQuery->get(['id', 'name'])->map(fn($w) => ['id' => $w->id, 'name' => $w->name]);

    return Inertia::render('report/Report_ABC', [
        'items'        => $result,
        'grandTotal'   => $grandTotal,
        'classSummary' => $classSummary,
        'warehouses'   => $warehouses,
        'filters'      => $request->only(['date_from', 'date_to', 'warehouse_id']),
    ]);
}
```

**Note:** SQLite does not support nested JOINs inside a leftJoin closure well. Use a raw subquery approach instead. Replace the leftJoin with:

```php
->leftJoinSub(
    \App\Models\SaleItem::select(
        'sale_items.item_id',
        DB::raw('SUM(sale_items.quantity) as qty'),
        DB::raw('SUM(sale_items.line_total) as rev'),
    )
    ->join('sale_headers', function ($j) use ($dateFrom, $dateTo, $allowedIds, $warehouseId) {
        $j->on('sale_headers.id', '=', 'sale_items.sale_header_id')
          ->where('sale_headers.status', 'completed')
          ->whereBetween('sale_headers.occurred_at', [$dateFrom . ' 00:00:00', $dateTo . ' 23:59:59']);
        if (!empty($allowedIds)) $j->whereIn('sale_headers.warehouse_id', $allowedIds);
        if ($warehouseId !== '') {
            $wId = (int) $warehouseId;
            if (empty($allowedIds) || in_array($wId, $allowedIds)) {
                $j->where('sale_headers.warehouse_id', $wId);
            }
        }
    })
    ->groupBy('sale_items.item_id'),
    'si',
    'si.item_id',
    '=',
    'items.id'
)
```

And update SELECT to use `si.qty` / `si.rev`:

```php
DB::raw('COALESCE(si.qty, 0) as total_sold'),
DB::raw('COALESCE(si.rev, 0) as total_revenue'),
DB::raw('COALESCE(si.qty * items.harga_beli, 0) as total_cogs'),
```

- [ ] **Step 2: Create Report_ABC.tsx**

```tsx
import { useState } from 'react';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Laporan', href: '#' },
    { title: 'Analisis ABC', href: '/report/abc' },
];

interface ABCItem {
    id: number;
    code: string;
    name: string;
    category: string | null;
    totalSold: number;
    totalRevenue: number;
    totalCogs: number;
    profit: number;
    margin: number;
    cumulativePct: number;
    class: 'A' | 'B' | 'C';
}

interface ClassSummary { A: number; B: number; C: number }

interface PageProps {
    items: ABCItem[];
    grandTotal: number;
    classSummary: ClassSummary;
    warehouses: { id: number; name: string }[];
    filters: { date_from?: string; date_to?: string; warehouse_id?: string };
    [key: string]: unknown;
}

function formatRp(n: number) { return 'Rp ' + n.toLocaleString('id-ID'); }

const CLASS_CLS = {
    A: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    B: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    C: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
};

const CLASS_DESC = {
    A: 'Kontributor utama — 80% revenue',
    B: 'Kontributor menengah — 15% revenue',
    C: 'Kontributor kecil — 5% revenue',
};

export default function ReportABC() {
    const { items, grandTotal, classSummary, warehouses, filters } = usePage<PageProps>().props;
    const [dateFrom, setDateFrom] = useState(filters?.date_from ?? new Date().getFullYear() + '-01-01');
    const [dateTo, setDateTo]     = useState(filters?.date_to ?? new Date().toISOString().slice(0, 10));
    const [warehouse, setWarehouse] = useState(filters?.warehouse_id ?? '');
    const [filterClass, setFilterClass] = useState<string>('');

    const navigate = () => {
        router.get('/report/abc', { date_from: dateFrom, date_to: dateTo, warehouse_id: warehouse }, { preserveState: true, replace: true });
    };

    const displayed = filterClass ? items.filter(i => i.class === filterClass) : items;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Analisis ABC" />
            <div className="p-6 space-y-6">
                <div>
                    <h1 className="text-2xl font-bold">Analisis ABC Produk</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        Klasifikasi produk berdasarkan kontribusi terhadap total revenue (Pareto 80/15/5)
                    </p>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap gap-3 items-end">
                    <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">Dari</label>
                        <input type="date" className="border rounded-lg px-3 py-2 text-sm bg-background" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">Sampai</label>
                        <input type="date" className="border rounded-lg px-3 py-2 text-sm bg-background" value={dateTo} onChange={e => setDateTo(e.target.value)} />
                    </div>
                    {warehouses.length > 1 && (
                        <div>
                            <label className="block text-xs font-medium text-muted-foreground mb-1">Gudang</label>
                            <select className="border rounded-lg px-3 py-2 text-sm bg-background" value={warehouse} onChange={e => setWarehouse(e.target.value)}>
                                <option value="">Semua Gudang</option>
                                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                            </select>
                        </div>
                    )}
                    <button onClick={navigate} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium">Terapkan</button>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-3 gap-4">
                    {(['A', 'B', 'C'] as const).map(cls => (
                        <button
                            key={cls}
                            onClick={() => setFilterClass(filterClass === cls ? '' : cls)}
                            className={`rounded-xl border p-4 text-left transition-all ${filterClass === cls ? 'ring-2 ring-primary' : 'hover:shadow-md'}`}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <span className={`inline-flex px-2.5 py-0.5 rounded-full text-sm font-bold ${CLASS_CLS[cls]}`}>Kelas {cls}</span>
                                <span className="text-3xl font-bold tabular-nums">{classSummary[cls]}</span>
                            </div>
                            <div className="text-xs text-muted-foreground">{CLASS_DESC[cls]}</div>
                        </button>
                    ))}
                </div>

                {/* Table */}
                <div className="rounded-xl border bg-card overflow-hidden">
                    <table className="w-full text-sm table-fixed">
                        <colgroup>
                            <col className="w-8" /><col className="w-[6%]" />
                            <col className="w-[28%]" /><col className="w-[12%]" />
                            <col className="w-[10%]" /><col className="w-[14%]" />
                            <col className="w-[14%]" /><col className="w-[8%]" />
                            <col className="w-[8%]" />
                        </colgroup>
                        <thead className="bg-muted/40 border-b">
                            <tr>
                                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide">#</th>
                                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide">Kelas</th>
                                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide">Nama Produk</th>
                                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide">Kategori</th>
                                <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide">Terjual</th>
                                <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide">Revenue</th>
                                <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide">Profit</th>
                                <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide">Margin</th>
                                <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide">Kumulatif</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {displayed.length === 0 && (
                                <tr><td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">Tidak ada data</td></tr>
                            )}
                            {displayed.map((item, i) => (
                                <tr key={item.id} className="hover:bg-muted/20">
                                    <td className="px-3 py-2.5 text-muted-foreground tabular-nums text-xs">{i + 1}</td>
                                    <td className="px-3 py-2.5">
                                        <span className={`inline-flex px-1.5 py-0.5 rounded text-xs font-bold ${CLASS_CLS[item.class]}`}>{item.class}</span>
                                    </td>
                                    <td className="px-3 py-2.5 truncate font-medium" title={item.name}>{item.name}</td>
                                    <td className="px-3 py-2.5 truncate text-muted-foreground text-xs">{item.category ?? '—'}</td>
                                    <td className="px-3 py-2.5 text-right tabular-nums">{item.totalSold.toLocaleString('id-ID')}</td>
                                    <td className="px-3 py-2.5 text-right tabular-nums text-xs">{formatRp(item.totalRevenue)}</td>
                                    <td className={`px-3 py-2.5 text-right tabular-nums text-xs ${item.profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                        {formatRp(item.profit)}
                                    </td>
                                    <td className="px-3 py-2.5 text-right tabular-nums text-xs">{item.margin}%</td>
                                    <td className="px-3 py-2.5 text-right tabular-nums text-xs">{item.cumulativePct}%</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="text-xs text-muted-foreground">
                    Total revenue periode: {formatRp(grandTotal)} · {items.length} produk
                </div>
            </div>
        </AppLayout>
    );
}
```

- [ ] **Step 3: Add routes for ABC + update sidebar**

In `routes/web.php`, add inside auth group:
```php
Route::get('report/abc', [ReportController::class, 'abcAnalysis'])->name('report.abc');
```

In `resources/js/components/app-sidebar.tsx`, add inside the Laporan items array:
```tsx
{ title: 'Analisis ABC', href: '/report/abc' },
```

- [ ] **Step 4: Commit**

```bash
git add app/Http/Controllers/ReportController.php resources/js/pages/report/Report_ABC.tsx routes/web.php resources/js/components/app-sidebar.tsx
git commit -m "feat: add ABC analysis report"
```

---

### Task 8: Peak Hours Heatmap Report

**Files:**
- Modify: `app/Http/Controllers/ReportController.php`
- Create: `resources/js/pages/report/Report_PeakHours.tsx`
- Modify: `routes/web.php`
- Modify: `resources/js/components/app-sidebar.tsx`

- [ ] **Step 1: Add peakHours() method to ReportController**

```php
public function peakHours(Request $request)
{
    $dateFrom    = $request->get('date_from', now()->subDays(29)->format('Y-m-d'));
    $dateTo      = $request->get('date_to', now()->format('Y-m-d'));
    $warehouseId = $request->get('warehouse_id', '');
    $allowedIds  = $this->allowedWarehouseIds();

    $query = SaleHeader::select([
        DB::raw("CAST(strftime('%H', occurred_at) AS INTEGER) as hour"),
        DB::raw("CAST(strftime('%w', occurred_at) AS INTEGER) as day_of_week"),
        DB::raw('COUNT(*) as trx_count'),
        DB::raw('SUM(grand_total) as revenue'),
    ])
    ->where('status', 'completed')
    ->whereBetween('occurred_at', [$dateFrom . ' 00:00:00', $dateTo . ' 23:59:59'])
    ->groupBy('hour', 'day_of_week')
    ->orderBy('hour')
    ->orderBy('day_of_week');

    if (!empty($allowedIds)) {
        $query->whereIn('warehouse_id', $allowedIds);
    }
    if ($warehouseId !== '') {
        $wId = (int) $warehouseId;
        if (empty($allowedIds) || in_array($wId, $allowedIds)) {
            $query->where('warehouse_id', $wId);
        }
    }

    $rows = $query->get();

    // Build 24x7 matrix (hour x day_of_week)
    // day_of_week: 0=Sun,1=Mon,...,6=Sat
    $matrix = [];
    for ($h = 0; $h < 24; $h++) {
        for ($d = 0; $d < 7; $d++) {
            $matrix[$h][$d] = ['count' => 0, 'revenue' => 0];
        }
    }
    foreach ($rows as $row) {
        $matrix[(int)$row->hour][(int)$row->day_of_week] = [
            'count'   => (int) $row->trx_count,
            'revenue' => (int) $row->revenue,
        ];
    }

    // Flatten for frontend
    $cells = [];
    for ($h = 0; $h < 24; $h++) {
        for ($d = 0; $d < 7; $d++) {
            $cells[] = [
                'hour'    => $h,
                'day'     => $d,
                'count'   => $matrix[$h][$d]['count'],
                'revenue' => $matrix[$h][$d]['revenue'],
            ];
        }
    }

    $maxCount = max(1, collect($cells)->max('count'));

    $warehouseQuery = \App\Models\Warehouse::where('is_active', true)->orderBy('name');
    if (!empty($allowedIds)) $warehouseQuery->whereIn('id', $allowedIds);
    $warehouses = $warehouseQuery->get(['id', 'name'])->map(fn($w) => ['id' => $w->id, 'name' => $w->name]);

    return Inertia::render('report/Report_PeakHours', [
        'cells'      => $cells,
        'maxCount'   => $maxCount,
        'warehouses' => $warehouses,
        'filters'    => $request->only(['date_from', 'date_to', 'warehouse_id']),
    ]);
}
```

- [ ] **Step 2: Create Report_PeakHours.tsx**

```tsx
import { useState } from 'react';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Laporan', href: '#' },
    { title: 'Jam Ramai', href: '/report/peak-hours' },
];

interface Cell {
    hour: number;
    day: number;  // 0=Sun,...,6=Sat
    count: number;
    revenue: number;
}

interface PageProps {
    cells: Cell[];
    maxCount: number;
    warehouses: { id: number; name: string }[];
    filters: { date_from?: string; date_to?: string; warehouse_id?: string };
    [key: string]: unknown;
}

const DAY_LABELS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const DAYS = [1, 2, 3, 4, 5, 6, 0]; // Mon-Sun order for display

function formatRp(n: number) { return 'Rp ' + n.toLocaleString('id-ID'); }
function padHour(h: number) { return String(h).padStart(2, '0') + ':00'; }

function heatColor(count: number, max: number): string {
    if (count === 0) return 'bg-slate-100 dark:bg-slate-800';
    const intensity = count / max;
    if (intensity < 0.2) return 'bg-indigo-100 dark:bg-indigo-900/30';
    if (intensity < 0.4) return 'bg-indigo-200 dark:bg-indigo-800/50';
    if (intensity < 0.6) return 'bg-indigo-400 dark:bg-indigo-700';
    if (intensity < 0.8) return 'bg-indigo-600 text-white dark:bg-indigo-500';
    return 'bg-indigo-800 text-white dark:bg-indigo-400 dark:text-slate-900';
}

export default function ReportPeakHours() {
    const { cells, maxCount, warehouses, filters } = usePage<PageProps>().props;
    const [dateFrom, setDateFrom] = useState(filters?.date_from ?? '');
    const [dateTo, setDateTo]     = useState(filters?.date_to ?? '');
    const [warehouse, setWarehouse] = useState(filters?.warehouse_id ?? '');
    const [tooltip, setTooltip]   = useState<Cell | null>(null);

    const navigate = () => {
        router.get('/report/peak-hours', { date_from: dateFrom, date_to: dateTo, warehouse_id: warehouse }, { preserveState: true, replace: true });
    };

    // Build cell lookup: cells[hour][day]
    const cellMap: Record<number, Record<number, Cell>> = {};
    for (const c of cells) {
        if (!cellMap[c.hour]) cellMap[c.hour] = {};
        cellMap[c.hour][c.day] = c;
    }

    const totalTrx     = cells.reduce((s, c) => s + c.count, 0);
    const totalRevenue = cells.reduce((s, c) => s + c.revenue, 0);
    const peakCell     = cells.reduce((best, c) => c.count > best.count ? c : best, cells[0] ?? { hour: 0, day: 0, count: 0, revenue: 0 });

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Jam Ramai" />
            <div className="p-6 space-y-6">
                <div>
                    <h1 className="text-2xl font-bold">Analisis Jam Ramai</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        Heatmap transaksi per jam dan hari — temukan waktu tersibuk tokomu
                    </p>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap gap-3 items-end">
                    <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">Dari</label>
                        <input type="date" className="border rounded-lg px-3 py-2 text-sm bg-background" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">Sampai</label>
                        <input type="date" className="border rounded-lg px-3 py-2 text-sm bg-background" value={dateTo} onChange={e => setDateTo(e.target.value)} />
                    </div>
                    {warehouses.length > 1 && (
                        <div>
                            <label className="block text-xs font-medium text-muted-foreground mb-1">Gudang</label>
                            <select className="border rounded-lg px-3 py-2 text-sm bg-background" value={warehouse} onChange={e => setWarehouse(e.target.value)}>
                                <option value="">Semua Gudang</option>
                                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                            </select>
                        </div>
                    )}
                    <button onClick={navigate} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium">Terapkan</button>
                </div>

                {/* Summary */}
                <div className="grid grid-cols-3 gap-4">
                    <div className="rounded-xl border bg-card p-4">
                        <div className="text-2xl font-bold tabular-nums">{totalTrx.toLocaleString('id-ID')}</div>
                        <div className="text-sm text-muted-foreground">Total Transaksi</div>
                    </div>
                    <div className="rounded-xl border bg-card p-4">
                        <div className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                            {peakCell.count > 0 ? `${DAY_LABELS[peakCell.day]} ${padHour(peakCell.hour)}` : '—'}
                        </div>
                        <div className="text-sm text-muted-foreground">Jam Tersibuk ({peakCell.count} trx)</div>
                    </div>
                    <div className="rounded-xl border bg-card p-4">
                        <div className="text-lg font-bold tabular-nums">{formatRp(totalRevenue)}</div>
                        <div className="text-sm text-muted-foreground">Total Revenue</div>
                    </div>
                </div>

                {/* Heatmap */}
                <div className="rounded-xl border bg-card p-4 overflow-x-auto">
                    <div className="min-w-[640px]">
                        {/* Day header */}
                        <div className="flex gap-1 mb-1 pl-12">
                            {DAYS.map(d => (
                                <div key={d} className="flex-1 text-center text-xs font-semibold text-muted-foreground py-1">
                                    {DAY_LABELS[d]}
                                </div>
                            ))}
                        </div>

                        {/* Hour rows */}
                        {Array.from({ length: 24 }, (_, h) => (
                            <div key={h} className="flex gap-1 mb-1 items-center">
                                <div className="w-10 text-right text-xs text-muted-foreground pr-2 shrink-0">
                                    {padHour(h)}
                                </div>
                                {DAYS.map(d => {
                                    const cell = cellMap[h]?.[d] ?? { hour: h, day: d, count: 0, revenue: 0 };
                                    return (
                                        <div
                                            key={d}
                                            className={`flex-1 h-7 rounded text-xs flex items-center justify-center cursor-default transition-all ${heatColor(cell.count, maxCount)}`}
                                            title={`${DAY_LABELS[d]} ${padHour(h)}: ${cell.count} trx · ${formatRp(cell.revenue)}`}
                                            onMouseEnter={() => setTooltip(cell)}
                                            onMouseLeave={() => setTooltip(null)}
                                        >
                                            {cell.count > 0 ? cell.count : ''}
                                        </div>
                                    );
                                })}
                            </div>
                        ))}

                        {/* Legend */}
                        <div className="flex items-center gap-2 mt-3 pl-12">
                            <span className="text-xs text-muted-foreground">Sedikit</span>
                            {[0, 0.2, 0.4, 0.6, 0.8].map(pct => (
                                <div key={pct} className={`w-6 h-4 rounded ${heatColor(Math.round(pct * maxCount), maxCount)}`} />
                            ))}
                            <span className="text-xs text-muted-foreground">Banyak</span>
                        </div>
                    </div>
                </div>

                {tooltip && tooltip.count > 0 && (
                    <div className="text-sm text-muted-foreground">
                        <strong>{DAY_LABELS[tooltip.day]} {padHour(tooltip.hour)}</strong>:&nbsp;
                        {tooltip.count} transaksi · {formatRp(tooltip.revenue)}
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
```

- [ ] **Step 3: Add route + sidebar**

In `routes/web.php`:
```php
Route::get('report/peak-hours', [ReportController::class, 'peakHours'])->name('report.peak_hours');
```

In `resources/js/components/app-sidebar.tsx`, inside Laporan items:
```tsx
{ title: 'Jam Ramai',    href: '/report/peak-hours' },
```

- [ ] **Step 4: Commit**

```bash
git add app/Http/Controllers/ReportController.php resources/js/pages/report/Report_PeakHours.tsx routes/web.php resources/js/components/app-sidebar.tsx
git commit -m "feat: add peak hours heatmap report"
```

---

## Final Verification

- [ ] Visit `/inventory/opname` — verify list page loads, "Mulai Opname" opens modal
- [ ] Start an opname for a warehouse — verify detail page loads with all items pre-filled with system qty
- [ ] Enter actual counts, click Save, then Submit — verify StockAdjustment records created, stok updated
- [ ] Visit `/item` — verify checkboxes appear on item rows, "Print Labels" button appears when selected
- [ ] Click Print Labels — verify new tab opens with label grid + barcodes rendered
- [ ] Visit `/report/abc` — verify items ranked by revenue with A/B/C classification
- [ ] Visit `/report/peak-hours` — verify heatmap grid renders with color intensity
- [ ] Toggle dark mode — verify all pages look correct in both modes

```bash
npm run types
npm run lint
```
