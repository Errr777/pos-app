import { useEffect, useState } from 'react';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import Pagination from '@/components/Pagination';
import { Search, Plus, Eye, Pencil, Trash, Download, Calendar as CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { DateRange } from 'react-day-picker';

const breadcrumbs: BreadcrumbItem[] = [
  { title: 'Dashboard', href: '/dashboard' },
  { title: 'Stock Out', href: '/inventory/stock_out' },
];

interface StockOutRow {
  id: number;
  date: string;
  itemId: number | null;
  itemName: string;
  quantity: number;
  receiver?: string | null;
  reference?: string | null;
  qrcode?: string | null;
  note?: string | null;
  warehouseId?: number | null;
}

interface ItemOption {
  id: number;
  name: string;
  category: string | null;
  stock: number;
  kode: string | null;
}

interface PaginationLink {
  url: string | null;
  label: string;
  active: boolean;
}

interface PaginatedMovements {
  data: StockOutRow[];
  links: PaginationLink[];
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

interface WarehouseOption {
  id: number;
  code: string;
  name: string;
  is_default: boolean;
}

interface PageProps {
  movements: PaginatedMovements;
  items: ItemOption[];
  warehouses: WarehouseOption[];
  totalQty: number;
  filters: Filters;
  [key: string]: unknown;
}

function pad(n: number) { return String(n).padStart(2, '0'); }
function formatDateISO(d: string | Date | null | undefined): string {
  if (!d) return '';
  const dt = d instanceof Date ? d : new Date(d);
  if (isNaN(dt.getTime())) return '';
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

export default function Stock_Out() {
  const { props } = usePage<PageProps>();
  const { movements, items: itemOptions, warehouses, totalQty, filters } = props;

  const [query, setQuery] = useState<string>(filters.search ?? '');
  const [sortBy, setSortBy] = useState<string>(filters.sort_by ?? 'date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(
    filters.sort_dir === 'asc' ? 'asc' : 'desc'
  );
  const [range, setRange] = useState<DateRange | undefined>(() => {
    if (filters.date_from) {
      return {
        from: new Date(filters.date_from),
        to: filters.date_to ? new Date(filters.date_to) : undefined,
      };
    }
    return undefined;
  });

  useEffect(() => {
    setQuery(filters.search ?? '');
    setSortBy(filters.sort_by ?? 'date');
    setSortDir(filters.sort_dir === 'asc' ? 'asc' : 'desc');
    if (filters.date_from) {
      setRange({
        from: new Date(filters.date_from),
        to: filters.date_to ? new Date(filters.date_to) : undefined,
      });
    } else {
      setRange(undefined);
    }
  }, [filters]);

  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selected, setSelected] = useState<StockOutRow | null>(null);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'add' | 'edit'>('add');
  const [form, setForm] = useState({
    id: 0,
    date: formatDateISO(new Date()),
    itemId: itemOptions[0]?.id ?? 0,
    warehouseId: warehouses[0]?.id ?? 0,
    quantity: 1,
    receiver: '',
    reference: '',
    qrcode: '',
    note: '',
    source: 'Manual',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const navigate = (overrides: Record<string, unknown> = {}) => {
    router.get(
      route('Stock_Out'),
      {
        search:    query,
        date_from: range?.from ? formatDateISO(range.from) : undefined,
        date_to:   range?.to   ? formatDateISO(range.to)   : undefined,
        sort_by:   sortBy,
        sort_dir:  sortDir,
        per_page:  filters.per_page ?? 20,
        ...overrides,
      },
      { preserveState: true, replace: true }
    );
  };

  const handleSort = (col: string) => {
    const newDir: 'asc' | 'desc' = sortBy === col ? (sortDir === 'asc' ? 'desc' : 'asc') : 'desc';
    setSortBy(col);
    setSortDir(newDir);
    navigate({ sort_by: col, sort_dir: newDir });
  };

  const sortIcon = (col: string) =>
    sortBy === col ? (sortDir === 'asc' ? '▲' : '▼') : '⇅';

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate({ search: query, page: 1 });
  };

  const handleDateRangeChange = (r: DateRange | undefined) => {
    setRange(r);
    navigate({
      date_from: r?.from ? formatDateISO(r.from) : undefined,
      date_to:   r?.to   ? formatDateISO(r.to)   : undefined,
      page: 1,
    });
  };

  const clearDateRange = () => handleDateRangeChange(undefined);

  const handlePage = (page: number) => {
    navigate({ page });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openDetail = (row: StockOutRow) => { setSelected(row); setIsDetailOpen(true); };

  const openAddForm = () => {
    setFormMode('add');
    setFormErrors({});
    setForm({
      id: 0,
      date: formatDateISO(new Date()),
      itemId: itemOptions[0]?.id ?? 0,
      warehouseId: warehouses[0]?.id ?? 0,
      quantity: 1,
      receiver: '',
      reference: '',
      qrcode: itemOptions[0]?.kode ?? '',
      note: '',
      source: 'Manual',
    });
    setIsFormOpen(true);
  };

  const openEditForm = (row: StockOutRow) => {
    setFormMode('edit');
    setFormErrors({});
    setForm({
      id: row.id,
      date: formatDateISO(row.date),
      itemId: row.itemId ?? (itemOptions[0]?.id ?? 0),
      warehouseId: row.warehouseId ?? (warehouses[0]?.id ?? 0),
      quantity: row.quantity,
      receiver: row.receiver ?? '',
      reference: row.reference ?? '',
      qrcode: row.qrcode ?? '',
      note: row.note ?? '',
      source: 'Manual',
    });
    setIsFormOpen(true);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});

    const payload = {
      type:         'stock_out',
      item_id:      form.itemId,
      warehouse_id: form.warehouseId || null,
      quantity:  form.quantity,
      date:      form.date,
      party:     form.receiver || null,
      reference: form.reference || null,
      qrcode:    form.qrcode || null,
      note:      form.note || null,
      source:    form.source,
    };

    const onError = (errors: Record<string, string>) => setFormErrors(errors);
    const onSuccess = () => setIsFormOpen(false);

    if (formMode === 'add') {
      router.post(route('stock.store'), payload, { onSuccess, onError });
    } else {
      router.put(route('stock.update', { transaction: form.id }), payload, { onSuccess, onError });
    }
  };

  const handleDelete = (id: number) => {
    if (!confirm('Hapus data stock-out ini? Stok item akan dikembalikan.')) return;
    router.delete(route('stock.destroy', { transaction: id }));
  };

  const exportCSV = () => {
    const header = ['Tanggal', 'Item', 'Qty Out', 'Receiver', 'Ref/No', 'Catatan'];
    const lines = movements.data.map(r => [
      formatDateISO(r.date),
      r.itemName,
      r.quantity,
      r.receiver ?? '',
      r.reference ?? '',
      (r.note ?? '').replace(/\r?\n/g, ' '),
    ]);
    const csv = [header, ...lines]
      .map(row => row.map((cell) => {
        const s = String(cell);
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      }).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stock-out_${formatDateISO(new Date())}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const rangeLabel = (() => {
    if (range?.from && range?.to) return `${formatDateISO(range.from)} s/d ${formatDateISO(range.to)}`;
    if (range?.from) return `${formatDateISO(range.from)} s/d …`;
    return 'Pilih tanggal';
  })();

  const meta = movements;

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title="Stock Out" />
      <div className="relative min-h-[100vh] flex-1 overflow-hidden rounded-xl border border-sidebar-border/70 md:min-h-min dark:border-sidebar-border bg-white dark:bg-background p-4">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-4">
          <form className="flex-1" onSubmit={handleSearchSubmit}>
            <div className="relative w-full max-w-md">
              <span className="absolute inset-y-0 left-3 flex items-center text-muted-foreground pointer-events-none">
                <Search size={18} />
              </span>
              <input
                type="text"
                placeholder="Cari item / receiver / ref / catatan..."
                className="w-full px-10 py-2 border rounded-lg bg-muted pl-12"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onBlur={() => navigate({ search: query, page: 1 })}
                style={{ minWidth: 240 }}
              />
            </div>
          </form>

          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <CalendarIcon size={16} />
                  {rangeLabel}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="p-0" align="start">
                <Calendar
                  mode="range"
                  selected={range}
                  onSelect={handleDateRangeChange}
                  numberOfMonths={1}
                  defaultMonth={range?.from}
                  className="w-auto max-w-md"
                />
              </PopoverContent>
            </Popover>
            <Button variant="outline" onClick={clearDateRange}>Clear</Button>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" className="gap-2" onClick={exportCSV} disabled={movements.data.length === 0}>
              <Download size={16} />
              Export CSV
            </Button>
            <Button onClick={openAddForm} className="gap-2">
              <Plus size={16} />
              Tambah Stock-Out
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full border rounded-xl">
            <thead>
              <tr className="bg-muted">
                <th className="px-4 py-2 text-left cursor-pointer select-none" onClick={() => handleSort('date')}>
                  Tanggal {sortIcon('date')}
                </th>
                <th className="px-4 py-2 text-left cursor-pointer select-none" onClick={() => handleSort('itemName')}>
                  Item {sortIcon('itemName')}
                </th>
                <th className="px-4 py-2 text-left">Outlet</th>
                <th className="px-4 py-2 text-left cursor-pointer select-none" onClick={() => handleSort('quantity')}>
                  Qty Out {sortIcon('quantity')}
                </th>
                <th className="px-4 py-2 text-left cursor-pointer select-none" onClick={() => handleSort('receiver')}>
                  Receiver {sortIcon('receiver')}
                </th>
                <th className="px-4 py-2 text-left cursor-pointer select-none" onClick={() => handleSort('reference')}>
                  Ref/No {sortIcon('reference')}
                </th>
                <th className="px-4 py-2 text-left">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {movements.data.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-6 text-muted-foreground">
                    Data tidak ditemukan
                  </td>
                </tr>
              ) : (
                movements.data.map((row) => (
                  <tr key={row.id} className="border-b last:border-b-0">
                    <td className="px-4 py-2">{formatDateISO(row.date)}</td>
                    <td className="px-4 py-2">{row.itemName}</td>
                    <td className="px-4 py-2 text-muted-foreground text-sm">{warehouses.find((w) => w.id === row.warehouseId)?.name ?? '-'}</td>
                    <td className="px-4 py-2">{row.quantity}</td>
                    <td className="px-4 py-2">{row.receiver || '-'}</td>
                    <td className="px-4 py-2">{row.reference || '-'}</td>
                    <td className="px-4 py-2 flex gap-2">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button onClick={() => openDetail(row)} className="text-primary border border-white hover:bg-primary hover:text-slate-600 hover:border-0 p-2 rounded-full transition" aria-label="Lihat">
                              <Eye size={18} />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>Lihat Detail</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button onClick={() => openEditForm(row)} className="text-primary border border-white hover:bg-primary hover:text-slate-600 hover:border-0 p-2 rounded-full transition" aria-label="Edit">
                              <Pencil size={18} />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>Edit</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button onClick={() => handleDelete(row.id)} className="text-destructive bg-amber-50 hover:bg-destructive hover:text-amber-50 p-2 rounded-full transition" aria-label="Hapus">
                              <Trash size={18} />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>Hapus</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          meta={meta}
          onPageChange={handlePage}
          summary={<>Total qty keluar (filter): <span className="font-semibold text-foreground">{totalQty}</span></>}
        />
      </div>

      {/* Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detail Stock-Out</DialogTitle>
            <DialogDescription>Informasi transaksi barang keluar.</DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-2">
              <p><strong>Tanggal:</strong> {formatDateISO(selected.date)}</p>
              <p><strong>Item:</strong> {selected.itemName}</p>
              <p><strong>Qty Out:</strong> {selected.quantity}</p>
              <p><strong>Receiver:</strong> {selected.receiver || '-'}</p>
              <p><strong>Ref/No:</strong> {selected.reference || '-'}</p>
              <p><strong>Kode QR:</strong> {selected.qrcode || '-'}</p>
              <p><strong>Catatan:</strong> {selected.note || '-'}</p>
              {selected.qrcode && (
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(selected.qrcode)}`}
                  alt="QR Code"
                  className="mx-auto mt-2 rounded-lg border p-3"
                />
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setIsDetailOpen(false)}>Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent>
          <form onSubmit={handleFormSubmit}>
            <DialogHeader>
              <DialogTitle>{formMode === 'add' ? 'Tambah Stock-Out' : 'Edit Stock-Out'}</DialogTitle>
              <DialogDescription>Inputkan data barang keluar.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 mt-2">
              <div>
                <label className="block font-semibold mb-1">Tanggal</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                />
                {formErrors.date && <p className="text-destructive text-sm mt-1">{formErrors.date}</p>}
              </div>
              <div>
                <label className="block font-semibold mb-1">Outlet</label>
                <select
                  value={form.warehouseId}
                  onChange={(e) => setForm((f) => ({ ...f, warehouseId: Number(e.target.value) }))}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
                  ))}
                </select>
                {formErrors.warehouse_id && <p className="text-destructive text-sm mt-1">{formErrors.warehouse_id}</p>}
                {formMode === 'edit' && (
                  <p className="text-xs text-muted-foreground mt-0.5">Outlet hanya bisa dipindah jika stok baru mencukupi.</p>
                )}
              </div>
              <div>
                <label className="block font-semibold mb-1">Item</label>
                <select
                  value={form.itemId}
                  onChange={(e) => {
                    const id = Number(e.target.value);
                    const item = itemOptions.find((it) => it.id === id);
                    setForm((f) => ({ ...f, itemId: id, qrcode: item?.kode ?? '' }));
                  }}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  {itemOptions.map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.name}{it.category ? ` — ${it.category}` : ''} (stok: {it.stock})
                    </option>
                  ))}
                </select>
                {formErrors.item_id && <p className="text-destructive text-sm mt-1">{formErrors.item_id}</p>}
              </div>
              <div>
                <label className="block font-semibold mb-1">Qty Out</label>
                <input
                  type="number"
                  min={1}
                  value={form.quantity}
                  onChange={(e) => setForm((f) => ({ ...f, quantity: Number(e.target.value) }))}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                />
                {formErrors.quantity && <p className="text-destructive text-sm mt-1">{formErrors.quantity}</p>}
              </div>
              <div>
                <label className="block font-semibold mb-1">Receiver</label>
                <input
                  value={form.receiver}
                  onChange={(e) => setForm((f) => ({ ...f, receiver: e.target.value }))}
                  placeholder="Penerima / divisi / outlet"
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Ref/No</label>
                <input
                  value={form.reference}
                  onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))}
                  placeholder="No faktur / DO / req"
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Kode QR</label>
                <input
                  value={form.qrcode}
                  onChange={(e) => setForm((f) => ({ ...f, qrcode: e.target.value }))}
                  placeholder="Kode / serial number (opsional)"
                  className="w-full px-3 py-2 border rounded-lg"
                />
                {form.qrcode && (
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(form.qrcode)}`}
                    alt="QR Preview"
                    className="mt-2 rounded border p-1"
                  />
                )}
              </div>
              <div>
                <label className="block font-semibold mb-1">Catatan</label>
                <textarea
                  value={form.note}
                  onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                  placeholder="Catatan tambahan"
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button type="submit">{formMode === 'add' ? 'Simpan' : 'Update'}</Button>
              <DialogClose asChild>
                <Button type="button" variant="outline">Batal</Button>
              </DialogClose>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
