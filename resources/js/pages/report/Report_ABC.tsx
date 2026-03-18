import { useState } from 'react';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import { Download } from 'lucide-react';

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

const CLASS_CLS: Record<string, string> = {
    A: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    B: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    C: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
};

const CLASS_DESC: Record<string, string> = {
    A: 'Kontributor utama — 80% revenue',
    B: 'Kontributor menengah — 15% revenue',
    C: 'Kontributor kecil — 5% revenue',
};

export default function ReportABC() {
    const { items, grandTotal, classSummary, warehouses, filters } = usePage<PageProps>().props;

    const currentYear = new Date().getFullYear();
    const [dateFrom, setDateFrom] = useState(filters?.date_from ?? `${currentYear}-01-01`);
    const [dateTo, setDateTo]     = useState(filters?.date_to ?? new Date().toISOString().slice(0, 10));
    const [warehouse, setWarehouse] = useState(filters?.warehouse_id ?? '');
    const [filterClass, setFilterClass] = useState<string>('');

    const navigate = () => {
        router.get('/report/abc', { date_from: dateFrom, date_to: dateTo, warehouse_id: warehouse }, { preserveState: true, replace: true });
    };

    const exportCSV = () => {
        const headers = ['#', 'Kelas', 'Nama Produk', 'Kategori', 'Terjual', 'Revenue', 'Profit', 'Margin (%)', 'Kumulatif (%)'];
        const rows = displayed.map((item, i) => [
            i + 1,
            item.class,
            item.name,
            item.category ?? '',
            item.totalSold,
            item.totalRevenue,
            item.profit,
            item.margin,
            item.cumulativePct,
        ]);
        const csv = [headers, ...rows]
            .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
            .join('\n');
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `laporan-abc_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
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
                            <label className="block text-xs font-medium text-muted-foreground mb-1">Outlet</label>
                            <select className="border rounded-lg px-3 py-2 text-sm bg-background" value={warehouse} onChange={e => setWarehouse(e.target.value)}>
                                <option value="">Semua Outlet</option>
                                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                            </select>
                        </div>
                    )}
                    <button onClick={navigate} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium">Terapkan</button>
                    <button
                        onClick={exportCSV}
                        disabled={displayed.length === 0}
                        className="print:hidden flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Download className="h-4 w-4" />
                        Download CSV
                    </button>
                </div>

                {/* Class Summary Cards */}
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
                            <col style={{ width: '2.5rem' }} />
                            <col style={{ width: '5%' }} />
                            <col style={{ width: '28%' }} />
                            <col style={{ width: '12%' }} />
                            <col style={{ width: '10%' }} />
                            <col style={{ width: '14%' }} />
                            <col style={{ width: '14%' }} />
                            <col style={{ width: '7%' }} />
                            <col style={{ width: '7%' }} />
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
                                <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide">Kumul.</th>
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
                    Total revenue: {formatRp(grandTotal)} · {items.length} produk
                </div>
            </div>
        </AppLayout>
    );
}
