import { useState } from 'react';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import { Building2, TrendingUp, ShoppingCart, BarChart3, Download } from 'lucide-react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Laporan', href: '#' },
    { title: 'Perbandingan Cabang', href: '/report/branches' },
];

interface Branch {
    id: number;
    name: string;
    code: string;
    city: string | null;
    phone: string | null;
    isDefault: boolean;
    trxCount: number;
    revenue: number;
    cogs: number;
    profit: number;
    avgOrder: number;
    topItem: string | null;
}

interface Totals { trxCount: number; revenue: number; profit: number }

interface PageProps {
    branches: Branch[];
    totals: Totals;
    filters: { date_from?: string; date_to?: string };
    [key: string]: unknown;
}

function formatRp(n: number) { return 'Rp ' + n.toLocaleString('id-ID'); }
function pct(val: number, total: number) {
    if (total === 0) return 0;
    return Math.round((val / total) * 100);
}

export default function ReportBranches() {
    const { branches, totals, filters } = usePage<PageProps>().props;
    const [dateFrom, setDateFrom] = useState(filters?.date_from ?? new Date().toISOString().slice(0, 7) + '-01');
    const [dateTo, setDateTo]     = useState(filters?.date_to ?? new Date().toISOString().slice(0, 10));

    const navigate = () => {
        router.get('/report/branches', { date_from: dateFrom, date_to: dateTo }, { preserveState: true, replace: true });
    };

    const exportCSV = () => {
        const headers = ['Nama Cabang', 'Kode', 'Kota', 'Telepon', 'Transaksi', 'Revenue', 'COGS', 'Profit', 'Rata-rata Order', 'Item Terlaris', '% Revenue'];
        const rows = branches.map(b => [
            b.name,
            b.code,
            b.city ?? '',
            b.phone ?? '',
            b.trxCount,
            b.revenue,
            b.cogs,
            b.profit,
            b.avgOrder,
            b.topItem ?? '',
            pct(b.revenue, totals.revenue),
        ]);
        const csvContent = [headers, ...rows]
            .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
            .join('\r\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `laporan-cabang_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const maxRevenue = Math.max(1, ...branches.map(b => b.revenue));

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Perbandingan Cabang" />
            <div className="p-6 space-y-6">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Building2 className="w-6 h-6 text-indigo-500" />
                        Perbandingan Cabang
                    </h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        Kinerja penjualan semua outlet dalam satu tampilan
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
                    <button onClick={navigate} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium">Terapkan</button>
                    <a
                        href={`/report/branches/export/excel?date_from=${dateFrom}&date_to=${dateTo}`}
                        className="print:hidden flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors"
                    >
                        <Download className="h-4 w-4" />
                        Export Excel
                    </a>
                    <button
                        onClick={exportCSV}
                        disabled={branches.length === 0}
                        className="print:hidden flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-600 text-white text-sm font-medium hover:bg-sky-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Download className="h-4 w-4" />
                        Export CSV
                    </button>
                </div>

                {/* Totals */}
                <div className="grid grid-cols-3 gap-4">
                    <div className="rounded-xl border bg-card p-4">
                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                            <ShoppingCart className="w-4 h-4" />
                            <span className="text-xs font-medium uppercase tracking-wide">Total Transaksi</span>
                        </div>
                        <div className="text-2xl font-bold tabular-nums">{totals.trxCount.toLocaleString('id-ID')}</div>
                    </div>
                    <div className="rounded-xl border bg-card p-4">
                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                            <TrendingUp className="w-4 h-4" />
                            <span className="text-xs font-medium uppercase tracking-wide">Total Revenue</span>
                        </div>
                        <div className="text-2xl font-bold tabular-nums">{formatRp(totals.revenue)}</div>
                    </div>
                    <div className="rounded-xl border bg-card p-4">
                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                            <BarChart3 className="w-4 h-4" />
                            <span className="text-xs font-medium uppercase tracking-wide">Total Profit</span>
                        </div>
                        <div className={`text-2xl font-bold tabular-nums ${totals.profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {formatRp(totals.profit)}
                        </div>
                    </div>
                </div>

                {/* Branch cards */}
                {branches.length === 0 ? (
                    <div className="rounded-xl border bg-card p-12 text-center text-muted-foreground">
                        Tidak ada data cabang untuk periode ini.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {branches.map(b => (
                            <div key={b.id} className="rounded-xl border bg-card p-5 space-y-4">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-semibold text-base">{b.name}</h3>
                                            {b.isDefault && (
                                                <span className="text-xs px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">Utama</span>
                                            )}
                                        </div>
                                        <div className="text-xs text-muted-foreground mt-0.5 space-x-2">
                                            <span>{b.code}</span>
                                            {b.city && <span>· {b.city}</span>}
                                            {b.phone && <span>· {b.phone}</span>}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-lg font-bold tabular-nums">{formatRp(b.revenue)}</div>
                                        <div className="text-xs text-muted-foreground">{pct(b.revenue, totals.revenue)}% dari total</div>
                                    </div>
                                </div>

                                {/* Revenue bar */}
                                <div className="w-full bg-muted rounded-full h-2">
                                    <div
                                        className="bg-indigo-500 h-2 rounded-full transition-all"
                                        style={{ width: `${pct(b.revenue, maxRevenue)}%` }}
                                    />
                                </div>

                                {/* Stats grid */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="rounded-lg bg-muted/40 px-3 py-2">
                                        <div className="text-xs text-muted-foreground">Transaksi</div>
                                        <div className="font-semibold tabular-nums">{b.trxCount.toLocaleString('id-ID')}</div>
                                    </div>
                                    <div className="rounded-lg bg-muted/40 px-3 py-2">
                                        <div className="text-xs text-muted-foreground">Rata-rata Order</div>
                                        <div className="font-semibold tabular-nums text-sm">{formatRp(b.avgOrder)}</div>
                                    </div>
                                    <div className="rounded-lg bg-muted/40 px-3 py-2">
                                        <div className="text-xs text-muted-foreground">Profit</div>
                                        <div className={`font-semibold tabular-nums text-sm ${b.profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                            {formatRp(b.profit)}
                                        </div>
                                    </div>
                                    <div className="rounded-lg bg-muted/40 px-3 py-2">
                                        <div className="text-xs text-muted-foreground">Item Terlaris</div>
                                        <div className="font-semibold text-xs truncate" title={b.topItem ?? ''}>
                                            {b.topItem ?? '—'}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
