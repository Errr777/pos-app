import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { router, usePage } from '@inertiajs/react';
import { Search, AlertTriangle, Package, ArrowDownToLine, ArrowUpFromLine, Settings2 } from 'lucide-react';
import { useState } from 'react';

interface WarehouseInfo {
    id: number;
    code: string;
    name: string;
    location: string | null;
    description: string | null;
    is_default: boolean;
    is_active: boolean;
}

interface Stats {
    itemCount: number;
    lowStockCount: number;
    totalStock: number;
}

interface ItemRow {
    itemId: number;
    name: string;
    qrcode: string | null;
    category: string | null;
    stock: number;
    stockMin: number;
    isLow: boolean;
}

interface LowStockRow {
    itemId: number;
    name: string;
    qrcode: string | null;
    category: string | null;
    stock: number;
    stockMin: number;
    shortage: number;
}

interface MovementRow {
    id: number;
    date: string;
    itemName: string;
    direction: 'IN' | 'OUT';
    quantity: number;
    party: string | null;
    reference: string | null;
    actor: string | null;
    note: string | null;
}

interface Paginated<T> {
    data: T[];
    current_page: number;
    last_page: number;
    total: number;
}

interface PageProps {
    warehouse: WarehouseInfo;
    stats: Stats;
    tab: string;
    items: Paginated<ItemRow> | null;
    lowStockItems: Paginated<LowStockRow> | null;
    movements: Paginated<MovementRow> | null;
    filters: { search: string };
    flash?: { success?: string };
    [key: string]: unknown;
}

