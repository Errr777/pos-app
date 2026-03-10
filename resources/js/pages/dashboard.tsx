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
    categoriesCount: number;
    salesToday: number;
    salesThisMonth: number;
    netRevenueThisMonth: number;
}

interface SalesChartPoint { date: string; total: number; count: number; }
interface TopItem        { name: string; qty: number; }
interface RecentSale     { id: number; saleNumber: string; cashier: string; grandTotal: number; occurredAt: string; }
interface LowStockItem   { id: number; name: string; stock: number; minimum: number; deficit: number; }

interface PageProps {
    stats: DashboardStats;
    salesChart: SalesChartPoint[];
    topItems: TopItem[];
    recentSales: RecentSale[];
    lowStockItems: LowStockItem[];
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
    const { stats, salesChart = [], topItems = [], recentSales = [], lowStockItems = [] } = usePage<PageProps>().props;
    const safeStats: DashboardStats = {
        ...(stats ?? { totalItems: 0, lowStockCount: 0, categoriesCount: 0, salesToday: 0, salesThisMonth: 0, netRevenueThisMonth: 0 }),
    };

    const kpiCards = [
        {
            label: 'Penjualan Hari Ini',
            value: formatRp(safeStats.salesToday),
            sub: 'transaksi selesai hari ini',
            cls: 'border-indigo-200 bg-indigo-50 dark:bg-indigo-950/40',
            valCls: 'text-indigo-700 dark:text-indigo-300',
        },
        {
            label: 'Penjualan Bulan Ini',
            value: formatRp(safeStats.salesThisMonth),
            sub: 'total omzet bulan ini',
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

                {/* ── Row 1: KPI Cards ── */}
                <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
                    {kpiCards.map((card) => (
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

                {/* ── Row 2: Charts ── */}
                <div className="grid gap-4 lg:grid-cols-3">

                    {/* Sales trend (area chart) — 2/3 width */}
                    <div className="lg:col-span-2 rounded-xl border bg-card p-4 shadow-sm">
                        <h2 className="text-sm font-semibold mb-4">Penjualan 7 Hari Terakhir</h2>
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
                        <h2 className="text-sm font-semibold mb-4">Top 5 Item Terjual Bulan Ini</h2>
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
                                    <XAxis type="number" tick={{ fontSize: 10 }} />
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

                {/* ── Row 3: Tables ── */}
                <div className="grid gap-4 lg:grid-cols-2">

                    {/* Recent sales */}
                    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-3 border-b">
                            <h2 className="text-sm font-semibold">Transaksi Penjualan Terbaru</h2>
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
