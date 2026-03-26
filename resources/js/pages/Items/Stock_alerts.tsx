// resources/js/Pages/Stock_alerts.tsx
import { useEffect, useState } from 'react';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import { Search, Eye, AlertCircle } from 'lucide-react';
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

const breadcrumbs: BreadcrumbItem[] = [
  { title: 'Dashboard', href: '/dashboard' },
  { title: 'Stock Alerts', href: '/stock_alerts' },
];

const ITEMS_PER_PAGE_DEFAULT = 10;

type ItemShape = {
  id: number;
  name: string;
  description: string;
  qrcode: string;
  stock: number;
  minimumStock: number;
  category: string;
  [k: string]: any;
};

export default function Stock_alerts() {
  const { props } = usePage<any>();
  const { items = { data: [], meta: {} }, filters = {} } = props;

  const [localItems, setLocalItems] = useState<ItemShape[]>(items.data ?? []);
  const [query, setQuery] = useState<string>(filters.search ?? '');
  const [sortBy, setSortBy] = useState<string>((filters.sort_by as string) ?? 'stock');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(
    filters.sort_dir === 'asc' ? 'asc' : 'desc'
  );
  const [page, setPage] = useState<number>(
    items?.meta?.current_page ? Number(items.meta.current_page) : 1
  );
  const [perPage, setPerPage] = useState<number>(
    items?.meta?.per_page ?? ITEMS_PER_PAGE_DEFAULT
  );

  const [selectedItem, setSelectedItem] = useState<ItemShape | null>(null);
  const [isViewOpen, setIsViewOpen] = useState(false);

  useEffect(() => {
    setLocalItems(items.data ?? []);
    setPage(items?.meta?.current_page ? Number(items.meta.current_page) : 1);
    setPerPage(items?.meta?.per_page ?? ITEMS_PER_PAGE_DEFAULT);
    if (filters.sort_by) setSortBy(filters.sort_by);
    if (filters.sort_dir) setSortDir(filters.sort_dir === 'asc' ? 'asc' : 'desc');
    if (filters.search !== undefined) setQuery(filters.search ?? '');
  }, [items, filters]);

  const extractMeta = (p: any) => {
    if (!p) return null;
    const m = p.meta ?? p;
    if (!m) return null;
    const current_page = Number(m.current_page ?? m.currentPage ?? m.page ?? 1);
    const last_page = Number(m.last_page ?? m.lastPage ?? m.total_pages ?? 1);
    const per_page = Number(m.per_page ?? m.perPage ?? perPage);
    const total = Number(m.total ?? m.count ?? (m.total_items ?? 0));
    return { current_page, last_page, per_page, total };
  };

  const meta = extractMeta(items);
  const totalPages = meta?.last_page ?? 1;
  const currentPage = meta?.current_page ?? page;
  const perPageFromMeta = meta?.per_page ?? perPage;

  const handleSearch = (e?: React.FormEvent) => {
    e?.preventDefault();
    router.get(
      route('item.low_stock'),
      {
        search: query || undefined,
        per_page: perPageFromMeta,
        sort_by: sortBy,
        sort_dir: sortDir,
      },
      { preserveState: true, replace: true }
    );
  };

  const gotoPage = (p: number) => {
    if (p < 1 || p > totalPages) return;
    router.get(
      route('item.low_stock'),
      {
        page: p,
        per_page: perPageFromMeta,
        search: query || undefined,
        sort_by: sortBy,
        sort_dir: sortDir,
      },
      { preserveState: true }
    );
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSort = (col: string) => {
    let nextDir: 'asc' | 'desc' = 'asc';
    if (sortBy === col) nextDir = sortDir === 'asc' ? 'desc' : 'asc';
    setSortBy(col);
    setSortDir(nextDir);
    router.get(
      route('item.low_stock'),
      {
        search: query || undefined,
        per_page: perPageFromMeta,
        sort_by: col,
        sort_dir: nextDir,
      },
      { preserveState: true, replace: true }
    );
  };

  const sortIcon = (col: string) =>
    sortBy === col ? (sortDir === 'asc' ? '▲' : '▼') : '⇅';

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setPage(1);
  };

  const handleViewDetail = (item: ItemShape) => {
    setSelectedItem(item);
    setIsViewOpen(true);
  };

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title="Minimum Stock Items" />
      <div className="relative min-h-[100vh] flex-1 overflow-hidden rounded-xl border border-sidebar-border/70 md:min-h-min dark:border-sidebar-border bg-white dark:bg-background p-4">
        {/* Search + Filter */}
        <div className="flex justify-between mb-4 gap-2">
          <form onSubmit={handleSearch} className="relative w-full max-w-xs">
            <span className="absolute inset-y-0 left-3 flex items-center text-muted-foreground pointer-events-none">
              <Search size={18} />
            </span>
            <input
              type="text"
              placeholder="Cari item minimum stok..."
              className="w-full px-10 py-2 border rounded-lg bg-muted pl-12"
              value={query}
              onChange={handleQueryChange}
              style={{ minWidth: 200 }}
            />
          </form>
          <div className="flex items-center gap-2">
            <select
              value={perPageFromMeta}
              onChange={(e) =>
                router.get(
                  route('item.low_stock'),
                  {
                    per_page: Number(e.target.value),
                    search: query || undefined,
                    sort_by: sortBy,
                    sort_dir: sortDir,
                  },
                  { preserveState: true, replace: true }
                )
              }
              className="border rounded px-2 py-1"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full border rounded-xl">
            <thead>
              <tr className="bg-muted">
                <th className="px-4 py-2 text-left">#</th>
                <th
                  className="px-4 py-2 text-left cursor-pointer select-none"
                  onClick={() => handleSort('name')}
                >
                  Nama {sortIcon('name')}
                </th>
                <th className="px-4 py-2 text-left">QR Code</th>
                <th
                  className="px-4 py-2 text-left cursor-pointer select-none"
                  onClick={() => handleSort('stock')}
                >
                  Stok {sortIcon('stock')}
                </th>
                <th
                  className="px-4 py-2 text-left cursor-pointer select-none"
                  onClick={() => handleSort('minimumStock')}
                >
                  Stok Minimum {sortIcon('minimumStock')}
                </th>
                <th
                  className="px-4 py-2 text-left cursor-pointer select-none"
                  onClick={() => handleSort('category')}
                >
                  Kategori {sortIcon('category')}
                </th>
                <th className="px-4 py-2 text-left">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {localItems.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="text-center py-6 text-muted-foreground"
                  >
                    Tidak ada item yang stoknya di bawah minimum
                  </td>
                </tr>
              ) : (
                localItems.map((item: ItemShape, idx: number) => (
                  <tr key={item.id} className="border-b last:border-b-0">
                    {/* ✅ Auto number respecting pagination */}
                    <td className="px-4 py-2">
                      {(meta?.per_page ?? perPage) * ((meta?.current_page ?? 1) - 1) + idx + 1}
                    </td>

                    <td className="px-4 py-2">{item.name}</td>
                    <td className="px-4 py-2">{item.qrcode}</td>
                    <td className="px-4 py-2 text-red-600 font-semibold">
                      {item.stock}
                      <span className="ml-2 text-red-500 inline-flex items-center text-xs">
                        <AlertCircle size={14} className="mr-1" />
                        Kurang dari minimum
                      </span>
                    </td>
                    <td className="px-4 py-2">{item.minimumStock}</td>
                    <td className="px-4 py-2">{item.category}</td>
                    <td className="px-4 py-2 flex gap-2">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => handleViewDetail(item)}
                              className="text-primary border hover:bg-primary hover:text-slate-600 hover:border-0 p-2 rounded-full transition"
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

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center gap-2 mt-6 flex-wrap">
            <button
              onClick={() => gotoPage(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-3 py-1 rounded border bg-muted disabled:opacity-50"
            >
              Previous
            </button>
            {Array.from({ length: totalPages }).map((_, idx) => (
              <button
                key={idx}
                onClick={() => gotoPage(idx + 1)}
                className={`px-3 py-1 rounded border ${
                  currentPage === idx + 1 ? 'bg-primary text-white' : 'bg-muted'
                }`}
              >
                {idx + 1}
              </button>
            ))}
            <button
              onClick={() => gotoPage(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="px-3 py-1 rounded border bg-muted disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}

        {/* Modal */}
        <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Detail Item</DialogTitle>
              <DialogDescription>
                Informasi lengkap dari item yang minimum stok.
              </DialogDescription>
            </DialogHeader>
            {selectedItem && (
              <div className="space-y-2 gap-0.5">
                <p><strong>Nama:</strong> {selectedItem.name}</p>
                <p><strong>Deskripsi:</strong> {selectedItem.description}</p>
                <p><strong>QR Code:</strong> {selectedItem.qrcode}</p>
                <p>
                  <strong>Stok:</strong>{' '}
                  <span className="text-red-600">{selectedItem.stock}</span>
                </p>
                <p>
                  <strong>Stok Minimum:</strong> {selectedItem.minimumStock}
                </p>
                <p><strong>Kategori:</strong> {selectedItem.category}</p>
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(selectedItem.qrcode)}`}
                  alt="QR Code"
                  className="mx-auto mt-4 rounded-lg border border-white p-3"
                />
              </div>
            )}
            <DialogFooter>
              <Button onClick={() => setIsViewOpen(false)}>Tutup</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}