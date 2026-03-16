import { useState } from 'react';
import AppLayout from '@/layouts/app-layout';
import { Head, router, useForm, usePage } from '@inertiajs/react';
import { type BreadcrumbItem } from '@/types';
import { Plus, Pencil, Trash2, X } from 'lucide-react';
import { DatePickerInput, DatePickerFilter } from '@/components/DatePickerInput';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Pengeluaran', href: '/expenses' },
];

interface Expense {
    id: number;
    occurredAt: string;
    category: string;
    amount: number;
    description: string | null;
    warehouseName: string;
    creatorName: string;
}

interface Summary { category: string; total: number }
interface Warehouse { id: number; name: string }

interface PageProps {
    expenses: { data: Expense[]; current_page: number; last_page: number; total: number; from: number | null; to: number | null };
    summary: Summary[];
    totalAmount: number;
    categories: string[];
    warehouses: Warehouse[];
    filters: { date_from?: string; date_to?: string; category?: string; warehouse_id?: string };
    [key: string]: unknown;
}

const CATEGORY_LABELS: Record<string, string> = {
    'Gaji': 'Gaji & Upah',
    'Sewa': 'Sewa Tempat',
    'Utilitas': 'Listrik & Air',
    'Transportasi': 'Transportasi',
    'Pemasaran': 'Pemasaran',
    'Perlengkapan': 'Perlengkapan',
    'Pemeliharaan': 'Pemeliharaan',
    'Lain-lain': 'Lain-lain',
};

function fmt(n: number) { return 'Rp ' + n.toLocaleString('id-ID'); }

