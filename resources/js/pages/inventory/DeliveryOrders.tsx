import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem, type SharedData } from '@/types';
import { router, usePage } from '@inertiajs/react';
import {
    ClipboardList, Filter, Package, Plus, Search, Truck, X,
} from 'lucide-react';
import { DatePickerFilter } from '@/components/DatePickerInput';
import { useEffect, useRef, useState } from 'react';

interface Warehouse { id: number; name: string; is_default: boolean; }

interface OrderRow {
    id: number;
    doNumber: string;
    status: 'pending' | 'confirmed' | 'cancelled';
    fromName: string;
    toName: string;
    senderName: string;
    recipientName: string | null;
    itemCount: number;
    sentAt: string | null;
    confirmedAt: string | null;
    createdAt: string | null;
}

interface PaginatedOrders {
    data: OrderRow[];
    current_page: number;
    last_page: number;
    total: number;
    from: number | null;
    to: number | null;
    links: { url: string | null; label: string; active: boolean }[];
}

interface Props {
    orders: PaginatedOrders;
    warehouses: Warehouse[];
    filters: { search?: string; status?: string; date_from?: string; date_to?: string };
}

const STATUS_LABEL: Record<string, { label: string; class: string }> = {
    pending:   { label: 'Pending',    class: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' },
    confirmed: { label: 'Dikonfirmasi', class: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' },
    cancelled: { label: 'Dibatalkan', class: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300' },
};

function fmtDate(iso: string | null) {
    if (!iso) return '-';
    return new Date(iso).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Inventory', href: '/inventory/transfers' },
    { title: 'Surat Jalan', href: '#' },
];

export default function DeliveryOrders({ orders, warehouses, filters }: Props) {
    const { permissions } = usePage<SharedData>().props;
    const canWrite = permissions.inventory?.can_write;

    const [search, setSearch]     = useState(filters.search ?? '');
    const [status, setStatus]     = useState(filters.status ?? '');
    const [dateFrom, setDateFrom] = useState(filters.date_from ?? '');
    const [dateTo, setDateTo]     = useState(filters.date_to ?? '');
    const [showFilter, setShowFilter] = useState(false);

    const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    function applyFilters(override: Partial<typeof filters> = {}) {
        const params: Record<string, string> = {};
        const s = 'search' in override ? override.search! : search;
        const st = 'status' in override ? override.status! : status;
        const df = 'date_from' in override ? override.date_from! : dateFrom;
        const dt = 'date_to' in override ? override.date_to! : dateTo;
        if (s)  params.search    = s;
        if (st) params.status    = st;
        if (df) params.date_from = df;
        if (dt) params.date_to   = dt;
        router.get('/inventory/delivery-orders', params, { preserveScroll: true, preserveState: true, replace: true });
    }

    useEffect(() => {
        if (searchTimer.current) clearTimeout(searchTimer.current);
        searchTimer.current = setTimeout(() => applyFilters({ search }), 350);
        return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
    }, [search]);

    function clearFilters() {
        setSearch(''); setStatus(''); setDateFrom(''); setDateTo('');
        router.get('/inventory/delivery-orders', {}, { preserveScroll: true, preserveState: true, replace: true });
    }

    const hasActiveFilters = status || dateFrom || dateTo;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <div className="space-y-4 p-4">
                {/* Header */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="text-xl font-bold flex items-center gap-2">
                            <Truck className="w-5 h-5 text-indigo-500" />
                            Surat Jalan (Delivery Order)
                        </h1>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            Kelola pengiriman barang antar outlet
                        </p>
                    </div>
                    {canWrite && (
                        <button
                            onClick={() => router.visit('/inventory/delivery-orders/create')}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 text-sm font-medium transition-colors"
                        >
                            <Plus className="w-4 h-4" /> Buat Surat Jalan
                        </button>
                    )}
                </div>

                {/* Search + Filter bar */}
                <div className="flex flex-wrap gap-2">
                    <div className="relative flex-1 min-w-[220px] max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Cari nomor, pengirim, penerima…"
                            className="w-full pl-9 pr-4 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>
                    <button
                        onClick={() => setShowFilter(v => !v)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${showFilter || hasActiveFilters ? 'bg-indigo-50 border-indigo-300 text-indigo-700 dark:bg-indigo-950/40 dark:border-indigo-700 dark:text-indigo-300' : 'hover:bg-muted'}`}
                    >
                        <Filter className="w-4 h-4" />
                        Filter
                        {hasActiveFilters && <span className="bg-indigo-600 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">!</span>}
                    </button>
                    {hasActiveFilters && (
                        <button onClick={clearFilters} className="flex items-center gap-1.5 px-3 py-2 text-sm text-muted-foreground hover:text-foreground rounded-lg border hover:bg-muted transition-colors">
                            <X className="w-3.5 h-3.5" /> Reset
                        </button>
                    )}
                </div>

                {showFilter && (
                    <div className="flex flex-wrap gap-3 p-3 rounded-lg border bg-muted/30">
                        <div className="flex flex-col gap-1 min-w-[150px]">
                            <label className="text-xs font-medium text-muted-foreground">Status</label>
                            <select
                                value={status}
                                onChange={e => { setStatus(e.target.value); applyFilters({ status: e.target.value }); }}
                                className="text-sm border rounded-md px-2 py-1.5 bg-background focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                                <option value="">Semua Status</option>
                                <option value="pending">Pending</option>
                                <option value="confirmed">Dikonfirmasi</option>
                                <option value="cancelled">Dibatalkan</option>
                            </select>
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-xs font-medium text-muted-foreground">Dari Tanggal</label>
                            <DatePickerFilter value={dateFrom} onChange={v => { setDateFrom(v); applyFilters({ date_from: v }); }} placeholder="Dari tanggal" />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-xs font-medium text-muted-foreground">Sampai Tanggal</label>
                            <DatePickerFilter value={dateTo} onChange={v => { setDateTo(v); applyFilters({ date_to: v }); }} placeholder="Sampai tanggal" />
                        </div>
                    </div>
                )}

                {/* Table */}
                <div className="rounded-xl border overflow-hidden bg-card">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b bg-muted/40">
                                    <th className="text-left px-4 py-3 font-medium">No. Surat Jalan</th>
                                    <th className="text-left px-4 py-3 font-medium">Dari → Ke</th>
                                    <th className="text-left px-4 py-3 font-medium">Pengirim / Penerima</th>
                                    <th className="text-center px-4 py-3 font-medium">Item</th>
                                    <th className="text-left px-4 py-3 font-medium">Tanggal</th>
                                    <th className="text-center px-4 py-3 font-medium">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {orders.data.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="text-center py-16 text-muted-foreground">
                                            <ClipboardList className="w-10 h-10 mx-auto mb-2 opacity-30" />
                                            Tidak ada surat jalan ditemukan.
                                        </td>
                                    </tr>
                                )}
                                {orders.data.map(row => {
                                    const s = STATUS_LABEL[row.status] ?? { label: row.status, class: 'bg-muted text-muted-foreground' };
                                    return (
                                        <tr
                                            key={row.id}
                                            onClick={() => router.visit(`/inventory/delivery-orders/${row.id}`)}
                                            className="hover:bg-muted/20 transition-colors cursor-pointer"
                                        >
                                            <td className="px-4 py-3">
                                                <div className="font-mono font-medium text-indigo-700 dark:text-indigo-400">{row.doNumber}</div>
                                                <div className="text-xs text-muted-foreground">{fmtDate(row.createdAt)}</div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-1.5 text-sm">
                                                    <span className="font-medium">{row.fromName}</span>
                                                    <span className="text-muted-foreground">→</span>
                                                    <span className="font-medium">{row.toName}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="text-sm">{row.senderName}</div>
                                                {row.recipientName && (
                                                    <div className="text-xs text-muted-foreground">{row.recipientName}</div>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className="inline-flex items-center gap-1 text-muted-foreground">
                                                    <Package className="w-3.5 h-3.5" />
                                                    {row.itemCount}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-muted-foreground text-sm">
                                                {fmtDate(row.sentAt)}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${s.class}`}>
                                                    {s.label}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {orders.last_page > 1 && (
                        <div className="flex items-center justify-between px-4 py-3 border-t text-sm text-muted-foreground">
                            <span>{orders.from}–{orders.to} dari {orders.total} surat jalan</span>
                            <div className="flex gap-1">
                                {orders.links.map((link, i) => (
                                    <button
                                        key={i}
                                        disabled={!link.url}
                                        onClick={() => link.url && router.get(link.url, {}, { preserveScroll: true })}
                                        className={`px-2 py-1 rounded text-xs ${link.active ? 'bg-indigo-600 text-white' : 'hover:bg-muted disabled:opacity-40'}`}
                                    >
                                        {link.label.replace(/&laquo;/g, '«').replace(/&raquo;/g, '»').replace(/<[^>]*>/g, '')}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </AppLayout>
    );
}
