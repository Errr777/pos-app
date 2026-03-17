import { useEffect, useState } from 'react';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import { Search, Plus, Eye, Download, ClipboardCheck, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter, DialogClose,
} from '@/components/ui/dialog';
import { DatePickerInput, DatePickerFilter } from '@/components/DatePickerInput';
import Pagination from '@/components/Pagination';

const breadcrumbs: BreadcrumbItem[] = [
  { title: 'Dashboard', href: '/dashboard' },
  { title: 'Penyesuaian Stok', href: '/inventory/adjustments' },
];

interface AdjRow {
  id: number;
  txnId: string;
  date: string;
  itemId: number;
  itemName: string;
  warehouseId: number;
  warehouseName: string;
  oldQty: number;
  newQty: number;
  difference: number;
  reason?: string | null;
  actor?: string | null;
  note?: string | null;
}

interface WarehouseOption { id: number; code: string; name: string; }
interface ItemOption      { id: number; name: string; category: string | null; stock: number; }

interface PaginatedAdj {
  data: AdjRow[];
  current_page: number; last_page: number; per_page: number;
  total: number; from: number | null; to: number | null;
}

interface PageProps {
  adjustments: PaginatedAdj;
  warehouses: WarehouseOption[];
  items: ItemOption[];
  reasons: string[];
  filters: { search?: string; date_from?: string; date_to?: string; sort_by?: string; sort_dir?: string; per_page?: string | number; };
  flash?: { success?: string };
  [key: string]: unknown;
}

