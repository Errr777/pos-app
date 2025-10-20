import { useMemo, useState } from 'react';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import { Search, Eye, Download, Calendar as CalendarIcon } from 'lucide-react';
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
} from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { DateRange } from 'react-day-picker';

const breadcrumbs: BreadcrumbItem[] = [
  { title: 'Dashboard', href: '/dashboard' },
  { title: 'History Transactions', href: '/stock-history' },
];

// ---- Mock master items (replace with API)
const itemsMaster = Array.from({ length: 12 }).map((_, idx) => ({
  id: idx + 1,
  name: `Item ${String.fromCharCode(65 + (idx % 26))}`,
  category: ['General', 'Special', 'Minuman', 'Makanan'][idx % 4],
}));

type Direction = 'IN' | 'OUT';

type HistoryRow = {
  id: number;
  date: string;     // ISO
  itemId: number;
  itemName: string;
  direction: Direction;
  quantity: number; // IN = +qty, OUT = -qty
  party?: string;   // supplier (IN) / receiver (OUT)
  reference?: string;
  category?: string;
  qrcode?: string;
  note?: string;
};

// ---- Sample data: create IN + OUT then normalize to HistoryRow
const stockIns = Array.from({ length: 24 }).map((_, idx) => {
  const item = itemsMaster[idx % itemsMaster.length];
  const day = (idx % 27) + 1;
  return {
    id: idx + 1,
    date: new Date(2025, 5, day, 10, 0, 0).toISOString(), // June 2025
    itemId: item.id,
    itemName: item.name,
    direction: 'IN' as Direction,
    quantity: Math.floor(Math.random() * 40) + 5,
    party: ['PT Sumber Rejeki', 'CV Mitra Abadi', 'UD Maju Jaya'][idx % 3],
    reference: `IN-${1000 + idx}`,
    note: idx % 2 ? 'Restock harian' : 'Promo event',
    category: ['General', 'Special', 'Minuman', 'Makanan'][idx % 4],
    qrcode: Math.floor(Math.random() * 1000000).toString(),
  } satisfies HistoryRow;
});

const stockOuts = Array.from({ length: 28 }).map((_, idx) => {
  const item = itemsMaster[(idx + 3) % itemsMaster.length];
  const day = (idx % 27) + 1;
  const qty = Math.floor(Math.random() * 30) + 1;
  return {
    id: 5000 + idx,
    date: new Date(2025, 6, day, 15, 0, 0).toISOString(), // July 2025
    itemId: item.id,
    itemName: item.name,
    direction: 'OUT' as Direction,
    quantity: -qty, // negative for out
    party: ['Outlet A', 'Customer B', 'Produksi'][idx % 3],
    reference: `OUT-${2000 + idx}`,
    note: idx % 2 ? 'Pengiriman rutin' : 'Pemakaian internal',
    category: ['General', 'Special', 'Minuman', 'Makanan'][idx % 4],
    qrcode: Math.floor(Math.random() * 1000000).toString(),
  } satisfies HistoryRow;
});

const initialHistory: HistoryRow[] = [...stockIns, ...stockOuts];

const ITEMS_PER_PAGE = 20;

function pad(n: number) { return String(n).padStart(2, '0'); }
function formatDateISO(d: string | Date) {
  const dt = d instanceof Date ? d : new Date(d);
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}
function startOfDay(d: Date) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function endOfDay(d: Date) { const x = new Date(d); x.setHours(23,59,59,999); return x; }

