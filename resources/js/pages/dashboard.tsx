import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import {
    AreaChart, Area, BarChart, Bar,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
];

interface DashboardStats {
    totalItems: number;
    lowStockCount: number;
    itemsWithNoMinimum: number;
    categoriesCount: number;
    salesToday: number;
    salesThisMonth: number;
    netRevenueThisMonth: number;
    transactionCountMonth: number;
}

interface SalesChartPoint { date: string; total: number; count: number; }
interface TopItem        { name: string; qty: number; }
interface RecentSale     { id: number; saleNumber: string; cashier: string; grandTotal: number; occurredAt: string; }
interface LowStockItem   { id: number; name: string; stock: number; minimum: number; deficit: number; }
interface RevenueTrendPoint { date: string; revenue: number; }
interface TopProduct    { name: string; qtySold: number; revenue: number; }
interface RecentTransaction { id: number; saleNumber: string; occurredAt: string; cashierName: string; grandTotal: number; }
interface StockAlerts   { count: number; items: { name: string; stock: number; stockMin: number; outletName: string | null }[] }

interface PageProps {
    stats: DashboardStats;
    salesChart: SalesChartPoint[];
    topItems: TopItem[];
    recentSales: RecentSale[];
    lowStockItems: LowStockItem[];
    revenueTrend: RevenueTrendPoint[];
    topProducts: TopProduct[];
    recentTransactions: RecentTransaction[];
    stockAlerts: StockAlerts;
    warehouseContext?: string | null;
    branchStats: {
        id: number;
        name: string;
        city: string | null;
        salesToday: number;
        salesMonth: number;
        trxToday: number;
    }[] | null;
    selectedMonth: string;
    isCurrentMonth: boolean;
    availableMonths: { value: string; label: string }[];
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

const TooltipRp = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="rounded-lg border bg-background shadow-md px-3 py-2 text-sm">
            <p className="font-medium mb-1">{label}</p>
            {payload.map((p: any) => (
                <p key={p.name} style={{ color: p.color }}>
                    {p.name === 'total' ? formatRpFull(p.value) : `${p.value} transaksi`}
                </p>
            ))}
        </div>
    );
};

