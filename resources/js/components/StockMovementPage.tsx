/**
 * Shared component for Stock In and Stock Out pages.
 * Used by resources/js/pages/inventory/Stock_In.tsx and Stock_Out.tsx.
 */
import { useEffect, useState } from 'react';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import Pagination from '@/components/Pagination';
import { Search, Plus, Eye, Pencil, Trash, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
    DialogDescription, DialogFooter, DialogClose,
} from '@/components/ui/dialog';
import { DatePickerInput, DatePickerFilter } from '@/components/DatePickerInput';

interface MovementRow {
    id: string;
    date: string;
    itemId: string | null;
    itemName: string;
    quantity: number;
    party?: string | null;   // supplier (in) or receiver (out)
    reference?: string | null;
    qrcode?: string | null;
    image_url?: string | null;
    note?: string | null;
    warehouseId?: string | null;
}

interface ItemOption {
    id: string;
    name: string;
    category: string | null;
    stock: number;
    kode: string | null;
    image_url: string | null;
}

interface PartyOption {
    id: string;
    name: string;
}

interface WarehouseOption {
    id: string;
    code: string;
    name: string;
    is_default: boolean;
}

interface PaginatedMovements {
    data: MovementRow[];
    links: { url: string | null; label: string; active: boolean }[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
}

interface Filters {
    search?: string;
    date_from?: string;
    date_to?: string;
    sort_by?: string;
    sort_dir?: string;
    per_page?: string | number;
}

interface PageProps {
    movements: PaginatedMovements;
    items?: ItemOption[];        // only provided for stock_in
    warehouses: WarehouseOption[];
    suppliers?: PartyOption[];  // only for stock_in
    staffList?: PartyOption[];  // only for stock_out
    totalQty: number;
    filters: Filters;
    [key: string]: unknown;
}

export interface StockMovementPageConfig {
    direction: 'in' | 'out';
    breadcrumbs: BreadcrumbItem[];
    title: string;
    routeName: string;              // e.g. 'Stock_In' | 'Stock_Out'
    partyLabel: string;             // 'Supplier' | 'Receiver'
    partyPlaceholder: string;
    qtyLabel: string;               // 'Qty In' | 'Qty Out'
    deleteConfirm: string;
    csvFilename: string;
    csvPartyHeader: string;
    addLabel: string;
    fetchItemsRoute?: string;       // only for 'out'
}

function pad(n: number) { return String(n).padStart(2, '0'); }
function formatDateISO(d: string | Date | null | undefined): string {
    if (!d) return '';
    const dt = d instanceof Date ? d : new Date(d);
    if (isNaN(dt.getTime())) return '';
    return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

export default function StockMovementPage({ config }: { config: StockMovementPageConfig }) {
    const { props } = usePage<PageProps>();
    const { movements, items: staticItems, warehouses, suppliers, staffList, totalQty, filters } = props;
    const partyOptions: PartyOption[] = config.direction === 'in' ? (suppliers ?? []) : (staffList ?? []);

    const [query, setQuery] = useState(filters.search ?? '');
    const [sortBy, setSortBy] = useState(filters.sort_by ?? 'date');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>(filters.sort_dir === 'asc' ? 'asc' : 'desc');
    const [dateFrom, setDateFrom] = useState(filters.date_from ?? '');
    const [dateTo, setDateTo] = useState(filters.date_to ?? '');

    useEffect(() => {
        setQuery(filters.search ?? '');
        setSortBy(filters.sort_by ?? 'date');
        setSortDir(filters.sort_dir === 'asc' ? 'asc' : 'desc');
        setDateFrom(filters.date_from ?? '');
        setDateTo(filters.date_to ?? '');
    }, [filters]);

    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [selected, setSelected] = useState<MovementRow | null>(null);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [formMode, setFormMode] = useState<'add' | 'edit'>('add');
    const [itemSearch, setItemSearch] = useState('');
    const [availableItems, setAvailableItems] = useState<ItemOption[]>(staticItems ?? []);
    const [loadingItems, setLoadingItems] = useState(false);
    const [selectedItemImageUrl, setSelectedItemImageUrl] = useState<string | null>(staticItems?.[0]?.image_url ?? null);
    const [partySearch, setPartySearch] = useState('');
    const [partyDropOpen, setPartyDropOpen] = useState(false);
    const [form, setForm] = useState({
        id: '' as string,
        date: formatDateISO(new Date()),
        itemId: String(staticItems?.[0]?.id ?? ''),
        warehouseId: String(warehouses[0]?.id ?? ''),
        quantity: 1,
        party: '',
        reference: '',
        qrcode: '',
        note: '',
    });
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});

