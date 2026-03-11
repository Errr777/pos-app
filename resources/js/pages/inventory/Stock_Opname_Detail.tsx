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
    const [rows, setRows]       = useState<OpnameRow[]>(initialRows);
    const [saving, setSaving]   = useState(false);
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

    const isSubmitted    = opname.status === 'submitted';
    const countedCount   = rows.filter(r => r.actualQty !== null).length;
    const totalVariance  = rows.reduce((sum, r) => sum + Math.abs(r.variance ?? 0), 0);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Stock Opname — ${opname.refNumber}`} />
            <div className="p-6 space-y-6">
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