function pad(n: number) { return String(n).padStart(2, '0'); }
function formatDateISO(d: string | Date | null | undefined): string {
  if (!d) return '';
  const dt = d instanceof Date ? d : new Date(d);
  if (isNaN(dt.getTime())) return '';
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

export default function Stock_Adjustment() {
  const { props } = usePage<PageProps>();
  const { adjustments, warehouses, items: itemOptions, reasons, filters, flash } = props;

  const [query, setQuery]     = useState(filters.search ?? '');
  const [sortBy, setSortBy]   = useState(filters.sort_by ?? 'date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(filters.sort_dir === 'asc' ? 'asc' : 'desc');
  const [dateFrom, setDateFrom] = useState<string>(filters.date_from ?? '');
  const [dateTo, setDateTo]     = useState<string>(filters.date_to ?? '');

  useEffect(() => {
    setQuery(filters.search ?? '');
    setSortBy(filters.sort_by ?? 'date');
    setSortDir(filters.sort_dir === 'asc' ? 'asc' : 'desc');
    setDateFrom(filters.date_from ?? '');
    setDateTo(filters.date_to ?? '');
  }, [filters]);

  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selected, setSelected]         = useState<AdjRow | null>(null);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [itemSearch, setItemSearch] = useState('');
  const filteredItems = itemOptions.filter((it) =>
    it.name.toLowerCase().includes(itemSearch.toLowerCase()) ||
    (it.category && it.category.toLowerCase().includes(itemSearch.toLowerCase()))
  );
  const [form, setForm] = useState({
    warehouse_id: warehouses[0]?.id ?? 0,
    item_id:      itemOptions[0]?.id ?? 0,
    new_quantity: 0,
    date:         formatDateISO(new Date()),
    reason:       reasons[0] ?? '',
    note:         '',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [currentStock, setCurrentStock] = useState<number | null>(null);
  const [loadingStock, setLoadingStock] = useState(false);

  const navigate = (overrides: Record<string, unknown> = {}) =>
    router.get(route('stock_adjustment.index'), {
      search: query,
      date_from: dateFrom || undefined,
      date_to:   dateTo || undefined,
      sort_by: sortBy, sort_dir: sortDir, per_page: filters.per_page ?? 20, ...overrides,
    }, { preserveState: true, replace: true });

  const handleSort = (col: string) => {
    const d: 'asc' | 'desc' = sortBy === col ? (sortDir === 'asc' ? 'desc' : 'asc') : 'desc';
    setSortBy(col); setSortDir(d); navigate({ sort_by: col, sort_dir: d });
  };
  const sortIcon = (col: string) => sortBy === col ? (sortDir === 'asc' ? '▲' : '▼') : '⇅';
  const handlePage = (page: number) => navigate({ page });

  // Fetch real warehouse stock when warehouse or item changes
  const fetchStock = async (warehouseId: number, itemId: number) => {
    if (!warehouseId || !itemId) return;
    setLoadingStock(true);
    try {
      const res = await fetch(route('stock_adjustment.warehouse_stock') + `?warehouse_id=${warehouseId}&item_id=${itemId}`);
      const json = await res.json();
      setCurrentStock(json.stock ?? 0);
      setForm(f => ({ ...f, new_quantity: json.stock ?? 0 }));
    } catch { setCurrentStock(null); }
    finally { setLoadingStock(false); }
  };

  const openAdd = async () => {
    setFormErrors({});
    setItemSearch('');
    const wid = warehouses[0]?.id ?? 0;
    const iid = itemOptions[0]?.id ?? 0;
    setForm({ warehouse_id: wid, item_id: iid, new_quantity: 0, date: formatDateISO(new Date()), reason: reasons[0] ?? '', note: '' });
    setIsFormOpen(true);
    await fetchStock(wid, iid);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});
    router.post(route('stock_adjustment.store'), {
      warehouse_id: form.warehouse_id,
      item_id:      form.item_id,
      new_quantity: form.new_quantity,
      date:         form.date,
      reason:       form.reason || null,
      note:         form.note || null,
    }, {
      onSuccess: () => setIsFormOpen(false),
      onError:   (errs) => setFormErrors(errs),
    });
  };

  const exportCSV = () => {
    const header = ['Tanggal', 'Item', 'Outlet', 'Stok Lama', 'Stok Baru', 'Selisih', 'Alasan', 'Actor'];
    const lines  = adjustments.data.map(r => [
      formatDateISO(r.date), r.itemName, r.warehouseName,
      r.oldQty, r.newQty, r.difference, r.reason ?? '', r.actor ?? '',
    ]);
    const csv = [header, ...lines].map(row => row.map(c => {
      const s = String(c); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(',')).join('\n');
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' })),
      download: `adjustment_${formatDateISO(new Date())}.csv`,
    });
    a.click();
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

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title="Penyesuaian Stok" />
      <div className="relative min-h-[100vh] flex-1 overflow-hidden rounded-xl border border-sidebar-border/70 md:min-h-min dark:border-sidebar-border bg-white dark:bg-background p-4">

        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-4">
          <form className="flex-1" onSubmit={(e) => { e.preventDefault(); navigate({ search: query, page: 1 }); }}>
            <div className="relative w-full max-w-md">
              <span className="absolute inset-y-0 left-3 flex items-center text-muted-foreground pointer-events-none"><Search size={18} /></span>
              <input type="text" placeholder="Cari item / gudang / alasan..."
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
            <Button variant="outline" className="gap-2" onClick={exportCSV} disabled={adjustments.data.length === 0}>
              <Download size={16} /> Export CSV
            </Button>
            <Button onClick={openAdd} className="gap-2">
              <Plus size={16} /> Penyesuaian Stok
            </Button>
          </div>
        </div>

        {flash?.success && (
          <div className="mb-3 rounded-md border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-800">{flash.success}</div>
        )}

        <div className="overflow-x-auto">
          <table className="min-w-full border rounded-xl">
            <thead>
              <tr className="bg-muted">
                <th className="px-4 py-2 text-left cursor-pointer select-none" onClick={() => handleSort('date')}>Tanggal {sortIcon('date')}</th>
                <th className="px-4 py-2 text-left cursor-pointer select-none" onClick={() => handleSort('itemName')}>Item {sortIcon('itemName')}</th>
                <th className="px-4 py-2 text-left cursor-pointer select-none" onClick={() => handleSort('warehouse')}>Outlet {sortIcon('warehouse')}</th>
                <th className="px-4 py-2 text-right">Stok Lama</th>
                <th className="px-4 py-2 text-right">Stok Baru</th>
                <th className="px-4 py-2 text-right cursor-pointer select-none" onClick={() => handleSort('difference')}>Selisih {sortIcon('difference')}</th>
                <th className="px-4 py-2 text-left">Alasan</th>
                <th className="px-4 py-2 text-left">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {adjustments.data.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3 text-muted-foreground">
                      <SlidersHorizontal className="h-10 w-10 opacity-40" />
                      <div>
                        <p className="font-medium text-foreground">Belum ada penyesuaian stok</p>
                        <p className="text-sm mt-1">Gunakan penyesuaian stok untuk mengkoreksi jumlah stok yang tidak sesuai.</p>
                      </div>
                      <button
                        onClick={openAdd}
                        className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition"
                      >
                        <Plus size={15} /> Penyesuaian Stok
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                adjustments.data.map((row) => (
                  <tr key={row.id} className="border-b last:border-b-0">
                    <td className="px-4 py-2 text-sm">{formatDateISO(row.date)}</td>
                    <td className="px-4 py-2">{row.itemName}</td>
                    <td className="px-4 py-2 text-sm">{row.warehouseName}</td>
                    <td className="px-4 py-2 text-right text-muted-foreground">{row.oldQty}</td>
                    <td className="px-4 py-2 text-right font-medium">{row.newQty}</td>
                    <td className="px-4 py-2 text-right">
                      <span className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${
                        row.difference > 0 ? 'bg-emerald-100 text-emerald-700' :
                        row.difference < 0 ? 'bg-red-100 text-red-700' : 'bg-muted text-muted-foreground'
                      }`}>
                        {row.difference > 0 ? '+' : ''}{row.difference}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-sm text-muted-foreground">{row.reason || '-'}</td>
                    <td className="px-4 py-2">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button onClick={() => { setSelected(row); setIsDetailOpen(true); }}
                              className="text-primary border border-white hover:bg-primary hover:text-slate-600 hover:border-0 p-2 rounded-full transition" aria-label="Lihat">
                              <Eye size={18} />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>Lihat Detail</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <Pagination meta={adjustments} onPageChange={handlePage} />
      </div>

      {/* Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detail Penyesuaian Stok</DialogTitle>
            <DialogDescription>Informasi penyesuaian / opname stok.</DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-2 text-sm">
              <p><strong>ID:</strong> {selected.txnId}</p>
              <p><strong>Tanggal:</strong> {formatDateISO(selected.date)}</p>
              <p><strong>Item:</strong> {selected.itemName}</p>
              <p><strong>Outlet:</strong> {selected.warehouseName}</p>
              <div className="flex items-center gap-4 rounded-md bg-muted p-3">
                <div className="text-center"><div className="text-lg font-bold">{selected.oldQty}</div><div className="text-xs text-muted-foreground">Stok Lama</div></div>
                <div className="text-muted-foreground">→</div>
                <div className="text-center"><div className="text-lg font-bold">{selected.newQty}</div><div className="text-xs text-muted-foreground">Stok Baru</div></div>
                <div className="text-muted-foreground">|</div>
                <div className="text-center">
                  <div className={`text-lg font-bold ${selected.difference > 0 ? 'text-emerald-600' : selected.difference < 0 ? 'text-red-600' : ''}`}>
                    {selected.difference > 0 ? '+' : ''}{selected.difference}
                  </div>
                  <div className="text-xs text-muted-foreground">Selisih</div>
                </div>
              </div>
              <p><strong>Alasan:</strong> {selected.reason || '-'}</p>
              <p><strong>Oleh:</strong> {selected.actor || '-'}</p>
              <p><strong>Catatan:</strong> {selected.note || '-'}</p>
            </div>
          )}
          <DialogFooter><Button onClick={() => setIsDetailOpen(false)}>Tutup</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-lg">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>Penyesuaian / Opname Stok</DialogTitle>
              <DialogDescription>Sesuaikan stok aktual di gudang dengan hasil hitungan fisik.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 mt-3">
              <div>
                <label className="block font-semibold mb-1">Tanggal</label>
                <DatePickerInput value={form.date} onChange={(v) => setForm(f => ({ ...f, date: v }))} />
                {formErrors.date && <p className="text-destructive text-sm mt-1">{formErrors.date}</p>}
              </div>
              <div>
                <label className="block font-semibold mb-1">Outlet</label>
                <select value={form.warehouse_id}
                  onChange={async (e) => {
                    const wid = Number(e.target.value);
                    setForm(f => ({ ...f, warehouse_id: wid }));
                    await fetchStock(wid, form.item_id);
                  }}
                  className="w-full px-3 py-2 border rounded-lg">
                  {warehouses.map(w => <option key={w.id} value={w.id}>{w.name} ({w.code})</option>)}
                </select>
                {formErrors.warehouse_id && <p className="text-destructive text-sm mt-1">{formErrors.warehouse_id}</p>}
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
                <select value={form.item_id}
                  onChange={async (e) => {
                    const iid = Number(e.target.value);
                    setForm(f => ({ ...f, item_id: iid }));
                    await fetchStock(form.warehouse_id, iid);
                  }}
                  className="w-full px-3 py-2 border rounded-b-lg"
                  size={Math.min(Math.max(filteredItems.length, 1), 6)}
                >
                  {filteredItems.map(it => (
                    <option key={it.id} value={it.id}>{it.name}{it.category ? ` — ${it.category}` : ''}</option>
                  ))}
                </select>
                {formErrors.item_id && <p className="text-destructive text-sm mt-1">{formErrors.item_id}</p>}
              </div>

              {/* Current stock info */}
              <div className="rounded-md bg-muted p-3 text-sm flex items-center justify-between">
                <span className="text-muted-foreground">Stok sistem saat ini:</span>
                <span className="font-semibold">
                  {loadingStock ? '...' : (currentStock !== null ? currentStock : '-')} unit
                </span>
              </div>

              <div>
                <label className="block font-semibold mb-1">Stok Aktual (Hasil Hitung Fisik)</label>
                <input type="number" min={0} value={form.new_quantity}
                  onChange={(e) => setForm(f => ({ ...f, new_quantity: Number(e.target.value) }))}
                  className="w-full px-3 py-2 border rounded-lg" required />
                {currentStock !== null && (
                  <p className={`text-xs mt-0.5 font-medium ${
                    form.new_quantity > currentStock ? 'text-emerald-600' :
                    form.new_quantity < currentStock ? 'text-red-600' : 'text-muted-foreground'
                  }`}>
                    Selisih: {form.new_quantity > currentStock ? '+' : ''}{form.new_quantity - currentStock}
                  </p>
                )}
                {formErrors.new_quantity && <p className="text-destructive text-sm mt-1">{formErrors.new_quantity}</p>}
              </div>

              <div>
                <label className="block font-semibold mb-1">Alasan Penyesuaian</label>
                <select value={form.reason} onChange={(e) => setForm(f => ({ ...f, reason: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg">
                  {reasons.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1">Catatan (opsional)</label>
                <textarea value={form.note} onChange={(e) => setForm(f => ({ ...f, note: e.target.value }))}
                  placeholder="Detail penyesuaian..." className="w-full px-3 py-2 border rounded-lg" rows={2} />
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button type="submit" className="gap-2"><ClipboardCheck size={16} /> Simpan Penyesuaian</Button>
              <DialogClose asChild><Button type="button" variant="outline">Batal</Button></DialogClose>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
