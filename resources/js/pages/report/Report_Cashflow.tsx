import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import { useState } from 'react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
    Legend, ResponsiveContainer,
} from 'recharts';
import { TrendingUp, TrendingDown, ArrowRightLeft, Download } from 'lucide-react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Laporan Kas', href: '/report/cashflow' },
];

interface Series {
    period: string;
    cashIn: number;
    cashOut: number;
    net: number;
}

interface Totals {
    cashIn: number;
    cashOut: number;
    net: number;
}

interface Warehouse { id: number; name: string; }

interface Filters {
    date_from?: string;
    date_to?: string;
    warehouse_id?: string;
    group_by?: string;
}

interface PageProps {
    series: Series[];
    totals: Totals;
    warehouses: Warehouse[];
    filters: Filters;
    [key: string]: unknown;
}

function formatRp(n: number) {
    const abs = Math.abs(n);
    if (abs >= 1_000_000_000) return (n < 0 ? '-' : '') + 'Rp ' + (abs / 1_000_000_000).toFixed(1) + ' M';
    if (abs >= 1_000_000) return (n < 0 ? '-' : '') + 'Rp ' + (abs / 1_000_000).toFixed(1) + ' jt';
    return (n < 0 ? '-' : '') + 'Rp ' + abs.toLocaleString('id-ID');
}

function formatRpFull(n: number) {
    return (n < 0 ? '-' : '') + 'Rp ' + Math.abs(n).toLocaleString('id-ID');
}

function formatPeriod(p: string, groupBy: string) {
    if (groupBy === 'monthly') {
        const [y, m] = p.split('-');
        const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
        return (months[parseInt(m) - 1] ?? m) + ' ' + y;
    }
    // daily: YYYY-MM-DD → DD/MM
    const parts = p.split('-');
    return parts[2] + '/' + parts[1];
}

const CustomTooltip = ({ active, payload, label, groupBy }: {
    active?: boolean; payload?: { value: number; name: string; color: string }[]; label?: string; groupBy: string;
}) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="rounded-lg border bg-background shadow-lg p-3 text-sm min-w-[180px]">
            <p className="font-semibold mb-2 text-foreground">{formatPeriod(label ?? '', groupBy)}</p>
            {payload.map((p) => (
                <div key={p.name} className="flex justify-between gap-4">
                    <span style={{ color: p.color }}>{p.name}</span>
                    <span className="font-mono font-medium">{formatRp(p.value)}</span>
                </div>
            ))}
        </div>
    );
};