export default function Stock_History() {
  const [rows] = useState<HistoryRow[]>(initialHistory);

  // table states
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'itemName' | 'direction' | 'quantity' | 'party' | 'reference'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);

  // date range
  const [range, setRange] = useState<DateRange | undefined>(undefined);

  // detail modal
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selected, setSelected] = useState<HistoryRow | null>(null);

  // ===== FILTER + SORT + PAGINATE =====
  const filtered = useMemo(() => {
    const q = query.toLowerCase();

    let res = rows.filter(r =>
      formatDateISO(r.date).includes(q) ||
      r.itemName.toLowerCase().includes(q) ||
      r.direction.toLowerCase().includes(q) ||
      String(Math.abs(r.quantity)).includes(q) ||
      (r.party?.toLowerCase().includes(q) ?? false) ||
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
      } else if (sortBy === 'direction') {
        valA = a.direction;
        valB = b.direction;
      } else if (sortBy === 'quantity') {
        // numeric compare; negative values (OUT) will naturally order
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
  const openDetail = (row: HistoryRow) => { setSelected(row); setIsDetailOpen(true); };

  // ===== TOTALS =====
  const totalIn = useMemo(
    () => filtered.reduce((s, r) => s + (r.direction === 'IN' ? r.quantity : 0), 0),
    [filtered]
  );
  const totalOut = useMemo(
    () => filtered.reduce((s, r) => s + (r.direction === 'OUT' ? -r.quantity : 0), 0),
    [filtered]
  );
  const netMoves = totalIn - totalOut; // positive means net added

  // ===== CSV EXPORT (filtered + sorted) =====
  const exportCSV = () => {
    const header = ['Tanggal','Item','Type','Qty','Party','Ref/No','Catatan'];
    const lines = sorted.map(r => [
      formatDateISO(r.date),
      r.itemName,
      r.direction,
      r.quantity, // negative for OUT
      r.party ?? '',
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
    a.download = `stock-history_${today}.csv`;
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
      <Head title="History Transactions" />
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
                placeholder="Cari tanggal / item / type / party / ref / catatan..."
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
              <PopoverContent className="p-0" align="start">
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
                <th className="px-4 py-2 text-left cursor-pointer select-none" onClick={() => handleSort('direction')}>
                  Type {sortIcon('direction')}
                </th>
                <th className="px-4 py-2 text-left cursor-pointer select-none" onClick={() => handleSort('quantity')}>
                  Qty {sortIcon('quantity')}
                </th>
                <th className="px-4 py-2 text-left cursor-pointer select-none" onClick={() => handleSort('party')}>
                  Party {sortIcon('party')}
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
                  <td colSpan={7} className="text-center py-6 text-muted-foreground">
                    Data tidak ditemukan
                  </td>
                </tr>
              ) : (
                paginated.map((row) => (
                  <tr key={`${row.direction}-${row.id}`} className="border-b last:border-b-0">
                    <td className="px-4 py-2">{formatDateISO(row.date)}</td>
                    <td className="px-4 py-2">{row.itemName}</td>
                    <td className="px-4 py-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold
                        ${row.direction === 'IN' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                        {row.direction}
                      </span>
                    </td>
                    <td className={`px-4 py-2 font-semibold ${row.quantity < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {row.quantity}
                    </td>
                    <td className="px-4 py-2">{row.party || '-'}</td>
                    <td className="px-4 py-2">{row.reference || '-'}</td>
                    <td className="px-4 py-2">
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
                      </TooltipProvider>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination + totals */}
        {sorted.length > 0 && (
          <div className="flex justify-between items-center mt-6 flex-wrap gap-2">
            <div className="text-sm text-muted-foreground space-x-4">
              <span>IN: <b className="text-emerald-700">{totalIn}</b></span>
              <span>OUT: <b className="text-rose-700">{totalOut}</b></span>
              <span>NET: <b className={`${netMoves >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{netMoves}</b></span>
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
            <DialogTitle>Detail Transaksi</DialogTitle>
            <DialogDescription>Informasi lengkap transaksi stok.</DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-2">
              <p><strong>Tanggal:</strong> {formatDateISO(selected.date)}</p>
              <p><strong>Item:</strong> {selected.itemName}</p>
              <p><strong>Type:</strong> {selected.direction}</p>
              <p><strong>Qty:</strong> {selected.quantity}</p>
              <p><strong>Party:</strong> {selected.party || '-'}</p>
              <p><strong>Ref/No:</strong> {selected.reference || '-'}</p>
              <p><strong>Kategori:</strong> {selected.category || '-'}</p>
              <p><strong>Kode:</strong> {selected.qrcode || '-'}</p>
              <p><strong>Catatan:</strong> {selected.note || '-'}</p>
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${selected.qrcode}`}
                alt="QR Code"
                className="mx-auto mt-4 rounded-lg border border-white p-3"
              />
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setIsDetailOpen(false)}>Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}