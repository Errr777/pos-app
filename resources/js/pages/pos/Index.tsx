import { useEffect, useState } from 'react';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import { Search, Eye, Ban, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter, DialogClose,
} from '@/components/ui/dialog';
import Pagination, { type PaginationMeta } from '@/components/Pagination';

const breadcrumbs: BreadcrumbItem[] = [
  { title: 'Dashboard', href: '/dashboard' },
  { title: 'Riwayat Penjualan', href: '/pos' },
];

interface SaleRow {
  id: number;
  saleNumber: string;
  date: string | null;
  cashier: string;
  customerName: string;
  warehouseName: string;
  subtotal: number;
  discountAmount: number;
  grandTotal: number;
  paymentMethod: string;
  paymentAmount: number;
  changeAmount: number;
  status: string;
  note: string | null;
  itemCount: number;
}

interface PaginatedSales {
  data: SaleRow[];
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
  payment_method?: string;
  status?: string;
  sort_by?: string;
  sort_dir?: string;
  per_page?: string | number;
}

interface PageProps {
  sales: PaginatedSales;
  filters: Filters;
  [key: string]: unknown;
}

const METHOD_LABEL: Record<string, string> = {
  cash: 'Tunai', transfer: 'Transfer', qris: 'QRIS', card: 'Kartu',
};

