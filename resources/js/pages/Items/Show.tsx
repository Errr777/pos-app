import AppLayout from '@/layouts/app-layout';
import { Head, Link } from '@inertiajs/react';
import { type BreadcrumbItem } from '@/types';
import { ArrowLeft, Pencil, Package, Tag, Truck } from 'lucide-react';

interface ItemDetail {
    id: number;
    type: 'barang' | 'jasa';
    name: string;
    description: string | null;
    qrcode: string;
    stock: number;
    stockMin: number;
    hargaJual: number;
    hargaBeli: number;
    category: string | null;
    tags: { id: number; name: string; color: string }[];
    preferredSupplierId: number | null;
    preferredSupplierName: string | null;
}

interface StockOutlet {
    warehouseId: number;
    outletName: string;
    stock: number;
    stockMin: number;
}

interface RecentSale {
    saleNumber: string | null;
    occurredAt: string | null;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
}

interface PageProps {
    item: ItemDetail;
    stockByOutlet: StockOutlet[];
    recentSales: RecentSale[];
    canWrite: boolean;
}

function fmt(n: number) {
    return `Rp ${n.toLocaleString('id-ID')}`;
}

function stockBadge(stock: number, min: number) {
    if (min === 0) return null;
    if (stock === 0) return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300">Habis</span>;
    if (stock < min) return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">Minim</span>;
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">Oke</span>;
}

export default function ItemShow({ item, stockByOutlet, recentSales, canWrite }: PageProps) {
    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Dashboard', href: '/dashboard' },
        { title: 'Item List', href: '/item' },
        { title: item.name, href: '#' },
    ];

    const totalStock = stockByOutlet.length > 0
        ? stockByOutlet.reduce((sum, o) => sum + o.stock, 0)
        : item.stock;

    const margin = item.hargaBeli > 0
        ? Math.round(((item.hargaJual - item.hargaBeli) / item.hargaBeli) * 100)
        : null;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={item.name} />
            <div className="p-6 space-y-6 max-w-4xl">

                {/* Header */}
                <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                        <Link href="/item" className="mt-1 p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
                            <ArrowLeft className="h-4 w-4" />
                        </Link>
                        <div>
                            <h1 className="text-2xl font-bold">{item.name}</h1>
                            <div className="flex flex-wrap items-center gap-2 mt-1.5">
                                <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded">{item.qrcode}</span>
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${item.type === 'jasa' ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>
                                    {item.type === 'jasa' ? '🛠️ Jasa' : '📦 Barang'}
                                </span>
                                {item.category && (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                                        {item.category}
                                    </span>
                                )}
                                {item.tags.map(t => (
                                    <span key={t.id} className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium text-white" style={{ backgroundColor: t.color }}>
                                        <Tag className="h-3 w-3 mr-1" />
                                        {t.name}
                                    </span>
                                ))}
                            </div>
                            {item.preferredSupplierName && (
                                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground mt-1">
                                    <Truck className="h-3 w-3" />
                                    {item.preferredSupplierName}
                                </span>
                            )}
                            {item.description && (
                                <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                            )}
                        </div>
                    </div>
                    {canWrite && (
                        <Link
                            href={`/item/${item.id}`}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium hover:bg-muted transition-colors shrink-0"
                        >
                            <Pencil className="h-4 w-4" />
                            Edit
                        </Link>
                    )}
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="rounded-xl border bg-card p-4 shadow-sm">
                        <p className="text-xs text-muted-foreground">Harga Jual</p>
                        <p className="text-lg font-bold mt-0.5">{fmt(item.hargaJual)}</p>
                    </div>
                    {item.type === 'barang' && (
                        <div className="rounded-xl border bg-card p-4 shadow-sm">
                            <p className="text-xs text-muted-foreground">Harga Beli</p>
                            <p className="text-lg font-bold mt-0.5">{fmt(item.hargaBeli)}</p>
                        </div>
                    )}
                    <div className="rounded-xl border bg-card p-4 shadow-sm">
                        <p className="text-xs text-muted-foreground">Margin</p>
                        <p className="text-lg font-bold mt-0.5">{margin !== null ? `${margin}%` : '—'}</p>
                    </div>
                    {item.type === 'barang' && (
                        <div className="rounded-xl border bg-card p-4 shadow-sm">
                            <p className="text-xs text-muted-foreground">Total Stok</p>
                            <p className="text-lg font-bold mt-0.5">{totalStock.toLocaleString('id-ID')}</p>
                        </div>
                    )}
                </div>

                {/* Stock by Outlet — only for barang */}
                {item.type === 'barang' && stockByOutlet.length > 0 && (
                    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
                        <div className="px-4 py-3 border-b flex items-center gap-2">
                            <Package className="h-4 w-4 text-muted-foreground" />
                            <h2 className="font-semibold text-sm">Stok per Outlet</h2>
                        </div>
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b bg-muted/40">
                                    <th className="text-left px-4 py-2.5 font-medium">Outlet</th>
                                    <th className="text-right px-4 py-2.5 font-medium">Stok</th>
                                    <th className="text-right px-4 py-2.5 font-medium">Minimum</th>
                                    <th className="text-center px-4 py-2.5 font-medium">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {stockByOutlet.map(o => (
                                    <tr key={o.warehouseId} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                                        <td className="px-4 py-2.5 font-medium">{o.outletName}</td>
                                        <td className="px-4 py-2.5 text-right tabular-nums">{o.stock.toLocaleString('id-ID')}</td>
                                        <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{o.stockMin > 0 ? o.stockMin : '—'}</td>
                                        <td className="px-4 py-2.5 text-center">{stockBadge(o.stock, o.stockMin)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Recent Sales */}
                <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
                    <div className="px-4 py-3 border-b">
                        <h2 className="font-semibold text-sm">Riwayat Penjualan (10 Terakhir)</h2>
                    </div>
                    {recentSales.length === 0 ? (
                        <div className="flex items-center justify-center h-24 text-sm text-muted-foreground">
                            Belum ada riwayat penjualan.
                        </div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b bg-muted/40">
                                    <th className="text-left px-4 py-2.5 font-medium">Tanggal</th>
                                    <th className="text-left px-4 py-2.5 font-medium">No. Transaksi</th>
                                    <th className="text-right px-4 py-2.5 font-medium">Qty</th>
                                    <th className="text-right px-4 py-2.5 font-medium">Harga Satuan</th>
                                    <th className="text-right px-4 py-2.5 font-medium">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recentSales.map((s, i) => (
                                    <tr key={i} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                                        <td className="px-4 py-2.5 text-muted-foreground text-xs tabular-nums whitespace-nowrap">{s.occurredAt ?? '—'}</td>
                                        <td className="px-4 py-2.5 font-mono text-xs">{s.saleNumber ?? '—'}</td>
                                        <td className="px-4 py-2.5 text-right tabular-nums">{s.quantity}</td>
                                        <td className="px-4 py-2.5 text-right tabular-nums">{fmt(s.unitPrice)}</td>
                                        <td className="px-4 py-2.5 text-right tabular-nums font-medium">{fmt(s.lineTotal)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </AppLayout>
    );
}