export default function ReportCashflow() {
    const { series, totals, warehouses, filters } = usePage<PageProps>().props;

    const [dateFrom,    setDateFrom]    = useState(filters.date_from    ?? '');
    const [dateTo,      setDateTo]      = useState(filters.date_to      ?? '');
    const [warehouseId, setWarehouseId] = useState(filters.warehouse_id ?? '');
    const [groupBy,     setGroupBy]     = useState(filters.group_by     ?? 'daily');

    function applyFilters() {
        router.get('/report/cashflow', {
            date_from:    dateFrom,
            date_to:      dateTo,
            warehouse_id: warehouseId,
            group_by:     groupBy,
        }, { preserveState: true });
    }

    const chartData = series.map(s => ({
        ...s,
        label: formatPeriod(s.period, groupBy),
    }));

    const netPositive = totals.net >= 0;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Laporan Kas" />
            <div className="p-6 space-y-6">

                {/* ── Filters ── */}
                <div className="flex flex-wrap gap-3 items-end">
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-muted-foreground">Dari Tanggal</label>
                        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                            className="border rounded-lg px-3 py-2 bg-background text-sm h-9" />
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-muted-foreground">Sampai Tanggal</label>
                        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                            className="border rounded-lg px-3 py-2 bg-background text-sm h-9" />
                    </div>
                    {warehouses.length > 1 && (
                        <div className="flex flex-col gap-1">
                            <label className="text-xs font-medium text-muted-foreground">Outlet</label>
                            <select value={warehouseId} onChange={e => setWarehouseId(e.target.value)}
                                className="border rounded-lg px-3 py-2 bg-background text-sm h-9">
                                <option value="">Semua Outlet</option>
                                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                            </select>
                        </div>
                    )}
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-muted-foreground">Tampilan</label>
                        <div className="flex border rounded-lg overflow-hidden h-9">
                            {(['daily', 'monthly'] as const).map(g => (
                                <button key={g}
                                    onClick={() => setGroupBy(g)}
                                    className={`px-3 py-1.5 text-sm font-medium transition-colors ${groupBy === g ? 'bg-primary text-primary-foreground' : 'bg-background text-foreground hover:bg-accent'}`}>
                                    {g === 'daily' ? 'Harian' : 'Bulanan'}
                                </button>
                            ))}
                        </div>
                    </div>
                    <button onClick={applyFilters}
                        className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
                        Tampilkan
                    </button>
                    <a
                        href={`/report/cashflow/export/excel?date_from=${dateFrom}&date_to=${dateTo}&warehouse_id=${warehouseId}&group_by=${groupBy}`}
                        className="print:hidden flex items-center gap-2 h-9 px-4 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors"
                    >
                        <Download className="h-4 w-4" />
                        Export Excel
                    </a>
                </div>

                {/* ── Summary Cards ── */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="rounded-xl border bg-card p-5 space-y-1 shadow-sm">
                        <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                            <TrendingUp className="h-4 w-4" />
                            <span className="text-xs font-medium uppercase tracking-wide">Kas Masuk</span>
                        </div>
                        <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                            {formatRp(totals.cashIn)}
                        </p>
                        <p className="text-xs text-muted-foreground">Total penjualan selesai</p>
                    </div>

                    <div className="rounded-xl border bg-card p-5 space-y-1 shadow-sm">
                        <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
                            <TrendingDown className="h-4 w-4" />
                            <span className="text-xs font-medium uppercase tracking-wide">Kas Keluar</span>
                        </div>
                        <p className="text-2xl font-bold text-rose-600 dark:text-rose-400">
                            {formatRp(totals.cashOut)}
                        </p>
                        <p className="text-xs text-muted-foreground">Total pembelian diterima</p>
                    </div>

                    <div className={`rounded-xl border bg-card p-5 space-y-1 shadow-sm ${netPositive ? 'border-emerald-200 dark:border-emerald-900' : 'border-rose-200 dark:border-rose-900'}`}>
                        <div className={`flex items-center gap-2 ${netPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                            <ArrowRightLeft className="h-4 w-4" />
                            <span className="text-xs font-medium uppercase tracking-wide">Arus Kas Bersih</span>
                        </div>
                        <p className={`text-2xl font-bold ${netPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                            {netPositive ? '+' : ''}{formatRp(totals.net)}
                        </p>
                        <p className="text-xs text-muted-foreground">{netPositive ? 'Surplus' : 'Defisit'} periode ini</p>
                    </div>
                </div>

                {/* ── Chart ── */}
                <div className="rounded-xl border bg-card p-5 shadow-sm">
                    <h2 className="text-sm font-semibold mb-4">Grafik Arus Kas</h2>
                    {chartData.length === 0 ? (
                        <div className="flex items-center justify-center h-52 text-sm text-muted-foreground">
                            Tidak ada data untuk periode ini.
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height={280}>
                            <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                                <defs>
                                    <linearGradient id="gradIn" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="gradOut" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="gradNet" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                                <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} />
                                <YAxis
                                    tickFormatter={v => formatRp(v)}
                                    tick={{ fontSize: 10 }}
                                    tickLine={false}
                                    axisLine={false}
                                    width={80}
                                />
                                <Tooltip content={<CustomTooltip groupBy={groupBy} />} />
                                <Legend wrapperStyle={{ fontSize: 12 }} />
                                <Area type="monotone" dataKey="cashIn" name="Kas Masuk"
                                    stroke="#10b981" strokeWidth={2} fill="url(#gradIn)" />
                                <Area type="monotone" dataKey="cashOut" name="Kas Keluar"
                                    stroke="#f43f5e" strokeWidth={2} fill="url(#gradOut)" />
                                <Area type="monotone" dataKey="net" name="Bersih"
                                    stroke="#6366f1" strokeWidth={2} strokeDasharray="5 3" fill="url(#gradNet)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    )}
                </div>

                {/* ── Detail Table ── */}
                {series.length > 0 && (
                    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
                        <div className="px-5 py-3 border-b">
                            <h2 className="text-sm font-semibold">Rincian {groupBy === 'monthly' ? 'Bulanan' : 'Harian'}</h2>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b bg-muted/40">
                                        <th className="text-left px-4 py-3 font-medium">Periode</th>
                                        <th className="text-right px-4 py-3 font-medium text-emerald-600 dark:text-emerald-400">Kas Masuk</th>
                                        <th className="text-right px-4 py-3 font-medium text-rose-600 dark:text-rose-400">Kas Keluar</th>
                                        <th className="text-right px-4 py-3 font-medium">Bersih</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {[...series].reverse().map((row) => {
                                        const isPos = row.net >= 0;
                                        return (
                                            <tr key={row.period} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                                                <td className="px-4 py-3 font-medium tabular-nums">
                                                    {formatPeriod(row.period, groupBy)}
                                                </td>
                                                <td className="px-4 py-3 text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                                                    {row.cashIn > 0 ? formatRpFull(row.cashIn) : '-'}
                                                </td>
                                                <td className="px-4 py-3 text-right tabular-nums text-rose-600 dark:text-rose-400">
                                                    {row.cashOut > 0 ? formatRpFull(row.cashOut) : '-'}
                                                </td>
                                                <td className={`px-4 py-3 text-right tabular-nums font-semibold ${isPos ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                                    {isPos ? '+' : ''}{formatRpFull(row.net)}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-muted/50 font-semibold border-t-2">
                                        <td className="px-4 py-3">Total</td>
                                        <td className="px-4 py-3 text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                                            {formatRpFull(totals.cashIn)}
                                        </td>
                                        <td className="px-4 py-3 text-right tabular-nums text-rose-600 dark:text-rose-400">
                                            {formatRpFull(totals.cashOut)}
                                        </td>
                                        <td className={`px-4 py-3 text-right tabular-nums ${netPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                            {netPositive ? '+' : ''}{formatRpFull(totals.net)}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
