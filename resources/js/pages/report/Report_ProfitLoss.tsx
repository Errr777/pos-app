import { Button } from '@/components/ui/button';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, usePage } from '@inertiajs/react';
import { Download } from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Laporan', href: '/report/stock' },
    { title: 'Laba Rugi', href: '/report/profit-loss' },
];

interface MonthData {
    month: string;
    month_num: number;
    revenue: number;
    cogs: number;
    gross_profit: number;
    expenses: number;
    net_profit: number;
}

interface Totals {
    revenue: number;
    cogs: number;
    gross_profit: number;
    expenses: number;
    net_profit: number;
}

interface PageProps {
    monthly: MonthData[];
    totals: Totals;
    year: number;
    years: number[];
    warehouses: { id: number; name: string }[];
    warehouseId: number | null;
    [key: string]: unknown;
}

function formatRp(n: number) {
    if (n >= 1_000_000) return 'Rp ' + (n / 1_000_000).toFixed(1) + ' jt';
    if (n >= 1_000)     return 'Rp ' + (n / 1_000).toFixed(0) + ' rb';
    return 'Rp ' + n.toLocaleString('id-ID');
}

function formatRpFull(n: number) {
    return 'Rp ' + n.toLocaleString('id-ID');
}

const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="rounded-lg border bg-background shadow-md px-3 py-2 text-xs space-y-1">
            <p className="font-semibold mb-1">{label}</p>
            {payload.map((p: any) => (
                <p key={p.name} style={{ color: p.fill }}>{p.name}: {formatRpFull(p.value)}</p>
            ))}
        </div>
    );
};

