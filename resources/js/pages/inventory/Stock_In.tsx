import { useEffect, useState } from 'react';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import Pagination from '@/components/Pagination';
import { Search, Plus, Eye, Pencil, Trash, Download } from 'lucide-react';
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
import { DatePickerInput, DatePickerFilter } from '@/components/DatePickerInput';

const breadcrumbs: BreadcrumbItem[] = [
  { title: 'Dashboard', href: '/dashboard' },
  { title: 'Stock In', href: '/inventory/stock_in' },
];

interface StockInRow {
  id: number;
  date: string;
  itemId: number | null;
  itemName: string;
  quantity: number;
  supplier?: string | null;
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
  data: StockInRow[];
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

export default function Stock_In() {
  const { props } = usePage<PageProps>();
  const { movements, items: itemOptions, warehouses, totalQty, filters } = props;

  const [query, setQuery] = useState<string>(filters.search ?? '');
  const [sortBy, setSortBy] = useState<string>(filters.sort_by ?? 'date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(
    filters.sort_dir === 'asc' ? 'asc' : 'desc'
  );
  const [dateFrom, setDateFrom] = useState<string>(filters.date_from ?? '');
  const [dateTo, setDateTo] = useState<string>(filters.date_to ?? '');

  // Sync local state when Inertia navigates and passes new filters
  useEffect(() => {
    setQuery(filters.search ?? '');
    setSortBy(filters.sort_by ?? 'date');
    setSortDir(filters.sort_dir === 'asc' ? 'asc' : 'desc');
    setDateFrom(filters.date_from ?? '');
    setDateTo(filters.date_to ?? '');
  }, [filters]);

  // detail modal
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selected, setSelected] = useState<StockInRow | null>(null);

