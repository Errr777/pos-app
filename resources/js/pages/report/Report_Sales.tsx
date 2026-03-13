import { useState } from 'react';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import { CalendarIcon, Download, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Laporan Penjualan', href: '/report/sales' },
];

interface SaleRow {
    id: number;
    saleNumber: string;
    occurredAt: string;
    cashier: string;
    customer: string;
    grandTotal: number;
    method: string;
}

interface Summary {
    totalTrx: number;
    totalRevenue: number;
    totalDiscount: number;
}

interface PageProps {
    sales: { data: SaleRow[]; current_page: number; last_page: number; total: number };
    summary: Summary;
    filters: { search?: string; date_from?: string; date_to?: string; per_page?: number; method?: string; warehouse_id?: string };
    warehouses: { id: number; name: string }[];
    [key: string]: unknown;
}

function formatRp(n: number) {
    return 'Rp ' + n.toLocaleString('id-ID');
}

const METHOD_BADGE: Record<string, string> = {
    cash:     'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    transfer: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
    qris:     'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
};

export default function ReportSales() {
    const { sales, summary, filters, warehouses = [] } = usePage<PageProps>().props;

    const [search, setSearch]         = useState(filters?.search ?? '');
    const [dateFrom, setDateFrom]     = useState<Date | undefined>(
        filters?.date_from ? new Date(filters.date_from + 'T00:00:00') : undefined
    );
    const [dateTo, setDateTo]         = useState<Date | undefined>(
        filters?.date_to ? new Date(filters.date_to + 'T00:00:00') : undefined
    );
    const [dateFromOpen, setDateFromOpen] = useState(false);
    const [dateToOpen, setDateToOpen]     = useState(false);
    const [method, setMethod]         = useState(filters?.method ?? '');
    const [warehouseId, setWarehouseId] = useState(filters?.warehouse_id ?? '');

    const safeSales  = sales  ?? { data: [], current_page: 1, last_page: 1, total: 0 };
    const safeSummary: Summary = { ...(summary ?? { totalTrx: 0, totalRevenue: 0, totalDiscount: 0 }) };

    const toDateStr = (d: Date | undefined) =>
        d ? d.toISOString().slice(0, 10) : '';

    const navigate = (overrides: Record<string, unknown> = {}) => {
        router.get(route('Report_Sales'), {
            search,
            date_from: toDateStr(dateFrom),
            date_to: toDateStr(dateTo),
            method,
            warehouse_id: warehouseId,
            per_page: filters?.per_page ?? 20,
            ...overrides,
        }, { preserveState: true, replace: true });
    };

    const exportUrl = () => {
        const params = new URLSearchParams({ date_from: toDateStr(dateFrom), date_to: toDateStr(dateTo) });
        return `/report/sales/export/excel?${params.toString()}`;
    };

    const formatDisplayDate = (d: Date | undefined) =>
        d ? d.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }) : null;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Laporan Penjualan" />
            <div className="flex flex-col gap-4 p-4">

                {/* Summary cards */}
                <div className="grid grid-cols-3 gap-4">
                    <div className="rounded-xl border bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 p-4">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Total Transaksi</p>
                        <p className="text-2xl font-bold text-indigo-700 dark:text-indigo-300 mt-1">{safeSummary.totalTrx}</p>
                    </div>
                    <div className="rounded-xl border bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 p-4">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Total Omzet</p>
                        <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 mt-1">{formatRp(safeSummary.totalRevenue)}</p>
                    </div>
                    <div className="rounded-xl border bg-amber-50 dark:bg-amber-950/40 border-amber-200 p-4">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Total Diskon</p>
                        <p className="text-2xl font-bold text-amber-700 dark:text-amber-300 mt-1">{formatRp(safeSummary.totalDiscount)}</p>
                    </div>
                </div>

                {/* Filters + export */}
                <div className="flex flex-wrap gap-2 items-end">
                    <div className="relative">
                        <Search size={16} className="absolute left-3 top-2.5 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="No. transaksi..."
                            className="pl-9 pr-3 py-2 border rounded-md text-sm bg-background"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && navigate({ search, page: 1 })}
                        />
                    </div>
                    {/* Date From picker */}
                    <Popover open={dateFromOpen} onOpenChange={setDateFromOpen}>
                        <PopoverTrigger asChild>
                            <Button variant="outline" className="w-40 justify-start gap-2 text-sm font-normal">
                                <CalendarIcon size={14} className="text-muted-foreground shrink-0" />
                                <span className={dateFrom ? '' : 'text-muted-foreground'}>
                                    {formatDisplayDate(dateFrom) ?? 'Dari tanggal'}
                                </span>
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                                mode="single"
                                selected={dateFrom}
                                onSelect={(date) => {
                                    setDateFrom(date);
                                    setDateFromOpen(false);
                                    navigate({ date_from: date ? date.toISOString().slice(0, 10) : '', page: 1 });
                                }}
                                initialFocus
                            />
                        </PopoverContent>
                    </Popover>
                    {dateFrom && (
                        <button
                            className="text-muted-foreground hover:text-foreground text-sm -ml-1"
                            onClick={() => { setDateFrom(undefined); navigate({ date_from: '', page: 1 }); }}
                            aria-label="Hapus tanggal awal"
                        >
                            ×
                        </button>
                    )}
                    <span className="text-muted-foreground text-sm self-center">s/d</span>
                    {/* Date To picker */}
                    <Popover open={dateToOpen} onOpenChange={setDateToOpen}>
                        <PopoverTrigger asChild>
                            <Button variant="outline" className="w-40 justify-start gap-2 text-sm font-normal">
                                <CalendarIcon size={14} className="text-muted-foreground shrink-0" />
                                <span className={dateTo ? '' : 'text-muted-foreground'}>
                                    {formatDisplayDate(dateTo) ?? 'Sampai tanggal'}
                                </span>
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                                mode="single"
                                selected={dateTo}
                                onSelect={(date) => {
                                    setDateTo(date);
                                    setDateToOpen(false);
                                    navigate({ date_to: date ? date.toISOString().slice(0, 10) : '', page: 1 });
                                }}
                                initialFocus
                            />
                        </PopoverContent>
                    </Popover>
                    {dateTo && (
                        <button
                            className="text-muted-foreground hover:text-foreground text-sm -ml-1"
                            onClick={() => { setDateTo(undefined); navigate({ date_to: '', page: 1 }); }}
                            aria-label="Hapus tanggal akhir"
                        >
                            ×
                        </button>
                    )}
                    <select className="border rounded-md px-3 py-2 text-sm bg-background" value={method}
                        onChange={e => { setMethod(e.target.value); navigate({ method: e.target.value, page: 1 }); }}>
                        <option value="">Semua Metode</option>
                        <option value="cash">Cash</option>
                        <option value="transfer">Transfer</option>
                        <option value="qris">QRIS</option>
                    </select>
                    {warehouses.length > 1 && (
                        <select
                            className="border rounded-md px-3 py-2 text-sm bg-background"
                            value={warehouseId}
                            onChange={e => { setWarehouseId(e.target.value); navigate({ warehouse_id: e.target.value, page: 1 }); }}
                        >
                            <option value="">Semua Outlet</option>
                            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                        </select>
                    )}
                    <div className="ml-auto">
                        <a href={exportUrl()}>
                            <Button variant="outline" className="gap-2 bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:border-emerald-700 dark:text-emerald-400">
                                <Download size={16} />
                                Export Excel
                            </Button>
                        </a>
                    </div>
                </div>

                {/* Table */}
                <div className="rounded-xl border bg-card overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                            <tr>
                                <th className="text-left px-4 py-2 font-medium text-xs">No. Transaksi</th>
                                <th className="text-left px-4 py-2 font-medium text-xs">Waktu</th>
                                <th className="text-left px-4 py-2 font-medium text-xs">Kasir</th>
                                <th className="text-left px-4 py-2 font-medium text-xs">Pelanggan</th>
                                <th className="text-left px-4 py-2 font-medium text-xs">Metode</th>
                                <th className="text-right px-4 py-2 font-medium text-xs">Grand Total</th>
                                <th className="text-center px-4 py-2 font-medium text-xs">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {safeSales.data.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="text-center py-10 text-muted-foreground text-xs">
                                        Tidak ada transaksi dalam periode ini
                                    </td>
                                </tr>
                            ) : safeSales.data.map(s => (
                                <tr key={s.id} className="hover:bg-muted/30 transition-colors">
                                    <td className="px-4 py-2.5 font-mono text-xs text-primary">{s.saleNumber}</td>
                                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{s.occurredAt}</td>
                                    <td className="px-4 py-2.5 text-xs">{s.cashier}</td>
                                    <td className="px-4 py-2.5 text-xs">{s.customer}</td>
                                    <td className="px-4 py-2.5">
                                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${METHOD_BADGE[s.method] ?? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>
                                            {s.method?.toUpperCase() ?? '-'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-2.5 text-right text-xs font-semibold">{formatRp(s.grandTotal)}</td>
                                    <td className="px-4 py-2.5 text-center">
                                        <button onClick={() => router.visit(route('pos.show', s.id))}
                                            className="text-xs text-primary hover:underline">
                                            Detail
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {safeSales.last_page > 1 && (
                    <div className="flex justify-center gap-2">
                        {Array.from({ length: safeSales.last_page }).map((_, i) => (
                            <button key={i} onClick={() => navigate({ page: i + 1 })}
                                className={`px-3 py-1 rounded border text-xs ${safeSales.current_page === i + 1 ? 'bg-primary text-white' : 'bg-muted'}`}>
                                {i + 1}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