export default function ExpensesIndex() {
    const { expenses, summary, totalAmount, categories, warehouses, filters } = usePage<PageProps>().props;

    const [dateFrom, setDateFrom] = useState(filters.date_from ?? new Date().toISOString().slice(0, 7) + '-01');
    const [dateTo,   setDateTo]   = useState(filters.date_to   ?? new Date().toISOString().slice(0, 10));
    const [catFilter, setCatFilter] = useState(filters.category ?? '');
    const [whFilter,  setWhFilter]  = useState(filters.warehouse_id ?? '');

    const [showForm, setShowForm] = useState(false);
    const [editItem, setEditItem] = useState<Expense | null>(null);

    const form = useForm({
        occurred_at:  new Date().toISOString().slice(0, 10),
        category:     categories[0] ?? '',
        amount:       '' as unknown as number,
        description:  '',
        warehouse_id: '' as unknown as number | null,
    });

    function applyFilters() {
        router.get('/expenses', { date_from: dateFrom, date_to: dateTo, category: catFilter, warehouse_id: whFilter }, { preserveState: true });
    }

    function openAdd() {
        form.reset();
        form.setData('occurred_at', new Date().toISOString().slice(0, 10));
        form.setData('category', categories[0] ?? '');
        setEditItem(null);
        setShowForm(true);
    }

    function openEdit(e: Expense) {
        form.setData({
            occurred_at:  e.occurredAt,
            category:     e.category,
            amount:       e.amount,
            description:  e.description ?? '',
            warehouse_id: null,
        });
        setEditItem(e);
        setShowForm(true);
    }

    function submitForm(ev: React.FormEvent) {
        ev.preventDefault();
        if (editItem) {
            form.put(route('expenses.update', editItem.id), {
                onSuccess: () => { setShowForm(false); setEditItem(null); },
            });
        } else {
            form.post(route('expenses.store'), {
                onSuccess: () => { setShowForm(false); form.reset(); },
            });
        }
    }

    function handleDelete(id: number) {
        if (!confirm('Hapus pengeluaran ini?')) return;
        router.delete(route('expenses.destroy', id), { preserveState: true });
    }

    function goToPage(page: number) {
        router.get('/expenses', { date_from: filters.date_from, date_to: filters.date_to, category: filters.category, warehouse_id: filters.warehouse_id, page }, { preserveState: true });
    }

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Pengeluaran" />
            <div className="p-6 space-y-6 max-w-5xl">

                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold">Pengeluaran</h1>
                        <p className="text-sm text-muted-foreground mt-0.5">Catat biaya operasional untuk laporan laba bersih</p>
                    </div>
                    <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
                        <Plus className="h-4 w-4" /> Tambah
                    </button>
                </div>

                {/* Summary cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="rounded-xl border bg-card p-4 shadow-sm col-span-2 sm:col-span-1">
                        <p className="text-xs text-muted-foreground">Total Periode</p>
                        <p className="text-xl font-bold text-rose-600 dark:text-rose-400 mt-0.5">{fmt(totalAmount)}</p>
                    </div>
                    {summary.slice(0, 3).map(s => (
                        <div key={s.category} className="rounded-xl border bg-card p-4 shadow-sm">
                            <p className="text-xs text-muted-foreground truncate">{CATEGORY_LABELS[s.category] ?? s.category}</p>
                            <p className="text-base font-bold mt-0.5">{fmt(s.total)}</p>
                        </div>
                    ))}
                </div>

                {/* Filters */}
                <div className="flex flex-wrap gap-3 items-end">
                    <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">Dari</label>
                        <DatePickerFilter value={dateFrom} onChange={v => setDateFrom(v)} />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">Sampai</label>
                        <DatePickerFilter value={dateTo} onChange={v => setDateTo(v)} />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">Kategori</label>
                        <select value={catFilter} onChange={e => setCatFilter(e.target.value)} className="border rounded-lg px-3 py-2 text-sm bg-background h-9">
                            <option value="">Semua</option>
                            {categories.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c] ?? c}</option>)}
                        </select>
                    </div>
                    {warehouses.length > 1 && (
                        <div>
                            <label className="block text-xs font-medium text-muted-foreground mb-1">Outlet</label>
                            <select value={whFilter} onChange={e => setWhFilter(e.target.value)} className="border rounded-lg px-3 py-2 text-sm bg-background h-9">
                                <option value="">Semua</option>
                                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                            </select>
                        </div>
                    )}
                    <button onClick={applyFilters} className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
                        Tampilkan
                    </button>
                </div>

                {/* Add / Edit form inline */}
                {showForm && (
                    <div className="rounded-xl border bg-card shadow-sm p-5">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="font-semibold text-sm">{editItem ? 'Edit Pengeluaran' : 'Tambah Pengeluaran'}</h2>
                            <button onClick={() => { setShowForm(false); setEditItem(null); }} className="text-muted-foreground hover:text-foreground">
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <form onSubmit={submitForm} className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs font-medium mb-1">Tanggal</label>
                                <DatePickerInput value={form.data.occurred_at} onChange={v => form.setData('occurred_at', v)} />
                                {form.errors.occurred_at && <p className="text-xs text-destructive mt-1">{form.errors.occurred_at}</p>}
                            </div>
                            <div>
                                <label className="block text-xs font-medium mb-1">Kategori</label>
                                <select value={form.data.category} onChange={e => form.setData('category', e.target.value)}
                                    className="w-full border rounded-lg px-3 py-2 text-sm bg-background" required>
                                    {categories.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c] ?? c}</option>)}
                                </select>
                                {form.errors.category && <p className="text-xs text-destructive mt-1">{form.errors.category}</p>}
                            </div>
                            <div>
                                <label className="block text-xs font-medium mb-1">Jumlah (Rp)</label>
                                <input type="number" min={1} value={form.data.amount || ''} onChange={e => form.setData('amount', parseInt(e.target.value) || 0)}
                                    placeholder="0" className="w-full border rounded-lg px-3 py-2 text-sm bg-background" required />
                                {form.errors.amount && <p className="text-xs text-destructive mt-1">{form.errors.amount}</p>}
                            </div>
                            <div className="sm:col-span-2">
                                <label className="block text-xs font-medium mb-1">Keterangan</label>
                                <input type="text" value={form.data.description} onChange={e => form.setData('description', e.target.value)}
                                    placeholder="Opsional..." className="w-full border rounded-lg px-3 py-2 text-sm bg-background" />
                            </div>
                            {warehouses.length > 0 && (
                                <div>
                                    <label className="block text-xs font-medium mb-1">Outlet</label>
                                    <select value={form.data.warehouse_id ?? ''} onChange={e => form.setData('warehouse_id', e.target.value ? Number(e.target.value) : null)}
                                        className="w-full border rounded-lg px-3 py-2 text-sm bg-background">
                                        <option value="">(Umum)</option>
                                        {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                    </select>
                                </div>
                            )}
                            <div className="col-span-2 sm:col-span-3 flex justify-end gap-2 pt-1">
                                <button type="button" onClick={() => { setShowForm(false); setEditItem(null); }}
                                    className="px-4 py-2 rounded-lg border text-sm hover:bg-muted transition-colors">Batal</button>
                                <button type="submit" disabled={form.processing}
                                    className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
                                    {form.processing ? 'Menyimpan...' : 'Simpan'}
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* Table */}
                <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
                    {expenses.data.length === 0 ? (
                        <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
                            Tidak ada pengeluaran untuk periode ini.
                        </div>
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b bg-muted/40">
                                            <th className="text-left px-4 py-2.5 font-medium">Tanggal</th>
                                            <th className="text-left px-4 py-2.5 font-medium">Kategori</th>
                                            <th className="text-right px-4 py-2.5 font-medium">Jumlah</th>
                                            <th className="text-left px-4 py-2.5 font-medium">Keterangan</th>
                                            <th className="text-left px-4 py-2.5 font-medium">Outlet</th>
                                            <th className="text-left px-4 py-2.5 font-medium">Dicatat</th>
                                            <th className="px-4 py-2.5 w-20"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {expenses.data.map(e => (
                                            <tr key={e.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                                                <td className="px-4 py-2.5 text-xs text-muted-foreground tabular-nums whitespace-nowrap">{e.occurredAt}</td>
                                                <td className="px-4 py-2.5">
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300">
                                                        {CATEGORY_LABELS[e.category] ?? e.category}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-2.5 text-right tabular-nums font-medium text-rose-600 dark:text-rose-400">{fmt(e.amount)}</td>
                                                <td className="px-4 py-2.5 text-muted-foreground text-xs max-w-xs truncate">{e.description ?? '—'}</td>
                                                <td className="px-4 py-2.5 text-xs text-muted-foreground">{e.warehouseName}</td>
                                                <td className="px-4 py-2.5 text-xs text-muted-foreground">{e.creatorName}</td>
                                                <td className="px-4 py-2.5">
                                                    <div className="flex items-center gap-1">
                                                        <button onClick={() => openEdit(e)} className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
                                                            <Pencil className="h-3.5 w-3.5" />
                                                        </button>
                                                        <button onClick={() => handleDelete(e.id)} className="p-1.5 rounded hover:bg-rose-100 dark:hover:bg-rose-900/30 text-muted-foreground hover:text-rose-600 transition-colors">
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination */}
                            {expenses.last_page > 1 && (
                                <div className="flex items-center justify-between px-4 py-3 border-t text-sm text-muted-foreground">
                                    <span>{expenses.from}–{expenses.to} dari {expenses.total}</span>
                                    <div className="flex gap-1">
                                        {Array.from({ length: expenses.last_page }, (_, i) => i + 1).map(page => (
                                            <button key={page} onClick={() => goToPage(page)}
                                                className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${page === expenses.current_page ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>
                                                {page}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Category breakdown */}
                {summary.length > 0 && (
                    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
                        <div className="px-4 py-3 border-b">
                            <h2 className="font-semibold text-sm">Rincian per Kategori</h2>
                        </div>
                        <table className="w-full text-sm">
                            <tbody>
                                {summary.map(s => (
                                    <tr key={s.category} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                                        <td className="px-4 py-2.5">{CATEGORY_LABELS[s.category] ?? s.category}</td>
                                        <td className="px-4 py-2.5 text-right tabular-nums">{fmt(s.total)}</td>
                                        <td className="px-4 py-2.5 text-right text-xs text-muted-foreground">
                                            {totalAmount > 0 ? ((s.total / totalAmount) * 100).toFixed(1) + '%' : '—'}
                                        </td>
                                    </tr>
                                ))}
                                <tr className="bg-muted/40 font-semibold">
                                    <td className="px-4 py-2.5">Total</td>
                                    <td className="px-4 py-2.5 text-right tabular-nums text-rose-600 dark:text-rose-400">{fmt(totalAmount)}</td>
                                    <td className="px-4 py-2.5 text-right text-xs text-muted-foreground">100%</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
