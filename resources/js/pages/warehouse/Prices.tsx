import { decodePaginatorLabel } from '@/lib/formats';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem, type SharedData } from '@/types';
import { router, usePage } from '@inertiajs/react';
import {
    ArrowLeft, RefreshCw, RotateCcw, Search, Tag, CheckCircle2,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface WarehouseInfo {
    id: number; code: string; name: string; is_default: boolean;
}

interface PriceRow {
    item_id: number;
    kode_item: string;
    nama: string;
    kategori: string | null;
    global_price: number;
    outlet_price: number;
    stok: number;
}

interface PaginatedPrices {
    data: PriceRow[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
    links: { url: string | null; label: string; active: boolean }[];
}

interface Props {
    warehouse: WarehouseInfo;
    items: PaginatedPrices;
    filters: { search: string };
}

const fmt = (v: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v);

export default function WarehousePrices({ warehouse, items, filters }: Props) {
    const { permissions } = usePage<SharedData>().props;
    const canWrite = permissions.warehouses?.can_write;

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Gudang', href: '/warehouses' },
        { title: warehouse.name, href: `/warehouses/${warehouse.id}` },
        { title: 'Harga Outlet', href: '#' },
    ];

    // ── Search ─────────────────────────────────────────────────────────────────
    const [search, setSearch] = useState(filters.search);
    const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (searchTimer.current) clearTimeout(searchTimer.current);
        searchTimer.current = setTimeout(() => {
            router.get(`/warehouses/${warehouse.id}/prices`, { search }, {
                preserveScroll: true, preserveState: true, replace: true,
            });
        }, 350);
        return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
    }, [search]);

    // ── Inline edit state ──────────────────────────────────────────────────────
    const [editing, setEditing] = useState<Record<number, string>>({}); // itemId → value string
    const [saving,  setSaving]  = useState<Record<number, boolean>>({});
    const [syncing, setSyncing] = useState<Record<number, boolean>>({});
    const [syncingAll, setSyncingAll] = useState(false);
    const [saved,   setSaved]   = useState<Record<number, boolean>>({});

    function startEdit(row: PriceRow) {
        setEditing(prev => ({ ...prev, [row.item_id]: String(row.outlet_price) }));
    }

    function savePrice(row: PriceRow) {
        const newVal = parseInt(editing[row.item_id] ?? '', 10);
        if (isNaN(newVal) || newVal < 0) return;
        setSaving(prev => ({ ...prev, [row.item_id]: true }));

        router.put(
            `/warehouses/${warehouse.id}/items/${row.item_id}/price`,
            { harga_jual: newVal },
            {
                preserveScroll: true,
                preserveState: true,
                onSuccess: () => {
                    setEditing(prev => { const n = { ...prev }; delete n[row.item_id]; return n; });
                    setSaved(prev => ({ ...prev, [row.item_id]: true }));
                    setTimeout(() => setSaved(prev => { const n = { ...prev }; delete n[row.item_id]; return n; }), 2000);
                },
                onFinish: () => setSaving(prev => ({ ...prev, [row.item_id]: false })),
            }
        );
    }

    function syncOne(row: PriceRow) {
        setSyncing(prev => ({ ...prev, [row.item_id]: true }));
        router.post(
            `/warehouses/${warehouse.id}/items/${row.item_id}/price/sync`,
            {},
            {
                preserveScroll: true,
                preserveState: true,
                onFinish: () => setSyncing(prev => ({ ...prev, [row.item_id]: false })),
            }
        );
    }

    function syncAll() {
        if (!confirm(`Sinkronkan semua harga di "${warehouse.name}" ke harga global? Semua kustomisasi akan direset.`)) return;
        setSyncingAll(true);
        router.post(`/warehouses/${warehouse.id}/prices/sync`, {}, {
            preserveScroll: true,
            onFinish: () => setSyncingAll(false),
        });
    }

    function priceDiff(row: PriceRow): 'lower' | 'higher' | 'same' {
        if (row.outlet_price < row.global_price) return 'lower';
        if (row.outlet_price > row.global_price) return 'higher';
        return 'same';
    }

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <div className="space-y-4 p-4">
                {/* Header */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => router.visit(`/warehouses/${warehouse.id}`)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border bg-background hover:bg-muted transition-colors font-medium"
                        >
                            <ArrowLeft className="w-4 h-4" /> Kembali
                        </button>
                        <div>
                            <h1 className="text-xl font-bold flex items-center gap-2">
                                <Tag className="w-5 h-5 text-indigo-500" />
                                Harga Outlet — {warehouse.name}
                            </h1>
                            <p className="text-sm text-muted-foreground mt-0.5">
                                Atur harga jual khusus per produk untuk outlet ini
                            </p>
                        </div>
                    </div>

                    {canWrite && !warehouse.is_default && (
                        <button
                            onClick={syncAll}
                            disabled={syncingAll}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-100 text-amber-800 hover:bg-amber-200 text-sm font-medium transition-colors disabled:opacity-50"
                        >
                            <RefreshCw className={`w-4 h-4 ${syncingAll ? 'animate-spin' : ''}`} />
                            Sinkronkan Semua ke Harga Global
                        </button>
                    )}
                </div>

                {warehouse.is_default && (
                    <div className="rounded-lg border border-indigo-200 bg-indigo-50 dark:bg-indigo-950/30 dark:border-indigo-800 px-4 py-3 text-sm text-indigo-800 dark:text-indigo-300">
                        Ini adalah <strong>Toko Pusat</strong>. Harga di sini mengikuti harga global produk dan menjadi referensi untuk semua outlet.
                    </div>
                )}

                {/* Search */}
                <div className="relative max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Cari produk..."
                        className="w-full pl-9 pr-4 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                </div>

                {/* Table */}
                <div className="rounded-xl border overflow-hidden bg-card">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b bg-muted/40">
                                    <th className="text-left px-4 py-3 font-medium">Produk</th>
                                    <th className="text-left px-4 py-3 font-medium">Kategori</th>
                                    <th className="text-right px-4 py-3 font-medium">Harga Global</th>
                                    <th className="text-right px-4 py-3 font-medium">Harga Outlet</th>
                                    <th className="text-right px-4 py-3 font-medium">Stok</th>
                                    {canWrite && <th className="px-4 py-3" />}
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {items.data.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="text-center py-12 text-muted-foreground">
                                            Tidak ada produk ditemukan.
                                        </td>
                                    </tr>
                                )}
                                {items.data.map(row => {
                                    const diff      = priceDiff(row);
                                    const isEditing = row.item_id in editing;
                                    const isSaving  = saving[row.item_id];
                                    const isSyncing = syncing[row.item_id];
                                    const isSaved   = saved[row.item_id];
                                    const isDirty   = diff !== 'same';

                                    return (
                                        <tr key={row.item_id} className="hover:bg-muted/20 transition-colors">
                                            {/* Product */}
                                            <td className="px-4 py-3">
                                                <div className="font-medium">{row.nama}</div>
                                                <div className="text-xs text-muted-foreground">{row.kode_item}</div>
                                            </td>

                                            {/* Category */}
                                            <td className="px-4 py-3 text-muted-foreground">{row.kategori ?? '-'}</td>

                                            {/* Global price */}
                                            <td className="px-4 py-3 text-right text-muted-foreground">
                                                {fmt(row.global_price)}
                                            </td>

                                            {/* Outlet price — editable */}
                                            <td className="px-4 py-3 text-right">
                                                {isEditing ? (
                                                    <div className="flex items-center justify-end gap-2">
                                                        <input
                                                            type="number"
                                                            min={0}
                                                            value={editing[row.item_id]}
                                                            onChange={e => setEditing(prev => ({ ...prev, [row.item_id]: e.target.value }))}
                                                            onKeyDown={e => { if (e.key === 'Enter') savePrice(row); if (e.key === 'Escape') setEditing(prev => { const n = { ...prev }; delete n[row.item_id]; return n; }); }}
                                                            autoFocus
                                                            className="w-32 text-right border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                        />
                                                        <button
                                                            onClick={() => savePrice(row)}
                                                            disabled={isSaving}
                                                            className="px-2 py-1 rounded bg-indigo-600 text-white text-xs hover:bg-indigo-700 disabled:opacity-50"
                                                        >
                                                            {isSaving ? '...' : 'Simpan'}
                                                        </button>
                                                        <button
                                                            onClick={() => setEditing(prev => { const n = { ...prev }; delete n[row.item_id]; return n; })}
                                                            className="text-xs text-muted-foreground hover:text-foreground"
                                                        >
                                                            Batal
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => canWrite && !warehouse.is_default && startEdit(row)}
                                                        disabled={!canWrite || warehouse.is_default}
                                                        className={`font-medium ${
                                                            diff === 'lower'  ? 'text-amber-600' :
                                                            diff === 'higher' ? 'text-emerald-600' :
                                                            'text-foreground'
                                                        } ${canWrite && !warehouse.is_default ? 'hover:underline cursor-pointer' : ''}`}
                                                        title={canWrite && !warehouse.is_default ? 'Klik untuk edit' : undefined}
                                                    >
                                                        {fmt(row.outlet_price)}
                                                        {diff === 'lower'  && ' ↓'}
                                                        {diff === 'higher' && ' ↑'}
                                                    </button>
                                                )}
                                                {isSaved && (
                                                    <span className="ml-1 text-emerald-500 text-xs inline-flex items-center gap-0.5">
                                                        <CheckCircle2 className="w-3 h-3" /> Tersimpan
                                                    </span>
                                                )}
                                            </td>

                                            {/* Stock */}
                                            <td className="px-4 py-3 text-right text-muted-foreground">{row.stok}</td>

                                            {/* Actions */}
                                            {canWrite && (
                                                <td className="px-4 py-3 text-right">
                                                    {isDirty && !warehouse.is_default && (
                                                        <button
                                                            onClick={() => syncOne(row)}
                                                            disabled={isSyncing}
                                                            title="Reset ke harga global"
                                                            className="text-xs text-muted-foreground hover:text-amber-600 flex items-center gap-1 ml-auto"
                                                        >
                                                            <RotateCcw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                                                            Reset
                                                        </button>
                                                    )}
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {items.last_page > 1 && (
                        <div className="flex items-center justify-between px-4 py-3 border-t text-sm text-muted-foreground">
                            <span>{items.from}–{items.to} dari {items.total} produk</span>
                            <div className="flex gap-1">
                                {items.links.map((link, i) => (
                                    <button
                                        key={i}
                                        disabled={!link.url}
                                        onClick={() => link.url && router.get(link.url, {}, { preserveScroll: true })}
                                        className={`px-2 py-1 rounded text-xs ${link.active ? 'bg-indigo-600 text-white' : 'hover:bg-muted disabled:opacity-40'}`}
                                    >
                                        {decodePaginatorLabel(link.label)}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Legend */}
                <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5"><span className="text-amber-600 font-medium">Rp 0 ↓</span> Harga lebih rendah dari global</span>
                    <span className="flex items-center gap-1.5"><span className="text-emerald-600 font-medium">Rp 0 ↑</span> Harga lebih tinggi dari global</span>
                    <span className="flex items-center gap-1.5">Klik angka untuk mengedit</span>
                </div>
            </div>
        </AppLayout>
    );
}
