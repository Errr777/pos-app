import { useEffect, useState } from 'react';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import { Search, Eye, Download } from 'lucide-react';
import Pagination from '@/components/Pagination';
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
import { DatePickerFilter } from '@/components/DatePickerInput';

const breadcrumbs: BreadcrumbItem[] = [
  { title: 'Dashboard', href: '/dashboard' },
  { title: 'Log Stock', href: '/inventory/stock_log' },
];

type Direction = 'IN' | 'OUT';

interface LogRow {
  id: number;
  date: string;
  itemId: number | null;
  itemName: string;
  direction: Direction;
  quantity: number;
  balanceAfter: number | null;
  actor: string | null;
  source: string | null;
  party?: string | null;
  reference?: string | null;
  category?: string | null;
  qrcode?: string | null;
  note?: string | null;
}

interface PaginationLink {
  url: string | null;
  label: string;
  active: boolean;
}

interface PaginatedMovements {
  data: LogRow[];
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

interface PageProps {
  movements: PaginatedMovements;
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

export default function Stock_Log() {
  const { props } = usePage<PageProps>();
  const { movements, filters } = props;

  const [query, setQuery] = useState<string>(filters.search ?? '');
  const [sortBy, setSortBy] = useState<string>(filters.sort_by ?? 'date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(
    filters.sort_dir === 'asc' ? 'asc' : 'desc'
  );
  const [dateFrom, setDateFrom] = useState<string>(filters.date_from ?? '');
  const [dateTo, setDateTo] = useState<string>(filters.date_to ?? '');

  useEffect(() => {
    setQuery(filters.search ?? '');
    setSortBy(filters.sort_by ?? 'date');
    setSortDir(filters.sort_dir === 'asc' ? 'asc' : 'desc');
    setDateFrom(filters.date_from ?? '');
    setDateTo(filters.date_to ?? '');
  }, [filters]);

  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selected, setSelected] = useState<LogRow | null>(null);

  const navigate = (overrides: Record<string, unknown> = {}) => {
    router.get(
      route('Stock_Log'),
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

  const openDetail = (row: LogRow) => { setSelected(row); setIsDetailOpen(true); };

  const exportCSV = () => {
    const header = ['Tanggal', 'Item', 'Type', 'Qty', 'Saldo Setelah', 'Aktor', 'Sumber', 'Party', 'Ref', 'Catatan'];
    const lines = movements.data.map(r => [
      formatDateISO(r.date),
      r.itemName,
      r.direction,
      r.quantity,
      r.balanceAfter ?? '',
      r.actor ?? '',
      r.source ?? '',
      r.party ?? '',
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
    a.download = `stock-log_${formatDateISO(new Date())}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const meta = movements;

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title="Log Stock" />
      <div className="relative min-h-[100vh] flex-1 overflow-hidden rounded-xl border border-sidebar-border/70 md:min-h-min dark:border-sidebar-border bg-white dark:bg-background p-4">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-4">
          <form className="flex-1" onSubmit={handleSearchSubmit}>
            <div className="relative w-full max-w-md">
              <span className="absolute inset-y-0 left-3 flex items-center text-muted-foreground pointer-events-none">
                <Search size={18} />
              </span>
              <input
                type="text"
                placeholder="Cari item / aktor / sumber / ref / catatan..."
                className="w-full px-10 py-2 border rounded-lg bg-muted pl-12"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onBlur={() => navigate({ search: query, page: 1 })}
                style={{ minWidth: 240 }}
              />
            </div>
          </form>

          <div className="flex items-center gap-2">
            <DatePickerFilter value={dateFrom} onChange={handleDateFromChange} placeholder="Dari tanggal" />
            <DatePickerFilter value={dateTo} onChange={handleDateToChange} placeholder="Sampai tanggal" />
            <Button variant="outline" onClick={clearDates}>Clear</Button>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" className="gap-2" onClick={exportCSV} disabled={movements.data.length === 0}>
              <Download size={16} />
              Export CSV
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full border rounded-xl">
            <thead>
              <tr className="bg-muted">
                <th className="px-4 py-2 cursor-pointer select-none text-left" onClick={() => handleSort('date')}>Tanggal {sortIcon('date')}</th>
                <th className="px-4 py-2 cursor-pointer select-none text-left" onClick={() => handleSort('itemName')}>Item {sortIcon('itemName')}</th>
                <th className="px-4 py-2 cursor-pointer select-none text-left" onClick={() => handleSort('direction')}>Type {sortIcon('direction')}</th>
                <th className="px-4 py-2 cursor-pointer select-none text-left" onClick={() => handleSort('quantity')}>Qty {sortIcon('quantity')}</th>
                <th className="px-4 py-2 text-left">Saldo</th>
                <th className="px-4 py-2 cursor-pointer select-none text-left" onClick={() => handleSort('actor')}>Aktor {sortIcon('actor')}</th>
                <th className="px-4 py-2 cursor-pointer select-none text-left" onClick={() => handleSort('source')}>Sumber {sortIcon('source')}</th>
                <th className="px-4 py-2 text-left">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {movements.data.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-6 text-muted-foreground">
                    Data tidak ditemukan
                  </td>
                </tr>
              ) : (
                movements.data.map((row) => (
                  <tr key={row.id} className="border-b last:border-b-0">
                    <td className="px-4 py-2">{formatDateISO(row.date)}</td>
                    <td className="px-4 py-2">{row.itemName}</td>
                    <td className="px-4 py-2">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold
                        ${row.direction === 'IN' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                        {row.direction}
                      </span>
                    </td>
                    <td className={`px-4 py-2 font-semibold ${row.quantity < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {row.quantity}
                    </td>
                    <td className="px-4 py-2">{row.balanceAfter ?? '-'}</td>
                    <td className="px-4 py-2">{row.actor ?? '-'}</td>
                    <td className="px-4 py-2">{row.source ?? '-'}</td>
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

        <Pagination meta={meta} onPageChange={handlePage} />
      </div>

      {/* Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detail Log Stok</DialogTitle>
            <DialogDescription>Audit trail perubahan stok.</DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-2">
              <p><strong>Tanggal:</strong> {formatDateISO(selected.date)}</p>
              <p><strong>Item:</strong> {selected.itemName}</p>
              <p><strong>Type:</strong> {selected.direction}</p>
              <p><strong>Qty:</strong> {selected.quantity}</p>
              <p><strong>Saldo Setelah:</strong> {selected.balanceAfter ?? '-'}</p>
              <p><strong>Aktor:</strong> {selected.actor ?? '-'}</p>
              <p><strong>Sumber:</strong> {selected.source ?? '-'}</p>
              <p><strong>Party:</strong> {selected.party || '-'}</p>
              <p><strong>Ref:</strong> {selected.reference || '-'}</p>
              <p><strong>Kategori:</strong> {selected.category || '-'}</p>
              <p><strong>Kode:</strong> {selected.qrcode || '-'}</p>
              <p><strong>Catatan:</strong> {selected.note || '-'}</p>
              {selected.qrcode && (
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${selected.qrcode}`}
                  alt="QR Code"
                  className="mx-auto mt-4 rounded-lg border p-3"
                />
              )}
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
