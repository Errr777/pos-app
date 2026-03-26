import { useState } from 'react';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import { Download, X } from 'lucide-react';
import { DatePickerFilter } from '@/components/DatePickerInput';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Laporan', href: '#' },
    { title: 'Jam Ramai', href: '/report/peak-hours' },
];

interface Cell {
    hour: number;
    day: number;
    count: number;
    revenue: number;
}

interface PageProps {
    cells: Cell[];
    maxCount: number;
    warehouses: { id: string; name: string }[];
    filters: { date_from?: string; date_to?: string; warehouse_id?: string };
    [key: string]: unknown;
}

const DAY_LABELS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const DAYS_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Mon–Sun

function formatRp(n: number) { return 'Rp ' + n.toLocaleString('id-ID'); }
function padHour(h: number) { return String(h).padStart(2, '0') + ':00'; }

function heatColor(count: number, max: number): string {
    if (count === 0) return 'bg-slate-100 dark:bg-slate-800';
    const i = count / max;
    if (i < 0.2) return 'bg-indigo-100 dark:bg-indigo-900/30';
    if (i < 0.4) return 'bg-indigo-200 dark:bg-indigo-800/50';
    if (i < 0.6) return 'bg-indigo-400 text-white dark:bg-indigo-700';
    if (i < 0.8) return 'bg-indigo-600 text-white dark:bg-indigo-500';
    return 'bg-indigo-800 text-white dark:bg-indigo-400 dark:text-slate-900';
}

export default function ReportPeakHours() {
    const { cells, maxCount, warehouses, filters } = usePage<PageProps>().props;
    const [dateFrom, setDateFrom]     = useState(filters?.date_from ?? '');
    const [dateTo, setDateTo]         = useState(filters?.date_to ?? '');
    const [warehouse, setWarehouse]   = useState(filters?.warehouse_id ?? '');
    const [tooltip, setTooltip]       = useState<Cell | null>(null);

    const navigate = (overrides: Record<string, string> = {}) => {
        router.get('/report/peak-hours', {
            date_from: dateFrom, date_to: dateTo, warehouse_id: warehouse, ...overrides,
        }, { preserveState: true, replace: true });
    };

    const resetFilters = () => {
        const now = new Date();
        const pad = (n: number) => String(n).padStart(2, '0');
        const from = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate() - 29 < 1 ? 1 : now.getDate())}`;
        const d29  = new Date(now); d29.setDate(d29.getDate() - 29);
        const df   = `${d29.getFullYear()}-${pad(d29.getMonth()+1)}-${pad(d29.getDate())}`;
        const dt   = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`;
        setDateFrom(df); setDateTo(dt); setWarehouse('');
        router.get('/report/peak-hours', { date_from: df, date_to: dt, warehouse_id: '' }, { preserveState: true, replace: true });
    };

    const exportCSV = () => {
        const header = ['Jam', 'Hari', 'Jumlah Transaksi', 'Revenue (Rp)'];
        const rows = DAYS_ORDER.flatMap(d =>
            Array.from({ length: 24 }, (_, h) => {
                const cell = cellMap[h]?.[d] ?? { hour: h, day: d, count: 0, revenue: 0 };
                return [padHour(cell.hour), DAY_LABELS[cell.day], cell.count, cell.revenue].join(';');
            })
        );
        const csv = [header.join(';'), ...rows].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `laporan-jam-ramai_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // Build cell lookup: cellMap[hour][day]
    const cellMap: Record<number, Record<number, Cell>> = {};
    for (const c of cells) {
        if (!cellMap[c.hour]) cellMap[c.hour] = {};
        cellMap[c.hour][c.day] = c;
    }

    const totalTrx     = cells.reduce((s, c) => s + c.count, 0);
    const totalRevenue = cells.reduce((s, c) => s + c.revenue, 0);
    const peakCell     = cells.reduce(
        (best, c) => c.count > best.count ? c : best,
        { hour: 0, day: 0, count: 0, revenue: 0 }
    );

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
                        <DatePickerFilter value={dateFrom} onChange={v => setDateFrom(v)} placeholder="Dari tanggal" />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">Sampai</label>
                        <DatePickerFilter value={dateTo} onChange={v => setDateTo(v)} placeholder="Sampai tanggal" />
                    </div>
                    {warehouses.length > 1 && (
                        <div>
                            <label className="block text-xs font-medium text-muted-foreground mb-1">Outlet</label>
                            <select className="border rounded-lg px-3 py-2 text-sm bg-background" value={warehouse}
                                onChange={e => { setWarehouse(e.target.value); navigate({ warehouse_id: e.target.value }); }}>
                                <option value="">Semua Outlet</option>
                                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                            </select>
                        </div>
                    )}
                    <button onClick={() => navigate()} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium">Terapkan</button>
                    <button onClick={resetFilters} className="flex items-center gap-1.5 px-4 py-2 rounded-lg border text-sm font-medium hover:bg-muted transition-colors">
                        <X className="h-4 w-4" />
                        Reset
                    </button>
                    <button
                        onClick={exportCSV}
                        disabled={cells.length === 0}
                        className="print:hidden flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Download className="h-4 w-4" />
                        Export CSV
                    </button>
                </div>

                {/* Summary Cards */}
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
                    <div style={{ minWidth: 640 }}>
                        {/* Day header */}
                        <div className="flex gap-1 mb-1 pl-14">
                            {DAYS_ORDER.map(d => (
                                <div key={d} className="flex-1 text-center text-xs font-semibold text-muted-foreground py-1">
                                    {DAY_LABELS[d]}
                                </div>
                            ))}
                        </div>

                        {/* Hour rows */}
                        {Array.from({ length: 24 }, (_, h) => (
                            <div key={h} className="flex gap-1 mb-1 items-center">
                                <div className="w-12 text-right text-xs text-muted-foreground pr-2 shrink-0">
                                    {padHour(h)}
                                </div>
                                {DAYS_ORDER.map(d => {
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
                        <div className="flex items-center gap-2 mt-3 pl-14">
                            <span className="text-xs text-muted-foreground">Sedikit</span>
                            {[0, 0.25, 0.5, 0.75, 1].map(pct => (
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
