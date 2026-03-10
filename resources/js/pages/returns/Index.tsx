import { useEffect, useState } from 'react';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import { Search, Plus, Eye, XCircle, Trash2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
    DialogDescription, DialogFooter, DialogClose,
} from '@/components/ui/dialog';
import Pagination, { type PaginationMeta } from '@/components/Pagination';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Retur Barang', href: '/returns' },
];

interface ReturnRow {
    id: number;
    returnNumber: string;
    type: string;
    partyName: string;
    warehouseName: string;
    processedBy: string;
    occurredAt: string | null;
    status: string;
    totalAmount: number;
    reason: string | null;
    itemCount: number;
}

interface ItemOption     { id: number; name: string; code: string; price: number; }
interface CustomerOption { id: number; name: string; }
interface SupplierOption { id: number; name: string; }
interface WarehouseOption{ id: number; name: string; }

interface PaginatedReturns {
    data: ReturnRow[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
}

interface Filters {
    search?: string;
    type?: string;
    status?: string;
    date_from?: string;
    date_to?: string;
    sort_by?: string;
    sort_dir?: string;
    per_page?: string | number;
}

interface PageProps {
    returns: PaginatedReturns;
    warehouses: WarehouseOption[];
    customers: CustomerOption[];
    suppliers: SupplierOption[];
    items: ItemOption[];
    filters: Filters;
    [key: string]: unknown;
}

interface CartLine { itemId: number; name: string; qty: number; unitPrice: number; condition: string; }

const TYPE_CONFIG: Record<string, { label: string; cls: string }> = {
    customer_return: { label: 'Retur Pelanggan', cls: 'bg-blue-100 text-blue-700' },
    supplier_return: { label: 'Retur Supplier',  cls: 'bg-orange-100 text-orange-700' },
};

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
    completed: { label: 'Selesai', cls: 'bg-emerald-100 text-emerald-700' },
    void:      { label: 'Dibatalkan', cls: 'bg-red-100 text-red-600' },
};

const CONDITION_LABELS: Record<string, string> = {
    good:      'Baik',
    damaged:   'Rusak',
    defective: 'Cacat',
};