export default function ReportProfitLoss() {
    const { monthly = [], totals, year, years = [], warehouses = [], warehouseId } = usePage<PageProps>().props;

    const safeTotals: Totals = totals ?? { revenue: 0, cogs: 0, gross_profit: 0, expenses: 0, net_profit: 0 };

    const exportCSV = () => {
        const date = new Date().toISOString().slice(0, 10);
        const rows: string[][] = [
            ['Laporan Laba Rugi', String(year)],
            [],
            ['Bulan', 'Omzet', 'HPP', 'Laba Kotor', 'Beban Operasional', 'Laba Bersih', 'Margin %'],
            ...monthly.map(r => [
                `${r.month} ${year}`,
                String(r.revenue),
                String(r.cogs),
                String(r.gross_profit),
                String(r.expenses),
                String(r.net_profit),
                r.revenue > 0 ? ((r.net_profit / r.revenue) * 100).toFixed(1) + '%' : '-',
            ]),
            [],
            [
                `TOTAL ${year}`,
                String(safeTotals.revenue),
                String(safeTotals.cogs),
                String(safeTotals.gross_profit),
                String(safeTotals.expenses),
                String(safeTotals.net_profit),
                (safeTotals.revenue > 0 ? ((safeTotals.net_profit / safeTotals.revenue) * 100).toFixed(1) : '0.0') + '%',
            ],
        ];
        const csv = rows.map(r => r.join(';')).join('\r\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `laporan-laba-rugi_${date}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const margin = safeTotals.revenue > 0
        ? ((safeTotals.gross_profit / safeTotals.revenue) * 100).toFixed(1)
        : '0.0';
    const netMargin = safeTotals.revenue > 0
        ? ((safeTotals.net_profit / safeTotals.revenue) * 100).toFixed(1)
        : '0.0';

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Laporan Laba Rugi" />
            <div className="flex flex-col gap-5 p-4 md:p-6">

                {/* Header */}
                <div className="flex items-center justify-between">
                    <h1 className="text-xl font-bold">Laporan Laba Rugi {year}</h1>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={exportCSV}>
                            <Download className="w-4 h-4 mr-1.5" />
                            Export CSV
                        </Button>
                        {warehouses.length > 1 && (
                            <select
                                defaultValue={warehouseId ?? ''}
                                onChange={e => {
                                    const params = new URLSearchParams({ year: String(year) });
                                    if (e.target.value) params.set('warehouse_id', e.target.value);
                                    window.location.href = `/report/profit-loss?${params.toString()}`;
                                }}
                                className="border rounded-md px-3 py-2 text-sm bg-background"
                            >
                                <option value="">Semua Outlet</option>
                                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                            </select>
                        )}
                        <select
                            defaultValue={year}
                            onChange={e => {
                                const params = new URLSearchParams({ year: e.target.value });
                                if (warehouseId) params.set('warehouse_id', String(warehouseId));
                                window.location.href = `/report/profit-loss?${params.toString()}`;
                            }}
                            className="border rounded-md px-3 py-2 text-sm bg-background"
                        >
                            {years.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                </div>

                {/* Summary cards */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    <div className="rounded-xl border bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 p-4">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Total Omzet</p>
                        <p className="text-xl font-bold text-indigo-700 dark:text-indigo-300 mt-1">{formatRp(safeTotals.revenue)}</p>
                    </div>
                    <div className="rounded-xl border bg-rose-50 dark:bg-rose-950/40 border-rose-200 p-4">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Total HPP</p>
                        <p className="text-xl font-bold text-rose-700 dark:text-rose-300 mt-1">{formatRp(safeTotals.cogs)}</p>
                    </div>
                    <div className="rounded-xl border bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 p-4">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Laba Kotor</p>
                        <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300 mt-1">{formatRp(safeTotals.gross_profit)}</p>
                    </div>
                    <div className="rounded-xl border bg-amber-50 dark:bg-amber-950/40 border-amber-200 p-4">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Margin Kotor</p>
                        <p className="text-xl font-bold text-amber-700 dark:text-amber-300 mt-1">{margin}%</p>
                    </div>
                    <div className="rounded-xl border bg-orange-50 dark:bg-orange-950/40 border-orange-200 p-4">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Beban Operasional</p>
                        <p className="text-xl font-bold text-orange-700 dark:text-orange-300 mt-1">{formatRp(safeTotals.expenses)}</p>
                    </div>
                    <div className={`rounded-xl border p-4 ${safeTotals.net_profit >= 0 ? 'bg-teal-50 dark:bg-teal-950/40 border-teal-200' : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200'}`}>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Laba Bersih</p>
                        <p className={`text-xl font-bold mt-1 ${safeTotals.net_profit >= 0 ? 'text-teal-700 dark:text-teal-300' : 'text-rose-700 dark:text-rose-300'}`}>{formatRp(safeTotals.net_profit)}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Margin {netMargin}%</p>
                    </div>
                </div>

                {/* Chart */}
                <div className="rounded-xl border bg-card p-4 shadow-sm">
                    <h2 className="text-sm font-semibold mb-4">Tren Bulanan {year}</h2>
                    {monthly.every(r => r.revenue === 0 && r.cogs === 0) ? (
                        <div className="flex items-center justify-center h-[280px] text-sm text-muted-foreground">
                            Belum ada data transaksi untuk tahun {year}
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height={280}>
                            <BarChart
                                data={monthly.filter(r => r.revenue > 0 || r.cogs > 0)}
                                margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                                <YAxis tickFormatter={v => formatRp(v)} tick={{ fontSize: 10 }} width={80} />
                                <Tooltip content={<CustomTooltip />} />
                                <Legend />
                                <Bar dataKey="revenue"      name="Omzet"           fill="#6366f1" radius={[4,4,0,0]} />
                                <Bar dataKey="cogs"         name="HPP"             fill="oklch(0.645 0.246 16)"  radius={[4,4,0,0]} />
                                <Bar dataKey="gross_profit" name="Laba Kotor"      fill="oklch(0.627 0.194 149)" radius={[4,4,0,0]} />
                                <Bar dataKey="expenses"     name="Beban Operasional" fill="oklch(0.705 0.213 47)" radius={[4,4,0,0]} />
                                <Bar dataKey="net_profit"   name="Laba Bersih"     fill="oklch(0.6 0.17 185)"   radius={[4,4,0,0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </div>

                {/* Monthly table */}
                <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
                    <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                            <tr>
                                <th className="text-left px-4 py-2.5 font-medium text-xs">Bulan</th>
                                <th className="text-right px-4 py-2.5 font-medium text-xs">Omzet</th>
                                <th className="text-right px-4 py-2.5 font-medium text-xs">HPP</th>
                                <th className="text-right px-4 py-2.5 font-medium text-xs">Laba Kotor</th>
                                <th className="text-right px-4 py-2.5 font-medium text-xs">Beban</th>
                                <th className="text-right px-4 py-2.5 font-medium text-xs">Laba Bersih</th>
                                <th className="text-right px-4 py-2.5 font-medium text-xs">Margin %</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {monthly.map(row => (
                                <tr key={row.month_num} className="hover:bg-muted/30 transition-colors">
                                    <td className="px-4 py-2.5 font-medium text-xs">{row.month} {year}</td>
                                    <td className="px-4 py-2.5 text-right text-xs">{formatRpFull(row.revenue)}</td>
                                    <td className="px-4 py-2.5 text-right text-xs text-rose-600 dark:text-rose-400">{formatRpFull(row.cogs)}</td>
                                    <td className={`px-4 py-2.5 text-right text-xs font-semibold ${row.gross_profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                        {formatRpFull(row.gross_profit)}
                                    </td>
                                    <td className="px-4 py-2.5 text-right text-xs text-orange-600 dark:text-orange-400">{formatRpFull(row.expenses)}</td>
                                    <td className={`px-4 py-2.5 text-right text-xs font-semibold ${row.net_profit >= 0 ? 'text-teal-600 dark:text-teal-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                        {formatRpFull(row.net_profit)}
                                    </td>
                                    <td className="px-4 py-2.5 text-right text-xs text-muted-foreground">
                                        {row.revenue > 0 ? ((row.net_profit / row.revenue) * 100).toFixed(1) + '%' : '-'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="bg-muted/60 font-semibold border-t-2">
                            <tr>
                                <td className="px-4 py-2.5 text-xs">TOTAL {year}</td>
                                <td className="px-4 py-2.5 text-right text-xs">{formatRpFull(safeTotals.revenue)}</td>
                                <td className="px-4 py-2.5 text-right text-xs text-rose-600 dark:text-rose-400">{formatRpFull(safeTotals.cogs)}</td>
                                <td className="px-4 py-2.5 text-right text-xs text-emerald-600 dark:text-emerald-400">{formatRpFull(safeTotals.gross_profit)}</td>
                                <td className="px-4 py-2.5 text-right text-xs text-orange-600 dark:text-orange-400">{formatRpFull(safeTotals.expenses)}</td>
                                <td className={`px-4 py-2.5 text-right text-xs ${safeTotals.net_profit >= 0 ? 'text-teal-600 dark:text-teal-400' : 'text-rose-600 dark:text-rose-400'}`}>{formatRpFull(safeTotals.net_profit)}</td>
                                <td className="px-4 py-2.5 text-right text-xs">{netMargin}%</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        </AppLayout>
    );
}
