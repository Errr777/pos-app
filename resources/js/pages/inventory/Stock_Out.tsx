import { useMemo, useState } from 'react';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
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
  { title: 'Stock Out', href: '/stock-out' }, // ← stock move out
];

const itemsMaster = Array.from({ length: 12 }).map((_, idx) => ({
  id: idx + 1,
  name: `Item ${String.fromCharCode(65 + (idx % 26))}`,
  category: ['General', 'Special', 'Minuman', 'Makanan'][idx % 4],
}));

type StockOutRow = {
  id: number;
  date: string;        // ISO
  itemId: number;
  itemName: string;
  quantity: number;    // positive number = moved out
  receiver?: string;   // customer/department
  reference?: string;  // invoice/DO/req no
  note?: string;
};

const initialStockOuts: StockOutRow[] = Array.from({ length: 37 }).map((_, idx) => {
  const item = itemsMaster[idx % itemsMaster.length];
  const day = (idx % 27) + 1;
  return {
    id: idx + 1,
    date: new Date(2025, 6, day, 15, 0, 0).toISOString(), // July 2025 sample
    itemId: item.id,
    itemName: item.name,
    quantity: Math.floor(Math.random() * 30) + 1,
    receiver: ['Outlet A', 'Customer B', 'Produksi'][idx % 3],
    reference: `OUT-${2000 + idx}`,
    note: idx % 2 ? 'Pengiriman rutin' : 'Pemakaian internal',
  };
});

const ITEMS_PER_PAGE = 20;

function pad(n: number) { return String(n).padStart(2, '0'); }
function formatDateISO(d: string | Date) {
  const dt = d instanceof Date ? d : new Date(d);
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}
function startOfDay(d: Date) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function endOfDay(d: Date) { const x = new Date(d); x.setHours(23,59,59,999); return x; }