function formatRp(n: number) { return 'Rp ' + n.toLocaleString('id-ID'); }
function formatDate(iso: string | null) {
    if (!iso) return '-';
    return new Date(iso).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function ReturnsIndex() {
    const { returns, warehouses, customers, suppliers, items, filters } = usePage<PageProps>().props;

    const [search, setSearch]     = useState(filters.search ?? '');
    const [type, setType]         = useState(filters.type ?? '');
    const [status, setStatus]     = useState(filters.status ?? '');
    const [dateFrom, setDateFrom] = useState(filters.date_from ?? '');
    const [dateTo, setDateTo]     = useState(filters.date_to ?? '');
    const [sortBy, setSortBy]     = useState(filters.sort_by ?? 'date');
    const [sortDir, setSortDir]   = useState(filters.sort_dir ?? 'desc');
    const [perPage, setPerPage]   = useState(String(filters.per_page ?? '20'));

    const [showCreate, setShowCreate] = useState(false);
    const [form, setForm] = useState({
        type: 'customer_return', warehouse_id: '', customer_id: '',
        supplier_id: '', occurred_at: '', reason: '', note: '',
    });
    const [lines, setLines]           = useState<CartLine[]>([]);
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});
    const [submitting, setSubmitting] = useState(false);

    const [voidTarget, setVoidTarget] = useState<ReturnRow | null>(null);
    const [voiding, setVoiding]       = useState(false);

    useEffect(() => {
        setSearch(filters.search ?? '');
        setType(filters.type ?? '');
        setStatus(filters.status ?? '');
        setSortBy(filters.sort_by ?? 'date');
        setSortDir(filters.sort_dir ?? 'desc');
        setPerPage(String(filters.per_page ?? '20'));
    }, [filters]);

    const navigate = (overrides: Partial<Filters & { page?: number }> = {}) => {
        router.get(route('returns.index'), {
            search, type, status, date_from: dateFrom, date_to: dateTo,
            sort_by: sortBy, sort_dir: sortDir, per_page: perPage, ...overrides,
        }, { preserveState: true, replace: true });
    };

    const handleSearch = (e: React.FormEvent) => { e.preventDefault(); navigate({ page: 1 }); };
    const handlePage   = (page: number) => navigate({ page });

    const handleSort = (col: string) => {
        const newDir = col === sortBy && sortDir === 'asc' ? 'desc' : 'asc';
        setSortBy(col); setSortDir(newDir);
        navigate({ sort_by: col, sort_dir: newDir, page: 1 });
    };

    const SortIcon = ({ col }: { col: string }) =>
        col !== sortBy ? <span className="opacity-30 ml-1">↕</span> : <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>;

    const addLine = () => setLines(l => [...l, { itemId: 0, name: '', qty: 1, unitPrice: 0, condition: 'good' }]);

    const updateLine = (idx: number, field: keyof CartLine, value: string | number) => {
        setLines(l => l.map((line, i) => {
            if (i !== idx) return line;
            if (field === 'itemId') {
                const item = items.find(it => it.id === Number(value));
                return { ...line, itemId: Number(value), name: item?.name ?? '', unitPrice: item?.price ?? 0 };
            }
            return { ...line, [field]: value };
        }));
    };

    const removeLine = (idx: number) => setLines(l => l.filter((_, i) => i !== idx));

    const lineTotal = lines.reduce((sum, l) => sum + l.qty * l.unitPrice, 0);

    const resetCreate = () => {
        setLines([]);
        setForm({ type: 'customer_return', warehouse_id: '', customer_id: '', supplier_id: '', occurred_at: '', reason: '', note: '' });
        setFormErrors({});
    };

    const handleCreate = (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        setFormErrors({});
        router.post(route('returns.store'), {
            type:         form.type,
            warehouse_id: form.warehouse_id,
            customer_id:  form.type === 'customer_return' ? (form.customer_id || null) : null,
            supplier_id:  form.type === 'supplier_return' ? (form.supplier_id || null) : null,
            occurred_at:  form.occurred_at,
            reason:       form.reason || null,
            note:         form.note || null,
            items: lines.map(l => ({ item_id: l.itemId, quantity: l.qty, unit_price: l.unitPrice, condition: l.condition })),
        }, {
            onSuccess: () => { setShowCreate(false); resetCreate(); setSubmitting(false); },
            onError:   (errs) => { setFormErrors(errs); setSubmitting(false); },
        });
    };

    const handleVoid = () => {
        if (!voidTarget) return;
        setVoiding(true);
        router.post(route('returns.void', { returnHeader: voidTarget.id }), {}, {
            onSuccess: () => { setVoidTarget(null); setVoiding(false); },
            onError:   () => setVoiding(false),
        });
    };

    const meta: PaginationMeta = {
        current_page: returns.current_page, last_page: returns.last_page,
        per_page: returns.per_page, total: returns.total, from: returns.from, to: returns.to,
    };

    const inputCls = (field: string) =>
        `w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary ${formErrors[field] ? 'border-red-400' : 'border-border'}`;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Retur Barang" />
            <div className="p-4 md:p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                        <h1 className="text-xl font-semibold">Retur Barang</h1>
                        <p className="text-sm text-muted-foreground mt-0.5">Kelola retur dari pelanggan dan ke supplier</p>
                    </div>
                    <Button size="sm" onClick={() => { resetCreate(); setShowCreate(true); }}>
                        <Plus size={15} className="mr-1" /> Buat Retur
                    </Button>
                </div>

                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-2 flex-wrap">
                    <form onSubmit={handleSearch} className="flex gap-2 flex-1 min-w-[200px]">
                        <div className="relative flex-1">
                            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <input type="text" placeholder="Cari no. retur, pelanggan, supplier…"
                                className="pl-8 pr-3 py-2 text-sm border border-border rounded w-full focus:outline-none focus:ring-2 focus:ring-primary"
                                value={search} onChange={e => setSearch(e.target.value)} />
                        </div>
                        <Button type="submit" size="sm" variant="outline">Cari</Button>
                    </form>
                    <select className="text-sm border border-border rounded px-2 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                        value={type} onChange={e => { setType(e.target.value); navigate({ type: e.target.value, page: 1 }); }}>
                        <option value="">Semua Tipe</option>
                        <option value="customer_return">Retur Pelanggan</option>
                        <option value="supplier_return">Retur Supplier</option>
                    </select>
                    <select className="text-sm border border-border rounded px-2 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                        value={status} onChange={e => { setStatus(e.target.value); navigate({ status: e.target.value, page: 1 }); }}>
                        <option value="">Semua Status</option>
                        <option value="completed">Selesai</option>
                        <option value="void">Dibatalkan</option>
                    </select>
                    <div className="flex gap-2">
                        <input type="date" className="text-sm border border-border rounded px-2 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                            value={dateFrom} onChange={e => { setDateFrom(e.target.value); navigate({ date_from: e.target.value, page: 1 }); }} />
                        <input type="date" className="text-sm border border-border rounded px-2 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                            value={dateTo} onChange={e => { setDateTo(e.target.value); navigate({ date_to: e.target.value, page: 1 }); }} />
                    </div>
                    <select className="text-sm border border-border rounded px-2 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                        value={perPage} onChange={e => { setPerPage(e.target.value); navigate({ per_page: e.target.value, page: 1 }); }}>
                        {['10','20','50','100'].map(n => <option key={n} value={n}>{n} / hal</option>)}
                    </select>
                </div>

                {/* Table */}
                <div className="rounded-lg border overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-muted/50 border-b">
                            <tr>
                                <th className="text-left px-4 py-3 font-medium cursor-pointer select-none" onClick={() => handleSort('returnNumber')}>
                                    No. Retur <SortIcon col="returnNumber" />
                                </th>
                                <th className="text-left px-4 py-3 font-medium cursor-pointer select-none" onClick={() => handleSort('type')}>
                                    Tipe <SortIcon col="type" />
                                </th>
                                <th className="text-left px-4 py-3 font-medium">Pelanggan / Supplier</th>
                                <th className="text-left px-4 py-3 font-medium">Gudang</th>
                                <th className="text-left px-4 py-3 font-medium cursor-pointer select-none" onClick={() => handleSort('date')}>
                                    Tanggal <SortIcon col="date" />
                                </th>
                                <th className="text-right px-4 py-3 font-medium cursor-pointer select-none" onClick={() => handleSort('totalAmount')}>
                                    Total <SortIcon col="totalAmount" />
                                </th>
                                <th className="text-left px-4 py-3 font-medium cursor-pointer select-none" onClick={() => handleSort('status')}>
                                    Status <SortIcon col="status" />
                                </th>
                                <th className="text-right px-4 py-3 font-medium">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {returns.data.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="py-16 text-center">
                                        <div className="flex flex-col items-center gap-3 text-muted-foreground">
                                            <RotateCcw className="h-10 w-10 opacity-40" />
                                            <div>
                                                <p className="font-medium text-foreground">Belum ada retur</p>
                                                <p className="text-sm mt-1">Buat retur untuk mengembalikan barang dari pelanggan atau ke supplier.</p>
                                            </div>
                                            <button
                                                onClick={() => { resetCreate(); setShowCreate(true); }}
                                                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition"
                                            >
                                                <Plus size={15} /> Buat Retur
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ) : returns.data.map(r => {
                                const tc = TYPE_CONFIG[r.type]   ?? { label: r.type,   cls: 'bg-slate-100 text-slate-600' };
                                const sc = STATUS_CONFIG[r.status] ?? { label: r.status, cls: 'bg-slate-100 text-slate-600' };
                                return (
                                    <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                                        <td className="px-4 py-3"><span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{r.returnNumber}</span></td>
                                        <td className="px-4 py-3"><span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${tc.cls}`}>{tc.label}</span></td>
                                        <td className="px-4 py-3">{r.partyName}</td>
                                        <td className="px-4 py-3 text-muted-foreground text-xs">{r.warehouseName}</td>
                                        <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(r.occurredAt)}</td>
                                        <td className="px-4 py-3 text-right font-medium">{formatRp(r.totalAmount)}</td>
                                        <td className="px-4 py-3"><span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${sc.cls}`}>{sc.label}</span></td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center justify-end gap-1">
                                                <button className="p-1.5 rounded hover:bg-sky-100 text-sky-600" title="Detail"
                                                    onClick={() => router.visit(route('returns.show', { returnHeader: r.id }))}><Eye size={15} /></button>
                                                {r.status === 'completed' && (
                                                    <button className="p-1.5 rounded hover:bg-red-100 text-red-600" title="Void"
                                                        onClick={() => setVoidTarget(r)}><XCircle size={15} /></button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                <Pagination meta={meta} onPageChange={handlePage}
                    summary={<span>Total: <span className="font-medium text-foreground">{returns.total}</span> retur</span>} />
            </div>

            {/* Create Dialog */}
            <Dialog open={showCreate} onOpenChange={open => { if (!open) { setShowCreate(false); resetCreate(); } }}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Buat Retur Baru</DialogTitle>
                        <DialogDescription>Catat pengembalian barang dari pelanggan atau ke supplier</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleCreate} className="space-y-4 mt-2">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-sm font-medium mb-1">Tipe Retur <span className="text-red-500">*</span></label>
                                <select className={inputCls('type')} value={form.type}
                                    onChange={e => setForm(f => ({ ...f, type: e.target.value, customer_id: '', supplier_id: '' }))}>
                                    <option value="customer_return">Retur dari Pelanggan</option>
                                    <option value="supplier_return">Retur ke Supplier</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Gudang <span className="text-red-500">*</span></label>
                                <select className={inputCls('warehouse_id')} value={form.warehouse_id}
                                    onChange={e => setForm(f => ({ ...f, warehouse_id: e.target.value }))}>
                                    <option value="">— Pilih Gudang —</option>
                                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                </select>
                                {formErrors.warehouse_id && <p className="text-red-500 text-xs mt-1">{formErrors.warehouse_id}</p>}
                            </div>
                            {form.type === 'customer_return' ? (
                                <div>
                                    <label className="block text-sm font-medium mb-1">Pelanggan</label>
                                    <select className={inputCls('customer_id')} value={form.customer_id}
                                        onChange={e => setForm(f => ({ ...f, customer_id: e.target.value }))}>
                                        <option value="">— Walk-in —</option>
                                        {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                            ) : (
                                <div>
                                    <label className="block text-sm font-medium mb-1">Supplier</label>
                                    <select className={inputCls('supplier_id')} value={form.supplier_id}
                                        onChange={e => setForm(f => ({ ...f, supplier_id: e.target.value }))}>
                                        <option value="">— Pilih Supplier —</option>
                                        {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                </div>
                            )}
                            <div>
                                <label className="block text-sm font-medium mb-1">Tanggal <span className="text-red-500">*</span></label>
                                <input type="date" className={inputCls('occurred_at')} value={form.occurred_at}
                                    onChange={e => setForm(f => ({ ...f, occurred_at: e.target.value }))} />
                                {formErrors.occurred_at && <p className="text-red-500 text-xs mt-1">{formErrors.occurred_at}</p>}
                            </div>
                            <div className="col-span-2">
                                <label className="block text-sm font-medium mb-1">Alasan Retur</label>
                                <input type="text" className={inputCls('reason')} value={form.reason}
                                    onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} placeholder="Opsional…" />
                            </div>
                            <div className="col-span-2">
                                <label className="block text-sm font-medium mb-1">Catatan</label>
                                <input type="text" className={inputCls('note')} value={form.note}
                                    onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder="Opsional…" />
                            </div>
                        </div>

                        {/* Line items */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-sm font-medium">Item <span className="text-red-500">*</span></label>
                                <Button type="button" size="sm" variant="outline" onClick={addLine}><Plus size={13} className="mr-1" /> Tambah Item</Button>
                            </div>
                            {formErrors.items && <p className="text-red-500 text-xs mb-2">{formErrors.items}</p>}
                            <div className="space-y-2">
                                {lines.map((line, idx) => (
                                    <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                                        <div className="col-span-4">
                                            <select className="w-full border border-border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                                                value={line.itemId} onChange={e => updateLine(idx, 'itemId', e.target.value)}>
                                                <option value="">— Pilih Item —</option>
                                                {items.map(it => <option key={it.id} value={it.id}>{it.name}</option>)}
                                            </select>
                                        </div>
                                        <div className="col-span-2">
                                            <input type="number" min={1} placeholder="Qty"
                                                className="w-full border border-border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                                                value={line.qty} onChange={e => updateLine(idx, 'qty', parseInt(e.target.value) || 1)} />
                                        </div>
                                        <div className="col-span-3">
                                            <input type="number" min={0} placeholder="Harga"
                                                className="w-full border border-border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                                                value={line.unitPrice} onChange={e => updateLine(idx, 'unitPrice', parseInt(e.target.value) || 0)} />
                                        </div>
                                        <div className="col-span-2">
                                            <select className="w-full border border-border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                                                value={line.condition} onChange={e => updateLine(idx, 'condition', e.target.value)}>
                                                <option value="good">Baik</option>
                                                <option value="damaged">Rusak</option>
                                                <option value="defective">Cacat</option>
                                            </select>
                                        </div>
                                        <div className="col-span-1 flex justify-center">
                                            <button type="button" className="text-muted-foreground hover:text-destructive" onClick={() => removeLine(idx)}>
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                {lines.length === 0 && (
                                    <div className="text-center py-4 text-sm text-muted-foreground border border-dashed rounded-lg">
                                        Klik "Tambah Item" untuk menambah item
                                    </div>
                                )}
                            </div>
                            {lines.length > 0 && (
                                <div className="mt-3 text-right text-sm font-semibold">
                                    Total: {formatRp(lineTotal)}
                                </div>
                            )}
                        </div>

                        <DialogFooter className="pt-2">
                            <DialogClose asChild><Button type="button" variant="outline" disabled={submitting}>Batal</Button></DialogClose>
                            <Button type="submit" disabled={submitting || lines.length === 0}>
                                {submitting ? 'Menyimpan…' : 'Simpan Retur'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Void Confirm */}
            <Dialog open={!!voidTarget} onOpenChange={open => { if (!open) setVoidTarget(null); }}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Void Retur</DialogTitle>
                        <DialogDescription>
                            Yakin void retur <span className="font-semibold text-foreground">{voidTarget?.returnNumber}</span>?
                            Stok akan dikembalikan ke kondisi sebelum retur.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="mt-2">
                        <DialogClose asChild><Button variant="outline" disabled={voiding}>Batal</Button></DialogClose>
                        <Button variant="destructive" disabled={voiding} onClick={handleVoid}>{voiding ? 'Memproses…' : 'Ya, Void'}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