    const filteredItems = availableItems.filter((it) =>
        it.name.toLowerCase().includes(itemSearch.toLowerCase()) ||
        (it.kode && it.kode.toLowerCase().includes(itemSearch.toLowerCase()))
    );

    const fetchItems = async (warehouseId: string): Promise<ItemOption[]> => {
        if (!config.fetchItemsRoute || !warehouseId) return staticItems ?? [];
        setLoadingItems(true);
        try {
            const res = await fetch(route(config.fetchItemsRoute) + `?warehouse_id=${warehouseId}`);
            const data: ItemOption[] = await res.json();
            setAvailableItems(data);
            return data;
        } finally {
            setLoadingItems(false);
        }
    };

    const navigate = (overrides: Record<string, unknown> = {}) => {
        router.get(
            route(config.routeName),
            { search: query, date_from: dateFrom || undefined, date_to: dateTo || undefined,
              sort_by: sortBy, sort_dir: sortDir, per_page: filters.per_page ?? 20, ...overrides },
            { preserveState: true, replace: true }
        );
    };

    const handleSort = (col: string) => {
        const newDir: 'asc' | 'desc' = sortBy === col ? (sortDir === 'asc' ? 'desc' : 'asc') : 'desc';
        setSortBy(col); setSortDir(newDir);
        navigate({ sort_by: col, sort_dir: newDir });
    };

    const sortIcon = (col: string) => sortBy === col ? (sortDir === 'asc' ? '▲' : '▼') : '⇅';

    const handleDateFromChange = (v: string) => { setDateFrom(v); navigate({ date_from: v || undefined, page: 1 }); };
    const handleDateToChange = (v: string) => { setDateTo(v); navigate({ date_to: v || undefined, page: 1 }); };
    const clearDates = () => { setDateFrom(''); setDateTo(''); navigate({ date_from: undefined, date_to: undefined, page: 1 }); };

    const openDetail = (row: MovementRow) => { setSelected(row); setIsDetailOpen(true); };

    const openAddForm = async () => {
        setFormMode('add'); setFormErrors({}); setItemSearch(''); setPartySearch(''); setPartyDropOpen(false);
        const wid = String(warehouses[0]?.id ?? '');
        const items = config.fetchItemsRoute ? await fetchItems(wid) : (staticItems ?? []);
        setSelectedItemImageUrl(items[0]?.image_url ?? null);
        setForm({ id: '', date: formatDateISO(new Date()), itemId: String(items[0]?.id ?? ''),
            warehouseId: wid, quantity: 1, party: '', reference: '', qrcode: items[0]?.kode ?? '', note: '' });
        setIsFormOpen(true);
    };

    const openEditForm = async (row: MovementRow) => {
        setFormMode('edit'); setFormErrors({}); setItemSearch(''); setPartySearch(row.party ?? ''); setPartyDropOpen(false);
        const wid = String(row.warehouseId ?? (warehouses[0]?.id ?? ''));
        let items = availableItems;
        if (config.fetchItemsRoute) items = await fetchItems(wid);
        const matchedItem = items.find(it => String(it.id) === String(row.itemId));
        setSelectedItemImageUrl(matchedItem?.image_url ?? null);
        setForm({ id: row.id, date: formatDateISO(row.date), itemId: String(row.itemId ?? ''),
            warehouseId: wid, quantity: row.quantity, party: row.party ?? '',
            reference: row.reference ?? '', qrcode: row.qrcode ?? '', note: row.note ?? '' });
        setIsFormOpen(true);
    };