  // add/edit modal
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'add' | 'edit'>('add');
  const [itemSearch, setItemSearch] = useState('');
  const filteredItems = itemOptions.filter((it) =>
    it.name.toLowerCase().includes(itemSearch.toLowerCase()) ||
    (it.kode && it.kode.toLowerCase().includes(itemSearch.toLowerCase()))
  );
  const [form, setForm] = useState({
    id: 0,
    date: formatDateISO(new Date()),
    itemId: itemOptions[0]?.id ?? 0,
    warehouseId: warehouses[0]?.id ?? 0,
    quantity: 1,
    supplier: '',
    reference: '',
    qrcode: '',
    note: '',
    source: 'Manual',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // ===== Navigation helper =====
  const navigate = (overrides: Record<string, unknown> = {}) => {
    router.get(
      route('Stock_In'),
      {
        search:    query,
        date_from: dateFrom || undefined,
        date_to:   dateTo || undefined,
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

  const handleDateFromChange = (v: string) => {
    setDateFrom(v);
    navigate({ date_from: v || undefined, page: 1 });
  };
  const handleDateToChange = (v: string) => {
    setDateTo(v);
    navigate({ date_to: v || undefined, page: 1 });
  };
  const clearDates = () => {
    setDateFrom('');
    setDateTo('');
    navigate({ date_from: undefined, date_to: undefined, page: 1 });
  };

  const handlePage = (page: number) => {
    navigate({ page });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ===== Detail =====
  const openDetail = (row: StockInRow) => { setSelected(row); setIsDetailOpen(true); };

  // ===== Add / Edit =====
  const openAddForm = () => {
    setFormMode('add');
    setFormErrors({});
    setItemSearch('');
    setForm({
      id: 0,
      date: formatDateISO(new Date()),
      itemId: itemOptions[0]?.id ?? 0,
      warehouseId: warehouses[0]?.id ?? 0,
      quantity: 1,
      supplier: '',
      reference: '',
      qrcode: itemOptions[0]?.kode ?? '',
      note: '',
      source: 'Manual',
    });
    setIsFormOpen(true);
  };

  const openEditForm = (row: StockInRow) => {
    setFormMode('edit');
    setFormErrors({});
    setItemSearch('');
    setForm({
      id: row.id,
      date: formatDateISO(row.date),
      itemId: row.itemId ?? (itemOptions[0]?.id ?? 0),
      warehouseId: row.warehouseId ?? (warehouses[0]?.id ?? 0),
      quantity: row.quantity,
      supplier: row.supplier ?? '',
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
      type:         'stock_in',
      item_id:      form.itemId,
      warehouse_id: form.warehouseId || null,
      quantity:  form.quantity,
      date:      form.date,
      party:     form.supplier || null,
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
    if (!confirm('Hapus data stock-in ini? Stok item akan dikurangi kembali.')) return;
    router.delete(route('stock.destroy', { transaction: id }));
  };

  // ===== CSV Export (current page) =====
  const exportCSV = () => {
    const header = ['Tanggal', 'Item', 'Qty', 'Supplier', 'Ref/No', 'Catatan'];
    const lines = movements.data.map(r => [
      formatDateISO(r.date),
      r.itemName,
      r.quantity,
      r.supplier ?? '',
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
    a.download = `stock-in_${formatDateISO(new Date())}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const meta = movements;

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title="Stock In" />
      <div className="relative min-h-[100vh] flex-1 overflow-hidden rounded-xl border border-sidebar-border/70 md:min-h-min dark:border-sidebar-border bg-white dark:bg-background p-4">
        {/* Header actions */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-4">
          {/* Search */}
          <form className="flex-1" onSubmit={handleSearchSubmit}>
            <div className="relative w-full max-w-md">
              <span className="absolute inset-y-0 left-3 flex items-center text-muted-foreground pointer-events-none">
                <Search size={18} />
              </span>
              <input
                type="text"
                placeholder="Cari item / supplier / ref / catatan..."
                className="w-full px-10 py-2 border rounded-lg bg-muted pl-12"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onBlur={() => navigate({ search: query, page: 1 })}
                style={{ minWidth: 240 }}
              />
            </div>
          </form>

          {/* Date Range Picker */}
          <div className="flex items-center gap-2">
            <DatePickerFilter value={dateFrom} onChange={handleDateFromChange} placeholder="Dari tanggal" />
            <DatePickerFilter value={dateTo} onChange={handleDateToChange} placeholder="Sampai tanggal" />
            <Button variant="outline" onClick={clearDates}>Clear</Button>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Button variant="outline" className="gap-2" onClick={exportCSV} disabled={movements.data.length === 0}>
              <Download size={16} />
              Export CSV
            </Button>
            <Button onClick={openAddForm} className="gap-2">
              <Plus size={16} />
              Tambah Stock-In
            </Button>
          </div>
        </div>

        {/* Table */}
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
                  Qty In {sortIcon('quantity')}
                </th>
                <th className="px-4 py-2 text-left cursor-pointer select-none" onClick={() => handleSort('supplier')}>
                  Supplier {sortIcon('supplier')}
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
                    <td className="px-4 py-2 text-muted-foreground text-sm">{(warehouses.find((w) => w.id === row.warehouseId)?.name) ?? '-'}</td>
                    <td className="px-4 py-2">{row.quantity}</td>
                    <td className="px-4 py-2">{row.supplier || '-'}</td>
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
          summary={<>Total qty masuk (filter): <span className="font-semibold text-foreground">{totalQty}</span></>}
        />
      </div>

      {/* Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detail Stock-In</DialogTitle>
            <DialogDescription>Informasi transaksi barang masuk.</DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-2">
              <p><strong>Tanggal:</strong> {formatDateISO(selected.date)}</p>
              <p><strong>Item:</strong> {selected.itemName}</p>
              <p><strong>Qty:</strong> {selected.quantity}</p>
              <p><strong>Supplier:</strong> {selected.supplier || '-'}</p>
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
              <DialogTitle>{formMode === 'add' ? 'Tambah Stock-In' : 'Edit Stock-In'}</DialogTitle>
              <DialogDescription>Inputkan data barang masuk.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 mt-2">
              <div>
                <label className="block font-semibold mb-1">Tanggal</label>
                <DatePickerInput value={form.date} onChange={(v) => setForm((f) => ({ ...f, date: v }))} />
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
                  <p className="text-xs text-muted-foreground mt-0.5">Outlet hanya bisa dipindah jika stok lama belum terpakai.</p>
                )}
              </div>
              <div>
                <label className="block font-semibold mb-1">Item</label>
                <input
                  type="text"
                  placeholder="Cari item..."
                  value={itemSearch}
                  onChange={(e) => setItemSearch(e.target.value)}
                  className="w-full px-3 py-2 border rounded-t-lg border-b-0"
                />
                <select
                  value={form.itemId}
                  onChange={(e) => {
                    const id = Number(e.target.value);
                    const item = itemOptions.find((it) => it.id === id);
                    setForm((f) => ({ ...f, itemId: id, qrcode: item?.kode ?? '' }));
                  }}
                  className="w-full px-3 py-2 border rounded-b-lg"
                  size={Math.min(Math.max(filteredItems.length, 1), 6)}
                >
                  {filteredItems.map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.name}{it.category ? ` — ${it.category}` : ''} (stok: {it.stock})
                    </option>
                  ))}
                </select>
                {formErrors.item_id && <p className="text-destructive text-sm mt-1">{formErrors.item_id}</p>}
              </div>
              <div>
                <label className="block font-semibold mb-1">Qty</label>
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
                <label className="block font-semibold mb-1">Supplier</label>
                <input
                  value={form.supplier}
                  onChange={(e) => setForm((f) => ({ ...f, supplier: e.target.value }))}
                  placeholder="Nama supplier"
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Ref/No</label>
                <input
                  value={form.reference}
                  onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))}
                  placeholder="No faktur / DO"
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Kode Item</label>
                <input
                  value={form.qrcode}
                  readOnly
                  disabled
                  placeholder="Terisi otomatis dari item yang dipilih"
                  className="w-full px-3 py-2 border rounded-lg bg-muted text-muted-foreground cursor-not-allowed"
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
