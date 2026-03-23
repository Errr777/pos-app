import { useState, useEffect } from 'react';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import { Search, Eye, Download } from 'lucide-react';
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
  { title: 'Laporan Stok', href: '/report/stock' },
];

interface ReportRow {
  id: number;
  kode: string | null;
  name: string;
  category: string | null;
  stock: number;
  stock_min: number;
  total_in: number;
  total_out: number;
}

interface PaginationLink {
  url: string | null;
  label: string;
  active: boolean;
}

interface PaginatedItems {
  data: ReportRow[];
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
  items: PaginatedItems;
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

export default function ReportStock() {
  const { props } = usePage<PageProps>();
  const { items, filters } = props;

  const [query, setQuery] = useState<string>(filters.search ?? '');
  const [sortBy, setSortBy] = useState<string>(filters.sort_by ?? 'name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(
    filters.sort_dir === 'desc' ? 'desc' : 'asc'
  );
  const [dateFrom, setDateFrom] = useState<string>(filters.date_from ?? '');
  const [dateTo, setDateTo] = useState<string>(filters.date_to ?? '');

  useEffect(() => {
    setQuery(filters.search ?? '');
    setSortBy(filters.sort_by ?? 'name');
    setSortDir(filters.sort_dir === 'desc' ? 'desc' : 'asc');
    setDateFrom(filters.date_from ?? '');
    setDateTo(filters.date_to ?? '');
  }, [filters]);

  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selected, setSelected] = useState<ReportRow | null>(null);

