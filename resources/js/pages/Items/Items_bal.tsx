import { useState } from 'react';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import { Search, Plus, Pencil, Trash, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Description } from '@radix-ui/react-dialog';

const breadcrumbs: BreadcrumbItem[] = [
  { title: 'Dashboard', href: '/dashboard' },
  { title: 'Item List', href: '/items' },
];

const initialItems = Array.from({ length: 48 }).map((_, idx) => ({
  id: idx + 1,
  name: `Item ${String.fromCharCode(65 + (idx % 26))} #${idx + 1}`,
  description: `Deskripsi Singkat ${String.fromCharCode(66 + (idx % 26))} #${idx + Math.floor(Math.random() * 10000)}`,
  stock: Math.floor(Math.random() * 100),
  stock_min: Math.floor(Math.random() * 100),
  category: ['General', 'Special', 'Minuman', 'Makanan'][idx % 4],
  qrcode: Math.floor(Math.random() * 1000000).toString(),
}));

const ITEMS_PER_PAGE = 20;

export default function Items() {
  const [items] = useState(initialItems);
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const [page, setPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  const filteredItems = items.filter(
    (item) =>
      item.name.toLowerCase().includes(query.toLowerCase()) ||
      item.description.toLowerCase().includes(query.toLowerCase()) ||
      item.qrcode.toLowerCase().includes(query.toLowerCase()) ||
      item.stock.toString().toLowerCase().includes(query.toLowerCase()) ||
      item.category.toLowerCase().includes(query.toLowerCase())
  );

  const sortedItems = [...filteredItems].sort((a, b) => {
    let valA = a[sortBy];
    let valB = b[sortBy];
    if (typeof valA === 'string') valA = valA.toLowerCase();
    if (typeof valB === 'string') valB = valB.toLowerCase();

    if (valA < valB) return sortDir === 'asc' ? -1 : 1;
    if (valA > valB) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const totalPages = Math.ceil(sortedItems.length / ITEMS_PER_PAGE);
  const paginatedItems = sortedItems.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE
  );

  const handleSort = (col) => {
    if (sortBy === col) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(col);
      setSortDir('asc');
    }
  };

  const sortIcon = (col) =>
    sortBy === col ? (sortDir === 'asc' ? '▲' : '▼') : '⇅';

  const gotoPage = (n) => {
    setPage(n);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleQueryChange = (e) => {
    setQuery(e.target.value);
    setPage(1);
  };

  const handleAddItem = () => {
    alert('Fitur tambah item coming soon@!!!!');
  };

  const handleViewDetail = (item) => {
    setSelectedItem(item);
    setIsModalOpen(true);
  };

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title="Items" />
      <div className="relative min-h-[100vh] flex-1 overflow-hidden rounded-xl border border-sidebar-border/70 md:min-h-min dark:border-sidebar-border bg-white dark:bg-background p-4">
        {/* Search bar dan tambah item di kiri */}
        <div className="flex justify-between mb-4 gap-2">
          <div className="relative w-full max-w-xs">
            <span className="absolute inset-y-0 left-3 flex items-center text-muted-foreground pointer-events-none">
              <Search size={18} />
            </span>
            <input
              type="text"
              placeholder="Pencarian..."
              className="w-full px-10 py-2 border rounded-lg bg-muted pl-12"
              value={query}
              onChange={handleQueryChange}
              style={{ minWidth: 200 }}
            />
          </div>
          <Button onClick={handleAddItem} className="gap-2">
            <Plus size={16} />
            <span>Tambah Item</span>
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full border rounded-xl">
            <thead>
              <tr className="bg-muted">
                <th
                  className="px-4 py-2 text-left cursor-pointer select-none"
                  onClick={() => handleSort('name')}
                >
                  Nama {sortIcon('name')}
                </th>
                <th className="px-4 py-2 text-left"
                >
                  QR Code
                
                </th> {/* <-- Add this */}
                <th
                  className="px-4 py-2 text-left cursor-pointer select-none"
                  onClick={() => handleSort('stock')}
                >
                  Stok {sortIcon('stock')}
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
              {paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-6 text-muted-foreground">
                    Item tidak ditemukan
                  </td>
                </tr>
              ) : (
                paginatedItems.map((item) => (
                  <tr key={item.id} className="border-b last:border-b-0">
                    <td className="px-4 py-2">{item.name}</td>
                    <td className="px-4 py-2">{item.qrcode}</td>
                    <td className="px-4 py-2">{item.stock}</td>
                    <td className="px-4 py-2">{item.category}</td>
                    <td className="px-4 py-2 flex gap-2">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => handleViewDetail(item)}
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
                              className="text-primary border border-white hover:bg-primary hover:text-slate-600 hover:border-0 p-2 rounded-full transition"
                              aria-label="Edit"
                            >
                              <Pencil size={18} />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>Edit Item</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              className="text-destructive bg-amber-50 hover:bg-destructive hover:text-amber-50 p-2 rounded-full transition"
                              aria-label="Hapus"
                            >
                              <Trash size={18} />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>Hapus Item</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex justify-center gap-2 mt-6 flex-wrap">
            <button
              onClick={() => gotoPage(page - 1)}
              disabled={page === 1}
              className="px-3 py-1 rounded border bg-muted disabled:opacity-50"
            >
              Previous
            </button>
            {Array.from({ length: totalPages }).map((_, idx) => (
              <button
                key={idx}
                onClick={() => gotoPage(idx + 1)}
                className={`px-3 py-1 rounded border ${page === idx + 1 ? 'bg-primary text-white' : 'bg-muted'}`}
              >
                {idx + 1}
              </button>
            ))}
            <button
              onClick={() => gotoPage(page + 1)}
              disabled={page === totalPages}
              className="px-3 py-1 rounded border bg-muted disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}
      </div>
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detail Item</DialogTitle>
            <DialogDescription>Informasi lengkap dari item terpilih.</DialogDescription>
          </DialogHeader>
          {selectedItem && (
            <div className="space-y-2 gap-0.5">
              <p><strong>Nama:</strong> {selectedItem.name}</p>
              <p><strong>Deskripsi:</strong> {selectedItem.description}</p>
              <p><strong>QR Code:</strong> {selectedItem.qrcode}</p>
              <p><strong>Stok:</strong> {selectedItem.stock}</p>
              <p><strong>Stok Minimal:</strong> {selectedItem.stock_min}</p>
              <p><strong>Kategori:</strong> {selectedItem.category}</p>
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${selectedItem.qrcode}`}
                alt="QR Code"
                className="mx-auto mt-4 rounded-lg border border-white p-3"
              />
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setIsModalOpen(false)}>Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}