    const handleFormSubmit = (e: React.FormEvent) => {
        e.preventDefault(); setFormErrors({});
        const payload = {
            type: config.direction === 'in' ? 'stock_in' : 'stock_out',
            item_id: form.itemId, warehouse_id: form.warehouseId || null,
            quantity: form.quantity, date: form.date,
            party: form.party || null, reference: form.reference || null,
            qrcode: form.qrcode || null, note: form.note || null, source: 'Manual',
        };
        const onError = (errors: Record<string, string>) => setFormErrors(errors);
        const onSuccess = () => setIsFormOpen(false);
        if (formMode === 'add') {
            router.post(route('stock.store'), payload, { onSuccess, onError });
        } else {
            router.put(route('stock.update', { transaction: form.id }), payload, { onSuccess, onError });
        }
    };

    const handleDelete = (id: string) => {
        if (!confirm(config.deleteConfirm)) return;
        router.delete(route('stock.destroy', { transaction: id }));
    };

    const exportCSV = () => {
        const header = ['Tanggal', 'Item', config.qtyLabel, config.csvPartyHeader, 'Ref/No', 'Catatan'];
        const lines = movements.data.map(r => [
            formatDateISO(r.date), r.itemName, r.quantity, r.party ?? '',
            r.reference ?? '', (r.note ?? '').replace(/\r?\n/g, ' '),
        ]);
        const csv = [header, ...lines].map(row =>
            row.map(cell => { const s = String(cell); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(',')
        ).join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url;
        a.download = `${config.csvFilename}_${formatDateISO(new Date())}.csv`;
        a.click(); URL.revokeObjectURL(url);
    };

    return (
        <AppLayout breadcrumbs={config.breadcrumbs}>
            <Head title={config.title} />
            <div className="relative min-h-[100vh] flex-1 overflow-hidden rounded-xl border border-sidebar-border/70 md:min-h-min dark:border-sidebar-border bg-white dark:bg-background p-4">
                <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-4">
                    <form className="flex-1" onSubmit={(e) => { e.preventDefault(); navigate({ search: query, page: 1 }); }}>
                        <div className="relative w-full max-w-md">
                            <span className="absolute inset-y-0 left-3 flex items-center text-muted-foreground pointer-events-none"><Search size={18} /></span>
                            <input type="text" placeholder={`Cari item / ${config.partyLabel.toLowerCase()} / ref / catatan...`}
                                className="w-full px-10 py-2 border rounded-lg bg-muted pl-12" value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                onBlur={() => navigate({ search: query, page: 1 })} style={{ minWidth: 240 }} />
                        </div>
                    </form>
                    <div className="flex items-center gap-2">
                        <DatePickerFilter value={dateFrom} onChange={handleDateFromChange} placeholder="Dari tanggal" />
                        <DatePickerFilter value={dateTo} onChange={handleDateToChange} placeholder="Sampai tanggal" />
                        <Button variant="outline" onClick={clearDates}>Clear</Button>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" className="gap-2" onClick={exportCSV} disabled={movements.data.length === 0}>
                            <Download size={16} /> Export CSV
                        </Button>
                        <Button onClick={openAddForm} className="gap-2"><Plus size={16} /> {config.addLabel}</Button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full border rounded-xl">
                        <thead>
                            <tr className="bg-muted">
                                <th className="px-4 py-2 text-left cursor-pointer select-none" onClick={() => handleSort('date')}>Tanggal {sortIcon('date')}</th>
                                <th className="px-4 py-2 text-left cursor-pointer select-none" onClick={() => handleSort('itemName')}>Item {sortIcon('itemName')}</th>
                                <th className="px-4 py-2 text-left">Outlet</th>
                                <th className="px-4 py-2 text-left cursor-pointer select-none" onClick={() => handleSort('quantity')}>{config.qtyLabel} {sortIcon('quantity')}</th>
                                <th className="px-4 py-2 text-left cursor-pointer select-none" onClick={() => handleSort('party')}>{config.partyLabel} {sortIcon('party')}</th>
                                <th className="px-4 py-2 text-left cursor-pointer select-none" onClick={() => handleSort('reference')}>Ref/No {sortIcon('reference')}</th>
                                <th className="px-4 py-2 text-left">Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {movements.data.length === 0 ? (
                                <tr><td colSpan={7} className="text-center py-6 text-muted-foreground">Data tidak ditemukan</td></tr>
                            ) : movements.data.map((row) => (
                                <tr key={row.id} className="border-b last:border-b-0">
                                    <td className="px-4 py-2">{formatDateISO(row.date)}</td>
                                    <td className="px-4 py-2">{row.itemName}</td>
                                    <td className="px-4 py-2 text-muted-foreground text-sm">{warehouses.find((w) => String(w.id) === String(row.warehouseId))?.name ?? '-'}</td>
                                    <td className="px-4 py-2">{row.quantity}</td>
                                    <td className="px-4 py-2">{row.party || '-'}</td>
                                    <td className="px-4 py-2">{row.reference || '-'}</td>
                                    <td className="px-4 py-2 flex gap-2">
                                        <TooltipProvider>
                                            <Tooltip><TooltipTrigger asChild>
                                                <button onClick={() => openDetail(row)} className="text-primary border border-white hover:bg-primary hover:text-slate-600 hover:border-0 p-2 rounded-full transition" aria-label="Lihat"><Eye size={18} /></button>
                                            </TooltipTrigger><TooltipContent>Lihat Detail</TooltipContent></Tooltip>
                                            <Tooltip><TooltipTrigger asChild>
                                                <button onClick={() => openEditForm(row)} className="text-primary border border-white hover:bg-primary hover:text-slate-600 hover:border-0 p-2 rounded-full transition" aria-label="Edit"><Pencil size={18} /></button>
                                            </TooltipTrigger><TooltipContent>Edit</TooltipContent></Tooltip>
                                            <Tooltip><TooltipTrigger asChild>
                                                <button onClick={() => handleDelete(row.id)} className="text-destructive bg-amber-50 hover:bg-destructive hover:text-amber-50 p-2 rounded-full transition" aria-label="Hapus"><Trash size={18} /></button>
                                            </TooltipTrigger><TooltipContent>Hapus</TooltipContent></Tooltip>
                                        </TooltipProvider>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <Pagination meta={movements} onPageChange={(page) => { navigate({ page }); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                    summary={<>Total qty {config.direction === 'in' ? 'masuk' : 'keluar'} (filter): <span className="font-semibold text-foreground">{totalQty}</span></>} />
            </div>

            {/* Detail Dialog */}
            <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Detail Stock-{config.direction === 'in' ? 'In' : 'Out'}</DialogTitle>
                        <DialogDescription>Informasi transaksi barang {config.direction === 'in' ? 'masuk' : 'keluar'}.</DialogDescription>
                    </DialogHeader>
                    {selected && (
                        <div className="flex gap-4">
                            <div className="w-28 h-28 flex-shrink-0 rounded-lg border overflow-hidden bg-muted flex items-center justify-center">
                                {selected.image_url ? (
                                    <img src={selected.image_url} alt="Foto produk" className="w-full h-full object-cover" />
                                ) : (
                                    <span className="text-xs text-muted-foreground text-center px-1">No image</span>
                                )}
                            </div>
                            <div className="space-y-1.5 flex-1">
                                <p><strong>Tanggal:</strong> {formatDateISO(selected.date)}</p>
                                <p><strong>Item:</strong> {selected.itemName}</p>
                                <p><strong>{config.qtyLabel}:</strong> {selected.quantity}</p>
                                <p><strong>{config.partyLabel}:</strong> {selected.party || '-'}</p>
                                <p><strong>Ref/No:</strong> {selected.reference || '-'}</p>
                                <p><strong>Kode Item:</strong> {selected.qrcode || '-'}</p>
                                <p><strong>Catatan:</strong> {selected.note || '-'}</p>
                            </div>
                        </div>
                    )}
                    <DialogFooter><Button onClick={() => setIsDetailOpen(false)}>Tutup</Button></DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Add/Edit Dialog */}
            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogContent className="max-w-3xl">
                    <form onSubmit={handleFormSubmit}>
                        <DialogHeader>
                            <DialogTitle>{formMode === 'add' ? config.addLabel : `Edit Stock-${config.direction === 'in' ? 'In' : 'Out'}`}</DialogTitle>
                            <DialogDescription>Inputkan data barang {config.direction === 'in' ? 'masuk' : 'keluar'}.</DialogDescription>
                        </DialogHeader>
                        <div className="grid grid-cols-2 gap-x-5 gap-y-3 mt-2">
                            {/* COL 1 */}
                            <div>
                                <label className="block font-semibold mb-1">Tanggal</label>
                                <DatePickerInput value={form.date} onChange={(v) => setForm((f) => ({ ...f, date: v }))} />
                                {formErrors.date && <p className="text-destructive text-sm mt-1">{formErrors.date}</p>}
                            </div>
                            <div>
                                <label className="block font-semibold mb-1">Outlet</label>
                                <select value={form.warehouseId}
                                    onChange={async (e) => {
                                        const wid = e.target.value;
                                        setForm((f) => ({ ...f, warehouseId: wid, itemId: '', qrcode: '' }));
                                        setItemSearch(''); setSelectedItemImageUrl(null);
                                        if (config.fetchItemsRoute) {
                                            const items = await fetchItems(wid);
                                            if (items.length > 0) {
                                                setForm((f) => ({ ...f, itemId: String(items[0].id), qrcode: items[0].kode ?? '' }));
                                                setSelectedItemImageUrl(items[0].image_url ?? null);
                                            }
                                        }
                                    }}
                                    className="w-full px-3 py-2 border rounded-lg">
                                    {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name} ({w.code})</option>)}
                                </select>
                                {formErrors.warehouse_id && <p className="text-destructive text-sm mt-1">{formErrors.warehouse_id}</p>}
                                {formMode === 'edit' && (
                                    <p className="text-xs text-muted-foreground mt-0.5">Outlet hanya bisa dipindah jika stok mencukupi.</p>
                                )}
                            </div>

                            {/* Item selector spans full width */}
                            <div className="col-span-2">
                                <label className="block font-semibold mb-1">
                                    Item {loadingItems && <span className="text-xs text-muted-foreground font-normal">Memuat...</span>}
                                </label>
                                <div className="flex gap-3">
                                    <div className="flex-1">
                                        <input type="text" placeholder="Cari nama / kode produk..." value={itemSearch}
                                            onChange={(e) => setItemSearch(e.target.value)}
                                            disabled={loadingItems}
                                            className="w-full px-3 py-2 border rounded-t-lg border-b-0" />
                                        <select value={form.itemId} disabled={loadingItems}
                                            onChange={(e) => {
                                                const id = e.target.value;
                                                const item = availableItems.find((it) => String(it.id) === id);
                                                setForm((f) => ({ ...f, itemId: id, qrcode: item?.kode ?? '' }));
                                                setSelectedItemImageUrl(item?.image_url ?? null);
                                            }}
                                            className="w-full px-3 py-2 border rounded-b-lg"
                                            size={Math.min(Math.max(filteredItems.length, 1), 6)}>
                                            {filteredItems.map((it) => (
                                                <option key={it.id} value={it.id}>
                                                    {it.name}{it.kode ? ` [${it.kode}]` : ''}{it.category ? ` — ${it.category}` : ''} (stok: {it.stock})
                                                </option>
                                            ))}
                                        </select>
                                        {formErrors.item_id && <p className="text-destructive text-sm mt-1">{formErrors.item_id}</p>}
                                    </div>
                                    {/* Product image preview */}
                                    <div className="w-24 h-24 flex-shrink-0 rounded-lg border overflow-hidden bg-muted flex items-center justify-center">
                                        {selectedItemImageUrl ? (
                                            <img src={selectedItemImageUrl} alt="Foto produk" className="w-full h-full object-cover" />
                                        ) : (
                                            <span className="text-xs text-muted-foreground text-center px-1">No image</span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block font-semibold mb-1">{config.qtyLabel}</label>
                                <input type="number" min={1} value={form.quantity}
                                    onChange={(e) => setForm((f) => ({ ...f, quantity: Number(e.target.value) }))}
                                    className="w-full px-3 py-2 border rounded-lg" required />
                                {formErrors.quantity && <p className="text-destructive text-sm mt-1">{formErrors.quantity}</p>}
                            </div>

                            {/* Party combobox */}
                            <div className="relative">
                                <label className="block font-semibold mb-1">{config.partyLabel}</label>
                                <input
                                    value={partySearch}
                                    onChange={(e) => {
                                        setPartySearch(e.target.value);
                                        setForm((f) => ({ ...f, party: e.target.value }));
                                        setPartyDropOpen(true);
                                    }}
                                    onFocus={() => setPartyDropOpen(true)}
                                    onBlur={() => setTimeout(() => setPartyDropOpen(false), 150)}
                                    placeholder={config.partyPlaceholder}
                                    className="w-full px-3 py-2 border rounded-lg"
                                    autoComplete="off"
                                />
                                {partyDropOpen && partyOptions.length > 0 && (
                                    <ul className="absolute z-50 w-full bg-background border rounded-lg shadow-lg mt-1 max-h-40 overflow-y-auto">
                                        {partyOptions
                                            .filter(p => !partySearch || p.name.toLowerCase().includes(partySearch.toLowerCase()))
                                            .map(p => (
                                                <li key={p.id}
                                                    className="px-3 py-2 hover:bg-muted cursor-pointer text-sm"
                                                    onMouseDown={() => {
                                                        setPartySearch(p.name);
                                                        setForm((f) => ({ ...f, party: p.name }));
                                                        setPartyDropOpen(false);
                                                    }}>
                                                    {p.name}
                                                </li>
                                            ))}
                                    </ul>
                                )}
                            </div>

                            <div>
                                <label className="block font-semibold mb-1">Ref/No</label>
                                <input value={form.reference} onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))}
                                    placeholder="No faktur / DO" className="w-full px-3 py-2 border rounded-lg" />
                            </div>
                            <div>
                                <label className="block font-semibold mb-1">Kode Item</label>
                                <input value={form.qrcode} readOnly disabled placeholder="Terisi otomatis dari item yang dipilih"
                                    className="w-full px-3 py-2 border rounded-lg bg-muted text-muted-foreground cursor-not-allowed" />
                            </div>

                            <div className="col-span-2">
                                <label className="block font-semibold mb-1">Catatan</label>
                                <textarea value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                                    placeholder="Catatan tambahan" className="w-full px-3 py-2 border rounded-lg" rows={2} />
                            </div>
                        </div>
                        <DialogFooter className="mt-4">
                            <Button type="submit" disabled={loadingItems}>{formMode === 'add' ? 'Simpan' : 'Update'}</Button>
                            <DialogClose asChild><Button type="button" variant="outline">Batal</Button></DialogClose>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