function pad(n: number) { return String(n).padStart(2, '0'); }
function formatDate(iso: string | null | undefined): string {
    if (!iso) return '-';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '-';
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function WarehouseShow() {
    const { warehouse, stats, tab, items, lowStockItems, movements, filters, flash } =
        usePage<PageProps>().props;

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Gudang', href: '/warehouses' },
        { title: warehouse.name, href: route('warehouses.show', { warehouse: warehouse.id }) },
    ];

    const [search, setSearch] = useState(filters.search ?? '');

    // Set min stock modal
    const [minModal, setMinModal] = useState<{ itemId: number; name: string; current: number } | null>(null);
    const [minValue, setMinValue] = useState(0);

    function navigate(overrides: Record<string, unknown> = {}) {
        router.get(
            route('warehouses.show', { warehouse: warehouse.id }),
            { tab, search, ...overrides },
            { preserveState: true, replace: true },
        );
    }

    function switchTab(t: string) {
        navigate({ tab: t, search: '' });
        setSearch('');
    }

    function handleSearch(e: React.FormEvent) {
        e.preventDefault();
        navigate({ search });
    }

    function handlePage(page: number) {
        navigate({ page });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function openMinModal(row: ItemRow | LowStockRow) {
        setMinModal({ itemId: row.itemId, name: row.name, current: row.stockMin });
        setMinValue(row.stockMin);
    }

    function submitMin() {
        if (!minModal) return;
        router.put(
            route('warehouses.item_min', { warehouse: warehouse.id, item: minModal.itemId }),
            { stok_minimal: minValue },
            { onSuccess: () => setMinModal(null) },
        );
    }

    const tabs = [
        { key: 'items',     label: 'Semua Item',    count: stats.itemCount },
        { key: 'low_stock', label: 'Stok Minim',    count: stats.lowStockCount, alert: stats.lowStockCount > 0 },
        { key: 'log',       label: 'Log Transaksi',  count: null },
    ];

    const paged = tab === 'items' ? items : tab === 'low_stock' ? lowStockItems : movements;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <div className="p-6 space-y-5">
                {/* Header */}
                <div>
                    <div className="flex items-center gap-2">
                        <h1 className="text-xl font-semibold">{warehouse.name}</h1>
                        <span className="font-mono text-sm text-muted-foreground">({warehouse.code})</span>
                        {warehouse.is_default && (
                            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">Utama</span>
                        )}
                        {!warehouse.is_active && (
                            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">Nonaktif</span>
                        )}
                    </div>
                    {warehouse.location && (
                        <p className="text-sm text-muted-foreground">{warehouse.location}</p>
                    )}
                    {warehouse.description && (
                        <p className="text-sm text-muted-foreground">{warehouse.description}</p>
                    )}
                </div>

                {/* Flash */}
                {flash?.success && (
                    <div className="rounded-md border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-800">
                        {flash.success}
                    </div>
                )}

                {/* Stats */}
                <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-lg border bg-card p-4 text-center shadow-sm">
                        <div className="flex items-center justify-center gap-1.5 text-muted-foreground mb-1">
                            <Package className="h-4 w-4" />
                            <span className="text-xs">Total Item</span>
                        </div>
                        <div className="text-2xl font-bold">{stats.itemCount}</div>
                    </div>
                    <div className="rounded-lg border bg-card p-4 text-center shadow-sm">
                        <div className="text-xs text-muted-foreground mb-1">Total Stok</div>
                        <div className="text-2xl font-bold">{stats.totalStock.toLocaleString()}</div>
                    </div>
                    <div className={`rounded-lg border p-4 text-center shadow-sm ${stats.lowStockCount > 0 ? 'border-red-200 bg-red-50' : 'bg-card'}`}>
                        <div className="flex items-center justify-center gap-1.5 text-muted-foreground mb-1">
                            {stats.lowStockCount > 0 && <AlertTriangle className="h-4 w-4 text-red-500" />}
                            <span className="text-xs">Stok Minim</span>
                        </div>
                        <div className={`text-2xl font-bold ${stats.lowStockCount > 0 ? 'text-red-600' : ''}`}>
                            {stats.lowStockCount}
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="border-b flex gap-0">
                    {tabs.map((t) => (
                        <button
                            key={t.key}
                            onClick={() => switchTab(t.key)}
                            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
                                tab === t.key
                                    ? 'border-primary text-primary'
                                    : 'border-transparent text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            {t.label}
                            {t.count !== null && (
                                <span className={`rounded-full px-1.5 py-0.5 text-xs ${
                                    t.alert ? 'bg-red-100 text-red-700' : 'bg-muted text-muted-foreground'
                                }`}>
                                    {t.count}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Search */}
                <form onSubmit={handleSearch} className="flex gap-2">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            onBlur={() => navigate({ search })}
                            placeholder={tab === 'log' ? 'Cari item / party / ref...' : 'Cari item / kategori...'}
                            className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                    </div>
                </form>

                {/* ── Items tab ─────────────────────────────────────────────── */}
                {tab === 'items' && items && (
                    <div className="overflow-x-auto">
                        <table className="min-w-full border rounded-xl text-sm">
                            <thead>
                                <tr className="bg-muted">
                                    <th className="px-4 py-2 text-left">Item</th>
                                    <th className="px-4 py-2 text-left">Kategori</th>
                                    <th className="px-4 py-2 text-right">Stok</th>
                                    <th className="px-4 py-2 text-right">Stok Min</th>
                                    <th className="px-4 py-2 text-center">Status</th>
                                    <th className="px-4 py-2 text-center">Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.data.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="py-8 text-center text-muted-foreground">
                                            Tidak ada item di gudang ini
                                        </td>
                                    </tr>
                                ) : (
                                    items.data.map((row) => (
                                        <tr key={row.itemId} className="border-b last:border-0">
                                            <td className="px-4 py-2">
                                                <div className="font-medium">{row.name}</div>
                                                {row.qrcode && (
                                                    <div className="text-xs text-muted-foreground font-mono">{row.qrcode}</div>
                                                )}
                                            </td>
                                            <td className="px-4 py-2 text-muted-foreground">{row.category || '-'}</td>
                                            <td className="px-4 py-2 text-right font-mono font-semibold">
                                                {row.stock.toLocaleString()}
                                            </td>
                                            <td className="px-4 py-2 text-right text-muted-foreground">
                                                {row.stockMin.toLocaleString()}
                                            </td>
                                            <td className="px-4 py-2 text-center">
                                                {row.isLow ? (
                                                    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">
                                                        <AlertTriangle className="h-3 w-3" /> Minim
                                                    </span>
                                                ) : (
                                                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">
                                                        Normal
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-2 text-center">
                                                <button
                                                    onClick={() => openMinModal(row)}
                                                    className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs hover:bg-accent"
                                                    title="Set stok minimum"
                                                >
                                                    <Settings2 className="h-3 w-3" /> Set Min
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* ── Low Stock tab ──────────────────────────────────────────── */}
                {tab === 'low_stock' && lowStockItems && (
                    <div className="overflow-x-auto">
                        {lowStockItems.data.length === 0 ? (
                            <div className="rounded-lg border border-green-200 bg-green-50 p-6 text-center text-sm text-green-700">
                                Tidak ada item dengan stok di bawah minimum. Semua stok aman!
                            </div>
                        ) : (
                            <table className="min-w-full border rounded-xl text-sm">
                                <thead>
                                    <tr className="bg-red-50">
                                        <th className="px-4 py-2 text-left">Item</th>
                                        <th className="px-4 py-2 text-left">Kategori</th>
                                        <th className="px-4 py-2 text-right">Stok Saat Ini</th>
                                        <th className="px-4 py-2 text-right">Stok Min</th>
                                        <th className="px-4 py-2 text-right text-red-600">Kekurangan</th>
                                        <th className="px-4 py-2 text-center">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {lowStockItems.data.map((row) => (
                                        <tr key={row.itemId} className="border-b last:border-0">
                                            <td className="px-4 py-2">
                                                <div className="font-medium">{row.name}</div>
                                                {row.qrcode && (
                                                    <div className="text-xs text-muted-foreground font-mono">{row.qrcode}</div>
                                                )}
                                            </td>
                                            <td className="px-4 py-2 text-muted-foreground">{row.category || '-'}</td>
                                            <td className="px-4 py-2 text-right font-mono font-bold text-red-600">
                                                {row.stock.toLocaleString()}
                                            </td>
                                            <td className="px-4 py-2 text-right text-muted-foreground">
                                                {row.stockMin.toLocaleString()}
                                            </td>
                                            <td className="px-4 py-2 text-right font-bold text-red-700">
                                                -{row.shortage.toLocaleString()}
                                            </td>
                                            <td className="px-4 py-2 text-center">
                                                <button
                                                    onClick={() => openMinModal(row)}
                                                    className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs hover:bg-accent"
                                                >
                                                    <Settings2 className="h-3 w-3" /> Set Min
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                )}

                {/* ── Log tab ────────────────────────────────────────────────── */}
                {tab === 'log' && movements && (
                    <div className="overflow-x-auto">
                        <table className="min-w-full border rounded-xl text-sm">
                            <thead>
                                <tr className="bg-muted">
                                    <th className="px-4 py-2 text-left">Tanggal</th>
                                    <th className="px-4 py-2 text-left">Item</th>
                                    <th className="px-4 py-2 text-center">Tipe</th>
                                    <th className="px-4 py-2 text-right">Qty</th>
                                    <th className="px-4 py-2 text-left">Party</th>
                                    <th className="px-4 py-2 text-left">Ref</th>
                                    <th className="px-4 py-2 text-left">Actor</th>
                                </tr>
                            </thead>
                            <tbody>
                                {movements.data.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="py-8 text-center text-muted-foreground">
                                            Belum ada transaksi di gudang ini
                                        </td>
                                    </tr>
                                ) : (
                                    movements.data.map((row) => (
                                        <tr key={row.id} className="border-b last:border-0">
                                            <td className="px-4 py-2 text-muted-foreground">{formatDate(row.date)}</td>
                                            <td className="px-4 py-2 font-medium">{row.itemName}</td>
                                            <td className="px-4 py-2 text-center">
                                                {row.direction === 'IN' ? (
                                                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">
                                                        <ArrowDownToLine className="h-3 w-3" /> IN
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
                                                        <ArrowUpFromLine className="h-3 w-3" /> OUT
                                                    </span>
                                                )}
                                            </td>
                                            <td className={`px-4 py-2 text-right font-mono font-semibold ${row.direction === 'IN' ? 'text-emerald-600' : 'text-amber-600'}`}>
                                                {row.direction === 'IN' ? '+' : '-'}{row.quantity}
                                            </td>
                                            <td className="px-4 py-2 text-muted-foreground">{row.party || '-'}</td>
                                            <td className="px-4 py-2 text-muted-foreground">{row.reference || '-'}</td>
                                            <td className="px-4 py-2 text-muted-foreground">{row.actor || '-'}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination */}
                {paged && paged.last_page > 1 && (
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">
                            Halaman {paged.current_page} / {paged.last_page} &nbsp;·&nbsp; {paged.total} data
                        </span>
                        <div className="flex gap-1">
                            {Array.from({ length: paged.last_page }).map((_, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => handlePage(idx + 1)}
                                    className={`px-3 py-1 rounded border text-sm ${paged.current_page === idx + 1 ? 'bg-primary text-white' : 'bg-muted'}`}
                                >
                                    {idx + 1}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* ── Set Min Stock Modal ─────────────────────────────────────────── */}
            {minModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="w-full max-w-sm rounded-lg border bg-background p-6 shadow-lg space-y-4">
                        <h2 className="font-semibold">Set Stok Minimum</h2>
                        <p className="text-sm text-muted-foreground">
                            <strong>{minModal.name}</strong> di {warehouse.name}
                        </p>
                        <div>
                            <label className="text-sm font-medium">Stok Minimum</label>
                            <input
                                type="number"
                                min={0}
                                value={minValue}
                                onChange={(e) => setMinValue(Number(e.target.value))}
                                className="mt-1 block w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                                Notifikasi akan muncul jika stok di gudang ini di bawah nilai ini
                            </p>
                        </div>
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setMinModal(null)} className="rounded-md border px-3 py-2 text-sm hover:bg-accent">
                                Batal
                            </button>
                            <button onClick={submitMin} className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground hover:bg-primary/90">
                                Simpan
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AppLayout>
    );
}
