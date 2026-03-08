import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
];

interface DashboardStats {
    totalItems: number;
    lowStockCount: number;
    categoriesCount: number;
    stockInThisMonth: number;
    stockOutThisMonth: number;
}

interface RecentMovement {
    id: number;
    date: string;
    itemName: string;
    direction: 'IN' | 'OUT';
    quantity: number;
    party: string | null;
}

interface PageProps {
    stats: DashboardStats;
    recentMovements: RecentMovement[];
    [key: string]: unknown;
}

export default function Dashboard() {
    const { props } = usePage<PageProps>();
    const { stats, recentMovements } = props;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Dashboard" />
            <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4 overflow-x-auto">

                {/* Stat cards */}
                <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
                    {/* Total Items */}
                    <div className="rounded-xl border bg-white dark:bg-background p-4 flex flex-col gap-1 shadow-sm">
                        <span className="text-xs text-muted-foreground uppercase tracking-wide">Total Item</span>
                        <span className="text-3xl font-bold">{stats.totalItems}</span>
                        <span
                            className="text-xs text-primary cursor-pointer hover:underline mt-1"
                            onClick={() => router.visit(route('item.index'))}
                        >
                            Lihat semua →
                        </span>
                    </div>

                    {/* Low Stock */}
                    <div className={`rounded-xl border p-4 flex flex-col gap-1 shadow-sm ${stats.lowStockCount > 0 ? 'bg-rose-50 border-rose-200 dark:bg-rose-950' : 'bg-white dark:bg-background'}`}>
                        <span className="text-xs text-muted-foreground uppercase tracking-wide">Stok Minim</span>
                        <span className={`text-3xl font-bold ${stats.lowStockCount > 0 ? 'text-rose-600' : ''}`}>
                            {stats.lowStockCount}
                        </span>
                        <span
                            className="text-xs text-primary cursor-pointer hover:underline mt-1"
                            onClick={() => router.visit(route('item.low_stock'))}
                        >
                            Lihat stok minim →
                        </span>
                    </div>

                    {/* Categories */}
                    <div className="rounded-xl border bg-white dark:bg-background p-4 flex flex-col gap-1 shadow-sm">
                        <span className="text-xs text-muted-foreground uppercase tracking-wide">Kategori</span>
                        <span className="text-3xl font-bold">{stats.categoriesCount}</span>
                        <span
                            className="text-xs text-primary cursor-pointer hover:underline mt-1"
                            onClick={() => router.visit(route('kategori.index'))}
                        >
                            Lihat kategori →
                        </span>
                    </div>

                    {/* Stock In This Month */}
                    <div className="rounded-xl border bg-emerald-50 border-emerald-200 dark:bg-emerald-950 p-4 flex flex-col gap-1 shadow-sm">
                        <span className="text-xs text-muted-foreground uppercase tracking-wide">Stock In (Bulan ini)</span>
                        <span className="text-3xl font-bold text-emerald-700">{stats.stockInThisMonth}</span>
                        <span
                            className="text-xs text-emerald-700 cursor-pointer hover:underline mt-1"
                            onClick={() => router.visit(route('Stock_In'))}
                        >
                            Lihat stock in →
                        </span>
                    </div>

                    {/* Stock Out This Month */}
                    <div className="rounded-xl border bg-amber-50 border-amber-200 dark:bg-amber-950 p-4 flex flex-col gap-1 shadow-sm">
                        <span className="text-xs text-muted-foreground uppercase tracking-wide">Stock Out (Bulan ini)</span>
                        <span className="text-3xl font-bold text-amber-700">{stats.stockOutThisMonth}</span>
                        <span
                            className="text-xs text-amber-700 cursor-pointer hover:underline mt-1"
                            onClick={() => router.visit(route('Stock_Out'))}
                        >
                            Lihat stock out →
                        </span>
                    </div>
                </div>

                {/* Recent movements table */}
                <div className="relative flex-1 overflow-hidden rounded-xl border border-sidebar-border/70 dark:border-sidebar-border bg-white dark:bg-background p-4">
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-base font-semibold">Pergerakan Stok Terbaru</h2>
                        <span
                            className="text-xs text-primary cursor-pointer hover:underline"
                            onClick={() => router.visit(route('Stock_History'))}
                        >
                            Lihat semua →
                        </span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full">
                            <thead>
                                <tr className="bg-muted">
                                    <th className="px-4 py-2 text-left text-sm font-medium">Tanggal</th>
                                    <th className="px-4 py-2 text-left text-sm font-medium">Item</th>
                                    <th className="px-4 py-2 text-left text-sm font-medium">Type</th>
                                    <th className="px-4 py-2 text-left text-sm font-medium">Qty</th>
                                    <th className="px-4 py-2 text-left text-sm font-medium">Party</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recentMovements.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="text-center py-8 text-muted-foreground">
                                            Belum ada data pergerakan stok bulan ini.
                                        </td>
                                    </tr>
                                ) : (
                                    recentMovements.map((row) => (
                                        <tr key={row.id} className="border-b last:border-b-0 hover:bg-muted/40 transition">
                                            <td className="px-4 py-2 text-sm">{row.date}</td>
                                            <td className="px-4 py-2 text-sm font-medium">{row.itemName}</td>
                                            <td className="px-4 py-2">
                                                <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold
                                                    ${row.direction === 'IN' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                                    {row.direction}
                                                </span>
                                            </td>
                                            <td className={`px-4 py-2 text-sm font-bold ${row.direction === 'IN' ? 'text-emerald-700' : 'text-rose-700'}`}>
                                                {row.direction === 'OUT' ? '-' : '+'}{row.quantity}
                                            </td>
                                            <td className="px-4 py-2 text-sm text-muted-foreground">{row.party ?? '-'}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