export default function Dashboard() {
    const {
        stats, salesChart = [], topItems = [], recentSales = [], lowStockItems = [],
        revenueTrend = [], topProducts = [], recentTransactions = [],
        stockAlerts = { count: 0, items: [] },
        warehouseContext, branchStats,
        selectedMonth = '', isCurrentMonth = true, availableMonths = [],
    } = usePage<PageProps>().props;
    const safeStats: DashboardStats = {
        ...(stats ?? { totalItems: 0, lowStockCount: 0, itemsWithNoMinimum: 0, categoriesCount: 0, salesToday: 0, salesThisMonth: 0, netRevenueThisMonth: 0, transactionCountMonth: 0 }),
    };

    const handleMonthChange = (month: string) => {
        router.get(route('dashboard'), { month }, { preserveState: false });
    };

    const monthLabel = selectedMonth
        ? new Date(selectedMonth + '-01').toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
        : '';

    // Derive unique years and months from availableMonths
    const availableYears = [...new Set(availableMonths.map(m => m.value.slice(0, 4)))];
    const selectedYear = selectedMonth.slice(0, 4);
    const selectedMonthNum = selectedMonth.slice(5, 7);
    const monthsForYear = availableMonths.filter(m => m.value.startsWith(selectedYear));
    const MONTH_NAMES = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];

    const handleYearChange = (year: string) => {
        // Pick first available month in the new year, or keep same month number if available
        const sameMonth = availableMonths.find(m => m.value === `${year}-${selectedMonthNum}`);
        const fallback = availableMonths.find(m => m.value.startsWith(year));
        const target = sameMonth ?? fallback;
        if (target) handleMonthChange(target.value);
    };

    const handleMonthNumChange = (monthNum: string) => {
        handleMonthChange(`${selectedYear}-${monthNum}`);
    };

    const kpiCards = [
        isCurrentMonth ? {
            label: 'Penjualan Hari Ini',
            value: formatRp(safeStats.salesToday),
            sub: 'transaksi selesai hari ini',
            cls: 'border-indigo-200 bg-indigo-50 dark:bg-indigo-950/40',
            valCls: 'text-indigo-700 dark:text-indigo-300',
        } : {
            label: 'Total Transaksi',
            value: safeStats.transactionCountMonth.toString(),
            sub: `transaksi di ${monthLabel}`,
            cls: 'border-indigo-200 bg-indigo-50 dark:bg-indigo-950/40',
            valCls: 'text-indigo-700 dark:text-indigo-300',
        },
        {
            label: isCurrentMonth ? 'Penjualan Bulan Ini' : `Omzet ${monthLabel}`,
            value: formatRp(safeStats.salesThisMonth),
            sub: isCurrentMonth ? 'total omzet bulan ini' : 'total omzet periode ini',
            cls: 'border-violet-200 bg-violet-50 dark:bg-violet-950/40',
            valCls: 'text-violet-700 dark:text-violet-300',
        },
        {
            label: 'Pendapatan Bersih',
            value: formatRp(safeStats.netRevenueThisMonth),
            sub: 'omzet dikurangi harga beli',
            cls: 'border-emerald-200 bg-emerald-50 dark:bg-emerald-950/40',
            valCls: 'text-emerald-700 dark:text-emerald-300',
        },
        {
            label: 'Total Item',
            value: safeStats.totalItems.toString(),
            sub: 'item terdaftar',
            cls: 'border-border bg-card',
            valCls: '',
            link: () => router.visit(route('item.index')),
            linkLabel: 'Lihat semua →',
        },
        {
            label: 'Stok Minim',
            value: safeStats.lowStockCount.toString(),
            sub: 'item di bawah minimum',
            cls: safeStats.lowStockCount > 0
                ? 'border-rose-200 bg-rose-50 dark:bg-rose-950/40'
                : 'border-border bg-card',
            valCls: safeStats.lowStockCount > 0 ? 'text-rose-600 dark:text-rose-400' : '',
            link: () => router.visit(route('item.low_stock')),
            linkLabel: 'Lihat stok minim →',
        },
        {
            label: 'Kategori',
            value: safeStats.categoriesCount.toString(),
            sub: 'kategori produk',
            cls: 'border-border bg-card',
            valCls: '',
            link: () => router.visit(route('kategori.index')),
            linkLabel: 'Lihat kategori →',
        },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Dashboard" />
            <div className="flex flex-col gap-5 p-4 md:p-6">

                {/* ── Month filter + context bar ── */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3 flex-wrap">
                        {warehouseContext && (
                            <div className="flex items-center gap-2 rounded-lg border border-cyan-200 bg-cyan-50 dark:bg-cyan-950/30 dark:border-cyan-800 px-4 py-2 text-sm text-cyan-700 dark:text-cyan-300">
                                <span className="font-medium">Gudang:</span>
                                <span>{warehouseContext}</span>
                            </div>
                        )}
                        {!isCurrentMonth && (
                            <div className="flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 dark:bg-violet-950/30 dark:border-violet-800 px-3 py-1.5 text-xs text-violet-700 dark:text-violet-300">
                                <span>Melihat data:</span>
                                <span className="font-semibold">{monthLabel}</span>
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <label className="text-xs text-muted-foreground whitespace-nowrap">Filter:</label>
                        {/* Year dropdown */}
                        <select
                            value={selectedYear}
                            onChange={e => handleYearChange(e.target.value)}
                            className="rounded-lg border px-3 py-1.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                            {availableYears.map(y => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                        {/* Month dropdown — only shows months available in selected year */}
                        <select
                            value={selectedMonthNum}
                            onChange={e => handleMonthNumChange(e.target.value)}
                            className="rounded-lg border px-3 py-1.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                            {monthsForYear.map(m => {
                                const num = m.value.slice(5, 7);
                                return (
                                    <option key={m.value} value={num}>
                                        {MONTH_NAMES[parseInt(num, 10) - 1]}
                                    </option>
                                );
                            })}
                        </select>
                        {!isCurrentMonth && (
                            <button
                                onClick={() => handleMonthChange(new Date().toISOString().slice(0, 7))}
                                className="rounded-lg border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted transition-colors"
                            >
                                Bulan Ini
                            </button>
                        )}
                    </div>
                </div>

                {safeStats.itemsWithNoMinimum > 0 && (
                    <div className="mx-4 mt-4 flex items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 px-4 py-2 text-sm text-amber-700 dark:text-amber-300">
                        <div className="flex items-center gap-2">
                            <span className="font-medium">{safeStats.itemsWithNoMinimum} item belum memiliki stok minimum.</span>
                            <span className="text-amber-600 dark:text-amber-400">Atur stok minimum agar alert bisa berfungsi.</span>
                        </div>
                        <a href="/items" className="shrink-0 rounded bg-amber-600 px-3 py-1 text-xs font-medium text-white hover:bg-amber-700 transition">
                            Atur sekarang →
                        </a>
                    </div>
                )}

                {/* ── Row 1: KPI Cards ── */}
                <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
                    {/* Revenue card with sparkline */}
                    <div className={`rounded-xl border p-4 flex flex-col gap-1 shadow-sm col-span-2 md:col-span-1 ${kpiCards[0].cls}`}>
                        <span className="text-xs text-muted-foreground uppercase tracking-wide leading-tight">{kpiCards[0].label}</span>
                        <span className={`text-2xl font-bold mt-0.5 ${kpiCards[0].valCls}`}>{kpiCards[0].value}</span>
                        <span className="text-xs text-muted-foreground">{kpiCards[0].sub}</span>
                        {revenueTrend.length > 0 && (
                            <div className="mt-1 -mx-1">
                                <ResponsiveContainer width="100%" height={40}>
                                    <BarChart data={revenueTrend} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                                        <Bar dataKey="revenue" fill="oklch(0.511 0.262 277)" radius={[2, 2, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </div>
                    {/* Remaining KPI cards */}
                    {kpiCards.slice(1).map((card) => (
                        <div key={card.label} className={`rounded-xl border p-4 flex flex-col gap-1 shadow-sm ${card.cls}`}>
                            <span className="text-xs text-muted-foreground uppercase tracking-wide leading-tight">{card.label}</span>
                            <span className={`text-2xl font-bold mt-0.5 ${card.valCls}`}>{card.value}</span>
                            <span className="text-xs text-muted-foreground">{card.sub}</span>
                            {card.link && (
                                <span
                                    className="text-xs text-primary cursor-pointer hover:underline mt-1"
                                    onClick={card.link}
                                >
                                    {card.linkLabel}
                                </span>
                            )}
                        </div>
                    ))}
                </div>

                {/* ── Row 2: New Widgets ── */}
                <div className="grid gap-4 lg:grid-cols-3">

                    {/* Top 5 Products */}
                    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-3 border-b">
                            <h2 className="text-sm font-semibold">
                                {isCurrentMonth ? 'Top Produk Hari Ini' : `Top Produk ${monthLabel}`}
                            </h2>
                            <a href={route('report.abc')} className="text-xs text-primary hover:underline">Lihat Semua →</a>
                        </div>
                        {topProducts.length === 0 ? (
                            <div className="flex items-center justify-center h-28 text-xs text-muted-foreground">
                                {isCurrentMonth ? 'Belum ada penjualan hari ini' : `Tidak ada data untuk ${monthLabel}`}
                            </div>
                        ) : (
                            <div className="divide-y">
                                {topProducts.map((p, i) => (
                                    <div key={p.name} className="flex items-center gap-3 px-4 py-2.5">
                                        <span className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-xs font-bold flex items-center justify-center shrink-0">
                                            {i + 1}
                                        </span>
                                        <span className="flex-1 text-xs font-medium truncate">{p.name}</span>
                                        <div className="text-right shrink-0">
                                            <span className="text-xs font-semibold tabular-nums">{p.qtySold} pcs</span>
                                            <span className="block text-xs text-muted-foreground tabular-nums">{formatRp(p.revenue)}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Stock Alerts */}
                    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-3 border-b">
                            <div className="flex items-center gap-2">
                                <h2 className="text-sm font-semibold">Stok Minim</h2>
                                {stockAlerts.count > 0 && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300">
                                        {stockAlerts.count}
                                    </span>
                                )}
                            </div>
                            <a href={route('item.low_stock')} className="text-xs text-primary hover:underline">Lihat Semua →</a>
                        </div>
                        {stockAlerts.items.length === 0 ? (
                            <div className="flex items-center justify-center h-28 text-xs text-muted-foreground">
                                Semua stok aman
                            </div>
                        ) : (
                            <div className="divide-y">
                                {stockAlerts.items.map((item) => (
                                    <div key={item.name + (item.outletName ?? '')} className="flex items-center gap-3 px-4 py-2.5">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-medium truncate">{item.name}</p>
                                            {item.outletName && (
                                                <p className="text-xs text-muted-foreground truncate">{item.outletName}</p>
                                            )}
                                        </div>
                                        <div className="text-right shrink-0">
                                            <span className={`text-xs font-bold tabular-nums ${item.stock === 0 ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400'}`}>
                                                {item.stock}
                                            </span>
                                            <span className="text-xs text-muted-foreground tabular-nums">/{item.stockMin}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Recent Transactions */}
                    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-3 border-b">
                            <h2 className="text-sm font-semibold">Transaksi Terakhir</h2>
                            <span className="text-xs text-primary cursor-pointer hover:underline" onClick={() => router.visit(route('pos.index'))}>
                                Lihat Semua →
                            </span>
                        </div>
                        {recentTransactions.length === 0 ? (
                            <div className="flex items-center justify-center h-28 text-xs text-muted-foreground">
                                Belum ada transaksi
                            </div>
                        ) : (
                            <div className="divide-y">
                                {recentTransactions.map((t) => (
                                    <div
                                        key={t.id}
                                        className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/40 cursor-pointer transition-colors"
                                        onClick={() => router.visit(route('pos.show', t.id))}
                                    >
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-mono text-primary truncate">{t.saleNumber}</p>
                                            <p className="text-xs text-muted-foreground">{t.cashierName} · {t.occurredAt}</p>
                                        </div>
                                        <span className="text-xs font-semibold tabular-nums shrink-0">{formatRp(t.grandTotal)}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Row 3: Charts ── */}
                <div className="grid gap-4 lg:grid-cols-3">

                    {/* Sales trend (area chart) — 2/3 width */}
                    <div className="lg:col-span-2 rounded-xl border bg-card p-4 shadow-sm">
                        <h2 className="text-sm font-semibold mb-4">
                            {isCurrentMonth ? 'Penjualan 7 Hari Terakhir' : `Penjualan Harian — ${monthLabel}`}
                        </h2>
                        <ResponsiveContainer width="100%" height={220}>
                            <AreaChart data={salesChart} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%"  stopColor="oklch(0.511 0.262 277)" stopOpacity={0.25} />
                                        <stop offset="95%" stopColor="oklch(0.511 0.262 277)" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                                <YAxis tickFormatter={(v) => formatRp(v)} tick={{ fontSize: 10 }} width={72} />
                                <Tooltip content={<TooltipRp />} />
                                <Area
                                    type="monotone"
                                    dataKey="total"
                                    stroke="oklch(0.511 0.262 277)"
                                    strokeWidth={2}
                                    fill="url(#salesGrad)"
                                    name="total"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Top 5 items (horizontal bar) — 1/3 width */}
                    <div className="rounded-xl border bg-card p-4 shadow-sm">
                        <h2 className="text-sm font-semibold mb-4">
                            {isCurrentMonth ? 'Top 5 Item Terjual Bulan Ini' : `Top 5 Item — ${monthLabel}`}
                        </h2>
                        {topItems.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center mt-10">Belum ada data</p>
                        ) : (
                            <ResponsiveContainer width="100%" height={220}>
                                <BarChart
                                    data={topItems}
                                    layout="vertical"
                                    margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
                                    <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} domain={[0, 'dataMax']} />
                                    <YAxis
                                        type="category"
                                        dataKey="name"
                                        tick={{ fontSize: 10 }}
                                        width={90}
                                        tickFormatter={(v: string) => v.length > 12 ? v.slice(0, 12) + '…' : v}
                                    />
                                    <Tooltip formatter={(v: any) => [`${v} pcs`, 'Terjual']} />
                                    <Bar dataKey="qty" fill="oklch(0.769 0.188 70)" radius={[0, 4, 4, 0]} name="qty" />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>

                {/* ── Branch performance widget (admin only) ── */}
                {branchStats && branchStats.length > 1 && (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Kinerja Cabang Hari Ini</h2>
                            <a href="/report/branches" className="text-xs text-primary hover:underline">Lihat Semua →</a>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {branchStats.map(b => (
                                <div key={b.id} className="rounded-xl border bg-card p-4">
                                    <div className="flex items-start justify-between mb-2">
                                        <div>
                                            <div className="font-semibold text-sm">{b.name}</div>
                                            {b.city && <div className="text-xs text-muted-foreground">{b.city}</div>}
                                        </div>
                                        <span className="text-xs text-muted-foreground tabular-nums">{b.trxToday} trx</span>
                                    </div>
                                    <div className="text-lg font-bold tabular-nums">
                                        {'Rp ' + b.salesToday.toLocaleString('id-ID')}
                                    </div>
                                    <div className="text-xs text-muted-foreground mt-0.5">
                                        Bulan ini: {'Rp ' + b.salesMonth.toLocaleString('id-ID')}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── Row 4: Tables ── */}
                <div className="grid gap-4 lg:grid-cols-2">

                    {/* Recent sales */}
                    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-3 border-b">
                            <h2 className="text-sm font-semibold">
                                {isCurrentMonth ? 'Transaksi Penjualan Terbaru' : `Transaksi — ${monthLabel}`}
                            </h2>
                            <span
                                className="text-xs text-primary cursor-pointer hover:underline"
                                onClick={() => router.visit(route('pos.index'))}
                            >
                                Lihat semua →
                            </span>
                        </div>
                        <table className="w-full text-sm">
                            <thead className="bg-muted/50">
                                <tr>
                                    <th className="text-left px-4 py-2 font-medium text-xs">No. Transaksi</th>
                                    <th className="text-left px-4 py-2 font-medium text-xs">Kasir</th>
                                    <th className="text-left px-4 py-2 font-medium text-xs">Waktu</th>
                                    <th className="text-right px-4 py-2 font-medium text-xs">Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {recentSales.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="text-center py-8 text-muted-foreground text-xs">
                                            Belum ada transaksi
                                        </td>
                                    </tr>
                                ) : recentSales.map((s) => (
                                    <tr
                                        key={s.id}
                                        className="hover:bg-muted/40 cursor-pointer transition-colors"
                                        onClick={() => router.visit(route('pos.show', s.id))}
                                    >
                                        <td className="px-4 py-2.5 font-mono text-xs text-primary">{s.saleNumber}</td>
                                        <td className="px-4 py-2.5 text-xs">{s.cashier}</td>
                                        <td className="px-4 py-2.5 text-xs text-muted-foreground">{s.occurredAt}</td>
                                        <td className="px-4 py-2.5 text-right font-semibold text-xs">{formatRpFull(s.grandTotal)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Low stock alert */}
                    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-3 border-b">
                            <h2 className="text-sm font-semibold">Alert Stok Minim</h2>
                            <span
                                className="text-xs text-primary cursor-pointer hover:underline"
                                onClick={() => router.visit(route('item.low_stock'))}
                            >
                                Lihat semua →
                            </span>
                        </div>
                        <table className="w-full text-sm">
                            <thead className="bg-muted/50">
                                <tr>
                                    <th className="text-left px-4 py-2 font-medium text-xs">Item</th>
                                    <th className="text-right px-4 py-2 font-medium text-xs">Stok</th>
                                    <th className="text-right px-4 py-2 font-medium text-xs">Minimum</th>
                                    <th className="text-right px-4 py-2 font-medium text-xs">Kurang</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {lowStockItems.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="text-center py-8 text-muted-foreground text-xs">
                                            Semua stok aman
                                        </td>
                                    </tr>
                                ) : lowStockItems.map((item) => (
                                    <tr
                                        key={item.id}
                                        className={`transition-colors cursor-pointer ${item.stock === 0 ? 'bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-950/50' : 'hover:bg-muted/40'}`}
                                        onClick={() => router.visit(route('item.index'))}
                                    >
                                        <td className="px-4 py-2.5 text-xs font-medium">{item.name}</td>
                                        <td className={`px-4 py-2.5 text-right text-xs font-bold ${item.stock === 0 ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400'}`}>
                                            {item.stock}
                                        </td>
                                        <td className="px-4 py-2.5 text-right text-xs text-muted-foreground">{item.minimum}</td>
                                        <td className="px-4 py-2.5 text-right text-xs">
                                            <span className="inline-flex px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300 font-semibold">
                                                -{item.deficit}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>
        </AppLayout>
    );
}
