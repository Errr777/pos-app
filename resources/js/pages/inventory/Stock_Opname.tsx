import { useState } from 'react';
import { DatePickerInput } from '@/components/DatePickerInput';
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
    const [showNew, setShowNew]       = useState(false);
    const [warehouseId, setWarehouseId] = useState('');
    const [date, setDate]             = useState(new Date().toISOString().slice(0, 10));
    const [note, setNote]             = useState('');
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

                {showNew && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                        <div className="bg-background rounded-xl shadow-2xl p-6 w-full max-w-md space-y-4">
                            <h2 className="text-lg font-semibold">Mulai Sesi Stock Opname</h2>
                            <div className="space-y-1">
                                <label className="text-sm font-medium">Outlet</label>
                                <select
                                    className="w-full border rounded-lg px-3 py-2 bg-background text-sm"
                                    value={warehouseId}
                                    onChange={e => setWarehouseId(e.target.value)}
                                >
                                    <option value="">-- Pilih Outlet --</option>
                                    {warehouses.map(w => (
                                        <option key={w.id} value={w.id}>{w.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-sm font-medium">Tanggal</label>
                                <DatePickerInput value={date} onChange={(v) => setDate(v)} />
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

                <div className="rounded-xl border bg-card overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-muted/40 border-b">
                            <tr>
                                <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wide">Ref</th>
                                <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wide">Outlet</th>
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

                <Pagination meta={safeOpnames} onPageChange={(page) => router.get(route('opname.index'), { page }, { preserveState: true })} />
            </div>
        </AppLayout>
    );
}