export default function Stock_Out() {
  const [rows, setRows] = useState<StockOutRow[]>(initialStockOuts);

  // table states
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'itemName' | 'quantity' | 'receiver' | 'reference'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);

  // Date range (react-day-picker)
  const [range, setRange] = useState<DateRange | undefined>(undefined);

  // detail modal
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selected, setSelected] = useState<StockOutRow | null>(null);

  // add/edit modal
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'add' | 'edit'>('add');
  const [form, setForm] = useState({
    id: 0,
    date: formatDateISO(new Date()),
    itemId: itemsMaster[0].id,
    quantity: 1,
    receiver: '',
    reference: '',
    note: '',
  });

  // ===== FILTER + SORT + PAGINATE =====
  const filtered = useMemo(() => {
    const q = query.toLowerCase();

    let res = rows.filter(r =>
      formatDateISO(r.date).includes(q) ||
      r.itemName.toLowerCase().includes(q) ||
      String(r.quantity).includes(q) ||
      (r.receiver?.toLowerCase().includes(q) ?? false) ||
      (r.reference?.toLowerCase().includes(q) ?? false) ||
      (r.note?.toLowerCase().includes(q) ?? false)
    );

    if (range?.from || range?.to) {
      const from = range?.from ? startOfDay(range.from).getTime() : -Infinity;
      const to = range?.to ? endOfDay(range.to).getTime() : Infinity;
      res = res.filter(r => {
        const t = new Date(r.date).getTime();
        return t >= from && t <= to;
      });
    }

    return res;
  }, [rows, query, range]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      let valA: any = a[sortBy];
      let valB: any = b[sortBy];
      if (sortBy === 'date') {
        valA = new Date(a.date).getTime();
        valB = new Date(b.date).getTime();
      } else {
        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();
      }
      if (valA < valB) return sortDir === 'asc' ? -1 : 1;
      if (valA > valB) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return copy;
  }, [filtered, sortBy, sortDir]);

  const totalPages = Math.ceil(sorted.length / ITEMS_PER_PAGE);
  const paginated = sorted.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const handleSort = (col: typeof sortBy) => {
    if (sortBy === col) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(col);
      setSortDir(col === 'date' ? 'desc' : 'asc');
    }
  };
  const sortIcon = (col: typeof sortBy) =>
    sortBy === col ? (sortDir === 'asc' ? '▲' : '▼') : '⇅';

  const gotoPage = (n: number) => { setPage(n); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => { setQuery(e.target.value); setPage(1); };
  const clearDateRange = () => { setRange(undefined); setPage(1); };

  // ===== DETAIL =====
  const openDetail = (row: StockOutRow) => { setSelected(row); setIsDetailOpen(true); };

  // ===== ADD / EDIT =====
  const openAddForm = () => {
    setFormMode('add');
    setForm({
      id: 0,
      date: formatDateISO(new Date()),
      itemId: itemsMaster[0].id,
      quantity: 1,
      receiver: '',
      reference: '',
      note: '',
    });
    setIsFormOpen(true);
  };
  const openEditForm = (row: StockOutRow) => {
    setFormMode('edit');
    setForm({
      id: row.id,
      date: formatDateISO(row.date),
      itemId: row.itemId,
      quantity: row.quantity,
      receiver: row.receiver ?? '',
      reference: row.reference ?? '',
      note: row.note ?? '',
    });
    setIsFormOpen(true);
  };
  const handleDelete = (id: number) => { if (confirm('Hapus data stock-out ini?')) setRows(prev => prev.filter(r => r.id !== id)); };
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const targetItem = itemsMaster.find(i => i.id === form.itemId)!;
    const qty = Math.max(0, Number(form.quantity));

    if (formMode === 'add') {
      const newRow: StockOutRow = {
        id: Date.now(),
        date: new Date(form.date + 'T00:00:00').toISOString(),
        itemId: targetItem.id,
        itemName: targetItem.name,
        quantity: qty,
        receiver: form.receiver || undefined,
        reference: form.reference || undefined,
        note: form.note || undefined,
      };
      setRows(prev => [newRow, ...prev]);
    } else {
      setRows(prev =>
        prev.map(r =>
          r.id === form.id
            ? {
                ...r,
                date: new Date(form.date + 'T00:00:00').toISOString(),
                itemId: targetItem.id,
                itemName: targetItem.name,
                quantity: qty,
                receiver: form.receiver || undefined,
                reference: form.reference || undefined,
                note: form.note || undefined,
              }
            : r
        )
      );
    }
    setIsFormOpen(false);
  };

  // ===== TOTALS =====
  const totalQty = useMemo(() => filtered.reduce((s, r) => s + r.quantity, 0), [filtered]);

  // ===== CSV EXPORT (filtered + sorted) =====
  const exportCSV = () => {
    const header = ['Tanggal','Item','Qty Out','Receiver','Ref/No','Catatan'];
    const lines = sorted.map(r => [
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
        const needQuote = /[",\n]/.test(s);
        const escaped = s.replace(/"/g, '""');
        return needQuote ? `"${escaped}"` : escaped;
      }).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const today = formatDateISO(new Date());
    a.href = url;
    a.download = `stock-out_${today}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const rangeLabel = (() => {
    if (range?.from && range?.to) return `${formatDateISO(range.from)} s/d ${formatDateISO(range.to)}`;
    if (range?.from) return `${formatDateISO(range.from)} s/d …`;
    return 'Pilih tanggal';
  })();

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title="Stock Out" />
      <div className="relative min-h-[100vh] flex-1 overflow-hidden rounded-xl border border-sidebar-border/70 md:min-h-min dark:border-sidebar-border bg-white dark:bg-background p-4">
        {/* Header actions */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative w-full max-w-md">
              <span className="absolute inset-y-0 left-3 flex items-center text-muted-foreground pointer-events-none">
                <Search size={18} />
              </span>
              <input
                type="text"
                placeholder="Cari tanggal / item / receiver / ref / catatan..."
                className="w-full px-10 py-2 border rounded-lg bg-muted pl-12"
                value={query}
                onChange={handleQueryChange}
                style={{ minWidth: 240 }}
              />
            </div>
          </div>

          {/* Date Range Picker */}
          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <CalendarIcon size={16} />
                  {rangeLabel}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="p-0 " align="start">
                <Calendar
                  mode="range"
                  selected={range}
                  onSelect={(r) => { setRange(r); setPage(1); }}
                  numberOfMonths={1}
                  defaultMonth={range?.from}
                    className="w-auto max-w-md"
                />
              </PopoverContent>
            </Popover>
            <Button variant="outline" onClick={clearDateRange}>
              Clear
            </Button>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="gap-2"
              onClick={exportCSV}
              disabled={sorted.length === 0}
            >
              <Download size={16} />
              Export CSV
            </Button>
            <Button onClick={openAddForm} className="gap-2">
              <Plus size={16} />
              <span>Tambah Stock-Out</span>
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
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-6 text-muted-foreground">
                    Data tidak ditemukan
                  </td>
                </tr>
              ) : (
                paginated.map((row) => (
                  <tr key={row.id} className="border-b last:border-b-0">
                    <td className="px-4 py-2">{formatDateISO(row.date)}</td>
                    <td className="px-4 py-2">{row.itemName}</td>
                    <td className="px-4 py-2">{row.quantity}</td>
                    <td className="px-4 py-2">{row.receiver || '-'}</td>
                    <td className="px-4 py-2">{row.reference || '-'}</td>
                    <td className="px-4 py-2 flex gap-2">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => openDetail(row)}
                              className="text-primary border border-white hover:bg-primary hover:text-slate-600 hover:border-0 p-2 rounded-full transition"
                              aria-label="Lihat"
                            >
                              <Eye size={18} />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>Lihat Detail</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => openEditForm(row)}
                              className="text-primary border border-white hover:bg-primary hover:text-slate-600 hover:border-0 p-2 rounded-full transition"
                              aria-label="Edit"
                            >
                              <Pencil size={18} />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>Edit</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => handleDelete(row.id)}
                              className="text-destructive bg-amber-50 hover:bg-destructive hover:text-amber-50 p-2 rounded-full transition"
                              aria-label="Hapus"
                            >
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

        {/* Pagination + total */}
        {sorted.length > 0 && (
          <div className="flex justify-between items-center mt-6 flex-wrap gap-2">
            <div className="text-sm text-muted-foreground">
              Total qty out (filtered): <b>{totalQty}</b>
            </div>
            <div className="flex justify-center gap-2">
              {Array.from({ length: Math.max(totalPages, 1) }).map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => gotoPage(idx + 1)}
                  className={`px-3 py-1 rounded border ${page === idx + 1 ? 'bg-primary text-white' : 'bg-muted'}`}
                >
                  {idx + 1}
                </button>
              ))}
            </div>
          </div>
        )}
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
              <p><strong>Catatan:</strong> {selected.note || '-'}</p>
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
              </div>
              <div>
                <label className="block font-semibold mb-1">Item</label>
                <select
                  value={form.itemId}
                  onChange={(e) => setForm((f) => ({ ...f, itemId: Number(e.target.value) }))}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  {itemsMaster.map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.name} — {it.category}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold mb-1">Qty Out</label>
                <input
                  type="number"
                  min={0}
                  value={form.quantity}
                  onChange={(e) => setForm((f) => ({ ...f, quantity: Number(e.target.value) }))}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                />
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