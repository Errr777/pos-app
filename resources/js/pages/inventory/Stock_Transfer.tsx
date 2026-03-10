import { useEffect, useState } from 'react';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import { Search, Plus, Eye, Trash, Download, Calendar as CalendarIcon, ArrowRightLeft, ArrowLeftRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter, DialogClose,
} from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { DateRange } from 'react-day-picker';
import Pagination from '@/components/Pagination';

const breadcrumbs: BreadcrumbItem[] = [
  { title: 'Dashboard', href: '/dashboard' },
  { title: 'Transfer Stok', href: '/inventory/transfers' },
];

interface TransferRow {
  id: number;
  txnId: string;
  date: string;
  itemId: number;
  itemName: string;
  fromId: number;
  fromName: string;
  toId: number;
  toName: string;
  quantity: number;
  reference?: string | null;
  actor?: string | null;
  note?: string | null;
  status: string;
}

interface WarehouseOption {
  id: number;
  code: string;
  name: string;
  is_default: boolean;
}

interface ItemOption {
  id: number;
  name: string;
  category: string | null;
  stock: number;
}

interface PaginatedTransfers {
  data: TransferRow[];
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
  transfers: PaginatedTransfers;
  warehouses: WarehouseOption[];
  items: ItemOption[];
  filters: Filters;
  flash?: { success?: string };
  errors?: Record<string, string>;
  [key: string]: unknown;
}