function formatRp(n: number) {
  return 'Rp ' + n.toLocaleString('id-ID');
}
function formatDate(iso: string | null) {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function PosIndex() {
  const { sales, filters } = usePage<PageProps>().props;

  const [search, setSearch]     = useState(filters.search ?? '');
  const [dateFrom, setDateFrom] = useState(filters.date_from ?? '');
  const [dateTo, setDateTo]     = useState(filters.date_to ?? '');
  const [payMethod, setPayMethod] = useState(filters.payment_method ?? '');
  const [status, setStatus]     = useState(filters.status ?? '');
  const [sortBy, setSortBy]     = useState(filters.sort_by ?? 'date');
  const [sortDir, setSortDir]   = useState(filters.sort_dir ?? 'desc');
  const [perPage, setPerPage]   = useState(String(filters.per_page ?? '20'));

  const [voidTarget, setVoidTarget] = useState<SaleRow | null>(null);
  const [voiding, setVoiding]       = useState(false);

  useEffect(() => {
    setSearch(filters.search ?? '');
    setDateFrom(filters.date_from ?? '');
    setDateTo(filters.date_to ?? '');
    setPayMethod(filters.payment_method ?? '');
    setStatus(filters.status ?? '');
    setSortBy(filters.sort_by ?? 'date');
    setSortDir(filters.sort_dir ?? 'desc');
    setPerPage(String(filters.per_page ?? '20'));
  }, [filters]);

  const navigate = (overrides: Partial<Filters & { page?: number }> = {}) => {
    router.get(route('pos.index'), {
      search, date_from: dateFrom, date_to: dateTo,
      payment_method: payMethod, status,
      sort_by: sortBy, sort_dir: sortDir, per_page: perPage,
      ...overrides,
    }, { preserveState: true, replace: true });
  };

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); navigate({ page: 1 }); };
  const handlePage   = (page: number) => navigate({ page });

  const handleSort = (col: string) => {
    const newDir = col === sortBy && sortDir === 'asc' ? 'desc' : 'asc';
    setSortBy(col); setSortDir(newDir);
    navigate({ sort_by: col, sort_dir: newDir, page: 1 });
  };

  const SortIcon = ({ col }: { col: string }) =>
    col !== sortBy ? <span className="opacity-30 ml-1">↕</span> : <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>;

  const handleVoid = () => {
    if (!voidTarget) return;
    setVoiding(true);
    router.post(route('pos.void', { saleHeader: voidTarget.id }), {}, {
      onSuccess: () => { setVoidTarget(null); setVoiding(false); },
      onError:   () => setVoiding(false),
    });
  };

  const statusBadge = (s: string) => {
    const cls = s === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600';
    return <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{s === 'completed' ? 'Selesai' : 'Void'}</span>;
  };

  const payBadge = (m: string) => (
    <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-sky-100 text-sky-700">{METHOD_LABEL[m] ?? m}</span>
  );

  const meta: PaginationMeta = {
    current_page: sales.current_page, last_page: sales.last_page,
    per_page: sales.per_page, total: sales.total,
    from: sales.from, to: sales.to,
  };

  const totalRevenue = sales.data.filter(s => s.status === 'completed').reduce((sum, s) => sum + s.grandTotal, 0);

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title="Riwayat Penjualan" />
      <div className="p-4 md:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Riwayat Penjualan</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Semua transaksi POS</p>
          </div>
          <Button size="sm" onClick={() => router.visit(route('pos.terminal'))}>
            <Plus size={15} className="mr-1" /> Terminal POS
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-2 flex-wrap">
          <form onSubmit={handleSearch} className="flex gap-2 flex-1 min-w-[200px]">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input type="text" placeholder="Cari no. transaksi, kasir…"
                className="pl-8 pr-3 py-2 text-sm border border-border rounded w-full focus:outline-none focus:ring-2 focus:ring-primary"
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Button type="submit" size="sm" variant="outline">Cari</Button>
          </form>
          <input type="date" className="text-sm border border-border rounded px-2 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
            value={dateFrom} onChange={e => { setDateFrom(e.target.value); navigate({ date_from: e.target.value, page: 1 }); }} />
          <input type="date" className="text-sm border border-border rounded px-2 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
            value={dateTo} onChange={e => { setDateTo(e.target.value); navigate({ date_to: e.target.value, page: 1 }); }} />
          <select className="text-sm border border-border rounded px-2 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
            value={payMethod} onChange={e => { setPayMethod(e.target.value); navigate({ payment_method: e.target.value, page: 1 }); }}>
            <option value="">Semua Metode</option>
            <option value="cash">Tunai</option>
            <option value="transfer">Transfer</option>
            <option value="qris">QRIS</option>
            <option value="card">Kartu</option>
          </select>
          <select className="text-sm border border-border rounded px-2 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
            value={status} onChange={e => { setStatus(e.target.value); navigate({ status: e.target.value, page: 1 }); }}>
            <option value="">Semua Status</option>
            <option value="completed">Selesai</option>
            <option value="void">Void</option>
          </select>
          <select className="text-sm border border-border rounded px-2 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
            value={perPage} onChange={e => { setPerPage(e.target.value); navigate({ per_page: e.target.value, page: 1 }); }}>
            {['10','20','50','100'].map(n => <option key={n} value={n}>{n} / hal</option>)}
          </select>
        </div>

        {/* Table */}
        <div className="rounded-lg border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium cursor-pointer select-none" onClick={() => handleSort('saleNumber')}>
                  No. Transaksi <SortIcon col="saleNumber" />
                </th>
                <th className="text-left px-4 py-3 font-medium cursor-pointer select-none" onClick={() => handleSort('date')}>
                  Tanggal <SortIcon col="date" />
                </th>
                <th className="text-left px-4 py-3 font-medium">Pelanggan</th>
                <th className="text-left px-4 py-3 font-medium">Kasir</th>
                <th className="text-left px-4 py-3 font-medium">Metode</th>
                <th className="text-right px-4 py-3 font-medium cursor-pointer select-none" onClick={() => handleSort('grandTotal')}>
                  Total <SortIcon col="grandTotal" />
                </th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-right px-4 py-3 font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {sales.data.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-10 text-muted-foreground">Tidak ada transaksi ditemukan</td></tr>
              ) : sales.data.map(s => (
                <tr key={s.id} className={`hover:bg-muted/30 transition-colors ${s.status === 'void' ? 'opacity-60' : ''}`}>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{s.saleNumber}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{formatDate(s.date)}</td>
                  <td className="px-4 py-3">{s.customerName}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{s.cashier}</td>
                  <td className="px-4 py-3">{payBadge(s.paymentMethod)}</td>
                  <td className="px-4 py-3 text-right font-medium">{formatRp(s.grandTotal)}</td>
                  <td className="px-4 py-3">{statusBadge(s.status)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button className="p-1.5 rounded hover:bg-sky-100 text-sky-600 transition-colors" title="Lihat detail"
                        onClick={() => router.visit(route('pos.show', { saleHeader: s.id }))}><Eye size={15} /></button>
                      {s.status === 'completed' && (
                        <button className="p-1.5 rounded hover:bg-red-100 text-red-600 transition-colors" title="Void transaksi"
                          onClick={() => setVoidTarget(s)}><Ban size={15} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Pagination meta={meta} onPageChange={handlePage}
          summary={<span>Total (halaman ini): <span className="font-medium text-foreground">{formatRp(totalRevenue)}</span></span>} />
      </div>

      {/* Void Confirm */}
      <Dialog open={!!voidTarget} onOpenChange={open => { if (!open) setVoidTarget(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Void Transaksi</DialogTitle>
            <DialogDescription>
              Yakin ingin mem-void transaksi <span className="font-semibold text-foreground">{voidTarget?.saleNumber}</span>?
              Stok akan dikembalikan. Tindakan ini tidak dapat dibatalkan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-2">
            <DialogClose asChild><Button variant="outline" disabled={voiding}>Batal</Button></DialogClose>
            <Button variant="destructive" disabled={voiding} onClick={handleVoid}>{voiding ? 'Memproses…' : 'Ya, Void'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