  const navigate = (overrides: Record<string, unknown> = {}) => {
    router.get(
      route('Report_Stock'),
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
    const newDir: 'asc' | 'desc' = sortBy === col ? (sortDir === 'asc' ? 'desc' : 'asc') : 'asc';
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

  const openDetail = (row: ReportRow) => { setSelected(row); setIsDetailOpen(true); };

  const exportCsvUrl = () => {
    const params = new URLSearchParams();
    if (query) params.set('search', query);
    if (dateFrom) params.set('date_from', dateFrom);
    if (dateTo) params.set('date_to', dateTo);
    return route('report.stock.csv') + (params.toString() ? '?' + params.toString() : '');
  };

  const meta = items;

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title="Laporan Stok" />
      <div className="relative min-h-[100vh] flex-1 overflow-hidden rounded-xl border border-sidebar-border/70 md:min-h-min dark:border-sidebar-border bg-white dark:bg-background p-4">

        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-4">
          <form className="flex-1" onSubmit={handleSearchSubmit}>
            <div className="relative w-full max-w-md">
              <span className="absolute inset-y-0 left-3 flex items-center text-muted-foreground pointer-events-none">
                <Search size={18} />
              </span>
              <input
                type="text"
                placeholder="Cari nama / kode / kategori..."
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

          <a href={exportCsvUrl()}>
            <Button variant="outline" className="gap-2" disabled={items.total === 0}>
              <Download size={16} />
              CSV
            </Button>
          </a>
          <a href={route('report.stock.excel')}>
            <Button variant="outline" className="gap-2 bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:border-emerald-700 dark:text-emerald-400">
              <Download size={16} />
              Excel
            </Button>
          </a>
        </div>

        <p className="text-xs text-muted-foreground mb-3">
          {dateFrom
            ? `Stok masuk/keluar dihitung dalam rentang tanggal yang dipilih. Stok saat ini selalu menampilkan nilai terkini.`
            : `Menampilkan semua item. Pilih tanggal untuk memfilter jumlah masuk/keluar.`}
        </p>

        <div className="overflow-x-auto">
          <table className="min-w-full border rounded-xl">
            <thead>
              <tr className="bg-muted">
                <th className="px-4 py-2 text-left cursor-pointer select-none" onClick={() => handleSort('code')}>
                  Kode {sortIcon('code')}
                </th>
                <th className="px-4 py-2 text-left cursor-pointer select-none" onClick={() => handleSort('name')}>
                  Nama {sortIcon('name')}
                </th>
                <th className="px-4 py-2 text-left cursor-pointer select-none" onClick={() => handleSort('category')}>
                  Kategori {sortIcon('category')}
                </th>
                <th className="px-4 py-2 text-right cursor-pointer select-none" onClick={() => handleSort('total_in')}>
                  Masuk {sortIcon('total_in')}
                </th>
                <th className="px-4 py-2 text-right cursor-pointer select-none" onClick={() => handleSort('total_out')}>
                  Keluar {sortIcon('total_out')}
                </th>
                <th className="px-4 py-2 text-right cursor-pointer select-none" onClick={() => handleSort('stock')}>
                  Stok Saat Ini {sortIcon('stock')}
                </th>
                <th className="px-4 py-2 text-right cursor-pointer select-none" onClick={() => handleSort('stock_min')}>
                  Stok Min {sortIcon('stock_min')}
                </th>
                <th className="px-4 py-2 text-left">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {items.data.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-6 text-muted-foreground">
                    Data tidak ditemukan
                  </td>
                </tr>
              ) : (
                items.data.map((row) => (
                  <tr key={row.id} className="border-b last:border-b-0">
                    <td className="px-4 py-2 text-sm font-mono">{row.kode || '-'}</td>
                    <td className="px-4 py-2 font-medium">{row.name}</td>
                    <td className="px-4 py-2 text-sm text-muted-foreground">{row.category || '-'}</td>
                    <td className="px-4 py-2 text-right text-emerald-700 font-semibold">+{row.total_in}</td>
                    <td className="px-4 py-2 text-right text-rose-600 font-semibold">-{row.total_out}</td>
                    <td className={`px-4 py-2 text-right font-bold ${row.stock <= row.stock_min ? 'text-rose-600' : ''}`}>
                      {row.stock}
                      {row.stock <= row.stock_min && (
                        <span className="ml-1 text-xs bg-rose-100 text-rose-600 px-1 rounded">min</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right text-muted-foreground">{row.stock_min}</td>
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

        <div className="flex justify-between items-center mt-6 flex-wrap gap-2">
          <div className="text-sm text-muted-foreground">
            {meta.total > 0 && (
              <span>
                Halaman {meta.current_page} / {meta.last_page} &nbsp;·&nbsp; {meta.total} item
              </span>
            )}
          </div>
          {meta.last_page > 1 && (
            <div className="flex justify-center gap-2 flex-wrap">
              {Array.from({ length: meta.last_page }).map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => handlePage(idx + 1)}
                  className={`px-3 py-1 rounded border ${meta.current_page === idx + 1 ? 'bg-primary text-white' : 'bg-muted'}`}
                >
                  {idx + 1}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Detail Modal */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detail Stok — {selected?.name}</DialogTitle>
            <DialogDescription>Informasi lengkap item dan pergerakan stok.</DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-2">
              <p><strong>Kode:</strong> <span className="font-mono">{selected.kode || '-'}</span></p>
              <p><strong>Nama:</strong> {selected.name}</p>
              <p><strong>Kategori:</strong> {selected.category || '-'}</p>
              <p><strong>Stok Saat Ini:</strong> <span className={selected.stock <= selected.stock_min ? 'text-rose-600 font-bold' : 'font-bold'}>{selected.stock}</span></p>
              <p><strong>Stok Minimal:</strong> {selected.stock_min}</p>
              <hr />
              <p><strong>Total Masuk</strong> {dateFrom ? '(periode)' : '(semua waktu)'}:
                <span className="ml-2 text-emerald-700 font-semibold">+{selected.total_in}</span>
              </p>
              <p><strong>Total Keluar</strong> {dateFrom ? '(periode)' : '(semua waktu)'}:
                <span className="ml-2 text-rose-600 font-semibold">-{selected.total_out}</span>
              </p>
              {selected.kode && (
                <div className="pt-2">
                  <p className="text-sm text-muted-foreground mb-1">QR Code (Kode Item):</p>
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(selected.kode)}`}
                    alt="QR Code"
                    className="mx-auto rounded-lg border p-3"
                  />
                </div>
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