function pad(n: number) { return String(n).padStart(2, '0'); }
function formatDateISO(d: string | Date | null | undefined): string {
  if (!d) return '';
  const dt = d instanceof Date ? d : new Date(d);
  if (isNaN(dt.getTime())) return '';
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

export default function Stock_Transfer() {
  const { props } = usePage<PageProps>();
  const { transfers, warehouses, items: itemOptions, filters, flash, errors: pageErrors } = props;

  const [query, setQuery]     = useState(filters.search ?? '');
  const [sortBy, setSortBy]   = useState(filters.sort_by ?? 'date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(filters.sort_dir === 'asc' ? 'asc' : 'desc');
  const [range, setRange]     = useState<DateRange | undefined>(() => {
    if (filters.date_from) return { from: new Date(filters.date_from), to: filters.date_to ? new Date(filters.date_to) : undefined };
    return undefined;
  });

  useEffect(() => {
    setQuery(filters.search ?? '');
    setSortBy(filters.sort_by ?? 'date');
    setSortDir(filters.sort_dir === 'asc' ? 'asc' : 'desc');
    setRange(filters.date_from ? { from: new Date(filters.date_from), to: filters.date_to ? new Date(filters.date_to) : undefined } : undefined);
  }, [filters]);

  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selected, setSelected]         = useState<TransferRow | null>(null);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState({
    from_warehouse_id: warehouses[0]?.id ?? 0,
    to_warehouse_id:   warehouses[1]?.id ?? warehouses[0]?.id ?? 0,
    item_id:           itemOptions[0]?.id ?? 0,
    quantity:          1,
    date:              formatDateISO(new Date()),
    reference:         '',
    note:              '',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [fromStock, setFromStock]   = useState<number | null>(null);

  // Navigate helper
  const navigate = (overrides: Record<string, unknown> = {}) => {
    router.get(route('stock_transfer.index'), {
      search:    query,
      date_from: range?.from ? formatDateISO(range.from) : undefined,
      date_to:   range?.to   ? formatDateISO(range.to)   : undefined,
      sort_by:   sortBy,
      sort_dir:  sortDir,
      per_page:  filters.per_page ?? 20,
      ...overrides,
    }, { preserveState: true, replace: true });
  };

  const handleSort = (col: string) => {
    const newDir: 'asc' | 'desc' = sortBy === col ? (sortDir === 'asc' ? 'desc' : 'asc') : 'desc';
    setSortBy(col); setSortDir(newDir);
    navigate({ sort_by: col, sort_dir: newDir });
  };

  const sortIcon = (col: string) => sortBy === col ? (sortDir === 'asc' ? '▲' : '▼') : '⇅';

  const handleDateRangeChange = (r: DateRange | undefined) => {
    setRange(r);
    navigate({ date_from: r?.from ? formatDateISO(r.from) : undefined, date_to: r?.to ? formatDateISO(r.to) : undefined, page: 1 });
  };

  const handlePage = (page: number) => navigate({ page });

  // Update fromStock when from_warehouse or item changes
  useEffect(() => {
    if (!form.item_id || !form.from_warehouse_id) { setFromStock(null); return; }
    router.get(route('stock_transfer.index'), {}, {
      preserveState: true,
      only: [],
      onSuccess: () => {},
    });
    // Just show item global stock as approximation; real check is server-side
    const item = itemOptions.find(i => i.id === form.item_id);
    setFromStock(item?.stock ?? null);
  }, [form.item_id, form.from_warehouse_id]);

  const openAdd = () => {
    setFormErrors({});
    setForm({
      from_warehouse_id: warehouses[0]?.id ?? 0,
      to_warehouse_id:   warehouses[1]?.id ?? warehouses[0]?.id ?? 0,
      item_id:           itemOptions[0]?.id ?? 0,
      quantity:          1,
      date:              formatDateISO(new Date()),
      reference:         '',
      note:              '',
    });
    setIsFormOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});
    router.post(route('stock_transfer.store'), {
      from_warehouse_id: form.from_warehouse_id,
      to_warehouse_id:   form.to_warehouse_id,
      item_id:           form.item_id,
      quantity:          form.quantity,
      date:              form.date,
      reference:         form.reference || null,
      note:              form.note || null,
    }, {
      onSuccess: () => setIsFormOpen(false),
      onError:   (errs) => setFormErrors(errs),
    });
  };

  const handleDelete = (row: TransferRow) => {
    if (!confirm(`Batalkan transfer "${row.txnId}"?\nIni akan mengembalikan ${row.quantity} unit "${row.itemName}" dari ${row.toName} ke ${row.fromName}.`)) return;
    router.delete(route('stock_transfer.destroy', { stockTransfer: row.id }));
  };

  const exportCSV = () => {
    const header = ['Tanggal', 'Item', 'Dari', 'Ke', 'Qty', 'Ref', 'Actor', 'Catatan'];
    const lines  = transfers.data.map(r => [
      formatDateISO(r.date), r.itemName, r.fromName, r.toName,
      r.quantity, r.reference ?? '', r.actor ?? '', (r.note ?? '').replace(/\r?\n/g, ' '),
    ]);
    const csv = [header, ...lines].map(row => row.map(c => {
      const s = String(c); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `transfer_${formatDateISO(new Date())}.csv` });
    a.click();
  };

  const rangeLabel = range?.from && range?.to
    ? `${formatDateISO(range.from)} s/d ${formatDateISO(range.to)}`
    : range?.from ? `${formatDateISO(range.from)} s/d …` : 'Pilih tanggal';

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title="Transfer Stok" />
      <div className="relative min-h-[100vh] flex-1 overflow-hidden rounded-xl border border-sidebar-border/70 md:min-h-min dark:border-sidebar-border bg-white dark:bg-background p-4">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-4">
          <form className="flex-1" onSubmit={(e) => { e.preventDefault(); navigate({ search: query, page: 1 }); }}>
            <div className="relative w-full max-w-md">
              <span className="absolute inset-y-0 left-3 flex items-center text-muted-foreground pointer-events-none">
                <Search size={18} />
              </span>
              <input
                type="text"
                placeholder="Cari item / gudang / referensi..."
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
                  <CalendarIcon size={16} />{rangeLabel}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="p-0" align="start">
                <Calendar mode="range" selected={range} onSelect={handleDateRangeChange} numberOfMonths={1} defaultMonth={range?.from} className="w-auto max-w-md" />
              </PopoverContent>
            </Popover>
            <Button variant="outline" onClick={() => handleDateRangeChange(undefined)}>Clear</Button>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" className="gap-2" onClick={exportCSV} disabled={transfers.data.length === 0}>
              <Download size={16} /> Export CSV
            </Button>
            <Button onClick={openAdd} className="gap-2">
              <Plus size={16} /> Transfer Stok
            </Button>
          </div>
        </div>

        {/* Flash */}
        {flash?.success && (
          <div className="mb-3 rounded-md border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-800">{flash.success}</div>
        )}
        {pageErrors?.general && (
          <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">{pageErrors.general}</div>
        )}

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full border rounded-xl">
            <thead>
              <tr className="bg-muted">
                <th className="px-4 py-2 text-left cursor-pointer select-none" onClick={() => handleSort('date')}>Tanggal {sortIcon('date')}</th>
                <th className="px-4 py-2 text-left cursor-pointer select-none" onClick={() => handleSort('itemName')}>Item {sortIcon('itemName')}</th>
                <th className="px-4 py-2 text-left cursor-pointer select-none" onClick={() => handleSort('from')}>Dari {sortIcon('from')}</th>
                <th className="px-4 py-2 text-center">→</th>
                <th className="px-4 py-2 text-left cursor-pointer select-none" onClick={() => handleSort('to')}>Ke {sortIcon('to')}</th>
                <th className="px-4 py-2 text-left cursor-pointer select-none" onClick={() => handleSort('quantity')}>Qty {sortIcon('quantity')}</th>
                <th className="px-4 py-2 text-left cursor-pointer select-none" onClick={() => handleSort('reference')}>Ref/No {sortIcon('reference')}</th>
                <th className="px-4 py-2 text-left">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {transfers.data.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3 text-muted-foreground">
                      <ArrowLeftRight className="h-10 w-10 opacity-40" />
                      <div>
                        <p className="font-medium text-foreground">Belum ada transfer stok</p>
                        <p className="text-sm mt-1">Transfer stok untuk memindahkan barang antar gudang.</p>
                      </div>
                      <button
                        onClick={openAdd}
                        className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition"
                      >
                        <Plus size={15} /> Transfer Stok
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                transfers.data.map((row) => (
                  <tr key={row.id} className="border-b last:border-b-0">
                    <td className="px-4 py-2 text-sm">{formatDateISO(row.date)}</td>
                    <td className="px-4 py-2">{row.itemName}</td>
                    <td className="px-4 py-2 text-sm">{row.fromName}</td>
                    <td className="px-4 py-2 text-center text-muted-foreground"><ArrowRightLeft size={14} /></td>
                    <td className="px-4 py-2 text-sm">{row.toName}</td>
                    <td className="px-4 py-2 font-medium">{row.quantity}</td>
                    <td className="px-4 py-2 text-sm text-muted-foreground">{row.reference || '-'}</td>
                    <td className="px-4 py-2 flex gap-2">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button onClick={() => { setSelected(row); setIsDetailOpen(true); }} className="text-primary border border-white hover:bg-primary hover:text-slate-600 hover:border-0 p-2 rounded-full transition" aria-label="Lihat">
                              <Eye size={18} />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>Lihat Detail</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button onClick={() => handleDelete(row)} className="text-destructive bg-amber-50 hover:bg-destructive hover:text-amber-50 p-2 rounded-full transition" aria-label="Batalkan">
                              <Trash size={18} />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>Batalkan Transfer</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <Pagination meta={transfers} onPageChange={handlePage} />
      </div>

      {/* Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detail Transfer Stok</DialogTitle>
            <DialogDescription>Informasi perpindahan stok antar gudang.</DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-2 text-sm">
              <p><strong>ID Transfer:</strong> {selected.txnId}</p>
              <p><strong>Tanggal:</strong> {formatDateISO(selected.date)}</p>
              <p><strong>Item:</strong> {selected.itemName}</p>
              <div className="flex items-center gap-2">
                <span className="rounded bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-700">{selected.fromName}</span>
                <ArrowRightLeft size={14} className="text-muted-foreground" />
                <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">{selected.toName}</span>
              </div>
              <p><strong>Jumlah:</strong> {selected.quantity} unit</p>
              <p><strong>Referensi:</strong> {selected.reference || '-'}</p>
              <p><strong>Oleh:</strong> {selected.actor || '-'}</p>
              <p><strong>Catatan:</strong> {selected.note || '-'}</p>
              <p><strong>Status:</strong> <span className="rounded bg-muted px-2 py-0.5 text-xs">{selected.status}</span></p>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setIsDetailOpen(false)}>Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Transfer Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-lg">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>Transfer Stok Antar Gudang</DialogTitle>
              <DialogDescription>Pindahkan stok dari satu gudang ke gudang lain.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 mt-3">
              <div>
                <label className="block font-semibold mb-1">Tanggal</label>
                <input type="date" value={form.date} onChange={(e) => setForm(f => ({ ...f, date: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg" required />
                {formErrors.date && <p className="text-destructive text-sm mt-1">{formErrors.date}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Dari Gudang</label>
                  <select value={form.from_warehouse_id}
                    onChange={(e) => setForm(f => ({ ...f, from_warehouse_id: Number(e.target.value) }))}
                    className="w-full px-3 py-2 border rounded-lg">
                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                  {formErrors.from_warehouse_id && <p className="text-destructive text-sm mt-1">{formErrors.from_warehouse_id}</p>}
                </div>
                <div>
                  <label className="block font-semibold mb-1">Ke Gudang</label>
                  <select value={form.to_warehouse_id}
                    onChange={(e) => setForm(f => ({ ...f, to_warehouse_id: Number(e.target.value) }))}
                    className="w-full px-3 py-2 border rounded-lg">
                    {warehouses.filter(w => w.id !== form.from_warehouse_id).map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                  {formErrors.to_warehouse_id && <p className="text-destructive text-sm mt-1">{formErrors.to_warehouse_id}</p>}
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">Item</label>
                <select value={form.item_id}
                  onChange={(e) => {
                    const id = Number(e.target.value);
                    setForm(f => ({ ...f, item_id: id }));
                    setFromStock(itemOptions.find(i => i.id === id)?.stock ?? null);
                  }}
                  className="w-full px-3 py-2 border rounded-lg">
                  {itemOptions.map(it => (
                    <option key={it.id} value={it.id}>{it.name}{it.category ? ` — ${it.category}` : ''} (stok global: {it.stock})</option>
                  ))}
                </select>
                {formErrors.item_id && <p className="text-destructive text-sm mt-1">{formErrors.item_id}</p>}
              </div>

              <div>
                <label className="block font-semibold mb-1">Jumlah</label>
                <input type="number" min={1} value={form.quantity}
                  onChange={(e) => setForm(f => ({ ...f, quantity: Number(e.target.value) }))}
                  className="w-full px-3 py-2 border rounded-lg" required />
                {fromStock !== null && (
                  <p className="text-xs text-muted-foreground mt-0.5">Stok global item: <b>{fromStock}</b></p>
                )}
                {formErrors.quantity && <p className="text-destructive text-sm mt-1">{formErrors.quantity}</p>}
              </div>

              <div>
                <label className="block font-semibold mb-1">Referensi (opsional)</label>
                <input value={form.reference}
                  onChange={(e) => setForm(f => ({ ...f, reference: e.target.value }))}
                  placeholder="No. dokumen / referensi"
                  className="w-full px-3 py-2 border rounded-lg" />
              </div>

              <div>
                <label className="block font-semibold mb-1">Catatan (opsional)</label>
                <textarea value={form.note}
                  onChange={(e) => setForm(f => ({ ...f, note: e.target.value }))}
                  placeholder="Alasan transfer..."
                  className="w-full px-3 py-2 border rounded-lg" rows={2} />
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button type="submit" className="gap-2"><ArrowRightLeft size={16} /> Transfer</Button>
              <DialogClose asChild><Button type="button" variant="outline">Batal</Button></DialogClose>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
