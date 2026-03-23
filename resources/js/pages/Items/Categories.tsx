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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';

const breadcrumbs: BreadcrumbItem[] = [
  { title: 'Dashboard', href: '/dashboard' },
  { title: 'Inventory Categories', href: '/categories' },
];

const initialCategories = [
  { id: 1, name: 'General', description: 'Kategori umum barang dagangan' },
  { id: 2, name: 'Special', description: 'Kategori khusus untuk promo' },
  { id: 3, name: 'Minuman', description: 'Semua jenis minuman' },
  { id: 4, name: 'Makanan', description: 'Semua jenis makanan' },
];

const ITEMS_PER_PAGE = 10;

export default function Categories() {
  const [categories, setCategories] = useState(initialCategories);
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);

  // Modal management
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'add' | 'edit'>('add');
  const [form, setForm] = useState({ id: 0, name: '', description: '' });
  const [selectedCategory, setSelectedCategory] = useState<typeof initialCategories[0] | null>(null);
  const [isViewOpen, setIsViewOpen] = useState(false);

  // Filtering and Sorting
  const filteredCategories = categories.filter(
    (cat) =>
      cat.name.toLowerCase().includes(query.toLowerCase()) ||
      cat.description.toLowerCase().includes(query.toLowerCase())
  );

  const sortedCategories = [...filteredCategories].sort((a, b) => {
    const valA = String((a as Record<string, unknown>)[sortBy] ?? '').toLowerCase();
    const valB = String((b as Record<string, unknown>)[sortBy] ?? '').toLowerCase();
    if (valA < valB) return sortDir === 'asc' ? -1 : 1;
    if (valA > valB) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const totalPages = Math.ceil(sortedCategories.length / ITEMS_PER_PAGE);
  const paginatedCategories = sortedCategories.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE
  );

  const handleSort = (col: string) => {
    if (sortBy === col) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(col);
      setSortDir('asc');
    }
  };

  const sortIcon = (col: string) =>
    sortBy === col ? (sortDir === 'asc' ? '▲' : '▼') : '⇅';

  const gotoPage = (n: number) => {
    setPage(n);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setPage(1);
  };

  // Modal: Add/Edit
  const openAddForm = () => {
    setFormMode('add');
    setForm({ id: 0, name: '', description: '' });
    setIsFormOpen(true);
  };
  const openEditForm = (cat: typeof initialCategories[0]) => {
    setFormMode('edit');
    setForm({ id: cat.id, name: cat.name, description: cat.description });
    setIsFormOpen(true);
  };
  const closeForm = () => setIsFormOpen(false);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    if (formMode === 'add') {
      setCategories((prev) => [
        ...prev,
        {
          id: Date.now(),
          name: form.name.trim(),
          description: form.description.trim(),
        },
      ]);
    } else {
      setCategories((prev) =>
        prev.map((cat) =>
          cat.id === form.id
            ? { ...cat, name: form.name.trim(), description: form.description.trim() }
            : cat
        )
      );
    }
    closeForm();
  };

  const handleDelete = (id: number) => {
    if (window.confirm('Delete this category?')) {
      setCategories((prev) => prev.filter((cat) => cat.id !== id));
    }
  };

  const handleViewDetail = (cat: typeof initialCategories[0]) => {
    setSelectedCategory(cat);
    setIsViewOpen(true);
  };

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title="Inventory Categories" />
      <div className="relative min-h-[100vh] flex-1 overflow-hidden rounded-xl border border-sidebar-border/70 md:min-h-min dark:border-sidebar-border bg-white dark:bg-background p-4">
        {/* Search bar & Add Category */}
        <div className="flex justify-between mb-4 gap-2">
          <div className="relative w-full max-w-xs">
            <span className="absolute inset-y-0 left-3 flex items-center text-muted-foreground pointer-events-none">
              <Search size={18} />
            </span>
            <input
              type="text"
              placeholder="Cari kategori..."
              className="w-full px-10 py-2 border rounded-lg bg-muted pl-12"
              value={query}
              onChange={handleQueryChange}
              style={{ minWidth: 200 }}
            />
          </div>
          <Button onClick={openAddForm} className="gap-2">
            <Plus size={16} />
            <span>Tambah Kategori</span>
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
                  Nama Kategori {sortIcon('name')}
                </th>
                <th
                  className="px-4 py-2 text-left cursor-pointer select-none"
                  onClick={() => handleSort('description')}
                >
                  Deskripsi {sortIcon('description')}
                </th>
                <th className="px-4 py-2 text-left">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {paginatedCategories.length === 0 ? (
                <tr>
                  <td colSpan={3} className="text-center py-6 text-muted-foreground">
                    Kategori tidak ditemukan
                  </td>
                </tr>
              ) : (
                paginatedCategories.map((cat) => (
                  <tr key={cat.id} className="border-b last:border-b-0">
                    <td className="px-4 py-2">{cat.name}</td>
                    <td className="px-4 py-2">{cat.description}</td>
                    <td className="px-4 py-2 flex gap-2">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => handleViewDetail(cat)}
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
                              onClick={() => openEditForm(cat)}
                              className="text-primary border border-white hover:bg-primary hover:text-slate-600 hover:border-0 p-2 rounded-full transition"
                              aria-label="Edit"
                            >
                              <Pencil size={18} />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>Edit Kategori</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => handleDelete(cat.id)}
                              className="text-destructive bg-amber-50 hover:bg-destructive hover:text-amber-50 p-2 rounded-full transition"
                              aria-label="Hapus"
                            >
                              <Trash size={18} />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>Hapus Kategori</TooltipContent>
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

        {/* Modal: Add/Edit */}
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogContent>
            <form onSubmit={handleFormSubmit}>
              <DialogHeader>
                <DialogTitle>
                  {formMode === 'add' ? 'Tambah Kategori' : 'Edit Kategori'}
                </DialogTitle>
                <DialogDescription>
                  {formMode === 'add'
                    ? 'Masukkan data kategori baru.'
                    : 'Perbarui data kategori.'}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div>
                  <label className="block font-semibold mb-1">Nama Kategori</label>
                  <input
                    required
                    value={form.name}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, name: e.target.value }))
                    }
                    placeholder="Nama kategori"
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Deskripsi</label>
                  <input
                    value={form.description}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, description: e.target.value }))
                    }
                    placeholder="Deskripsi kategori"
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>
              <DialogFooter className="mt-4">
                <Button type="submit">{formMode === 'add' ? 'Tambah' : 'Update'}</Button>
                <DialogClose asChild>
                  <Button type="button" variant="outline">Batal</Button>
                </DialogClose>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Modal: Detail */}
        <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Detail Kategori</DialogTitle>
              <DialogDescription>Informasi lengkap kategori.</DialogDescription>
            </DialogHeader>
            {selectedCategory && (
              <div className="space-y-2">
                <p><strong>Nama:</strong> {selectedCategory.name}</p>
                <p><strong>Deskripsi:</strong> {selectedCategory.description}</p>
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