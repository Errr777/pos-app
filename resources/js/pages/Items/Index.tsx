import { useState, useEffect } from 'react';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router, usePage, useForm } from '@inertiajs/react';
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
} from '@/components/ui/dialog';

const breadcrumbs = [
  { title: 'Dashboard', href: '/dashboard' },
  { title: 'Item List', href: '/items' },
];

const ITEMS_PER_PAGE = 20;

export default function Items() {
  const { props } = usePage();
  const { items = { data: [], meta: {} }, filters = {}, kategoris = [] } = props;

  // Local state copies so we can do optimistic updates
  const [localItems, setLocalItems] = useState(items.data ?? []);
  const [query, setQuery] = useState(filters.search ?? '');
  const [sortBy, setSortBy] = useState(filters.sort_by ?? 'name');
  const [sortDir, setSortDir] = useState(filters.sort_dir ?? 'asc');
  const [perPage, setPerPage] = useState(filters.per_page ?? ITEMS_PER_PAGE);

  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewItem, setViewItem] = useState(null);

  // edit modal state handled by Inertia useForm
  const form = useForm({
    id: null,
    name: '',
    description: '',
    qrcode: '',
    stock: 0,
    stock_min: 0,
    category: '',
    id_kategori: null, // added to track selected kategori id
  });
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  useEffect(() => {
    setLocalItems(items.data ?? []);
  }, [items]);

  const mapSortBy = (col) => ({ name: 'nama', stock: 'stok', category: 'kategori' }[col] ?? 'nama');

  const handleSearchSubmit = (e) => {
    e?.preventDefault();
    router.get(
      route('items.index'),
      { search: query, per_page: perPage, sort_by: mapSortBy(sortBy), sort_dir: sortDir },
      { preserveState: true, replace: true }
    );
  };

  const handleSort = (col) => {
    let newDir = 'asc';
    if (sortBy === col) newDir = sortDir === 'asc' ? 'desc' : 'asc';
    setSortBy(col);
    setSortDir(newDir);
    router.get(
      route('items.index'),
      { search: query, per_page: perPage, sort_by: mapSortBy(col), sort_dir: newDir },
      { preserveState: true, replace: true }
    );
  };

  const sortIcon = (col) => (sortBy === col ? (sortDir === 'asc' ? '▲' : '▼') : '⇅');

  const handlePage = (page) => {
    router.get(
      route('items.index'),
      { search: query, per_page: perPage, sort_by: mapSortBy(sortBy), sort_dir: sortDir, page },
      { preserveState: true }
    );
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePerPageChange = (e) => {
    const pp = parseInt(e.target.value, 10) || ITEMS_PER_PAGE;
    setPerPage(pp);
    router.get(
      route('items.index'),
      { search: query, per_page: pp, sort_by: mapSortBy(sortBy), sort_dir: sortDir },
      { preserveState: true, replace: true }
    );
  };

  const handleAddItem = () => {
    // replace with toast when ready
    alert('Fitur tambah item coming soon!');
  };

  const openView = (item) => {
    setViewItem(item);
    setIsViewModalOpen(true);
  };

  const openEditModal = (item) => {
    form.reset();

    // deduce category id/name from item shape
    const idKategori =
      item.id_kategori ??
      (item.kategori_rel ? item.kategori_rel.id : null) ??
      (item.kategori ? (kategoris.find((k) => k.nama === item.kategori) || {}).id : null);

    const kategoriName =
      item.kategori ??
      (item.kategori_rel ? item.kategori_rel.nama : null) ??
      (idKategori ? (kategoris.find((k) => k.id === idKategori) || {}).nama : '');

    form.setData({
      id: item.id,
      // support both server shapes
      name: item.nama ?? item.name ?? '',
      description: item.deskripsi ?? item.description ?? '',
      qrcode: item.kode_item ?? item.qrcode ?? '',
      stock: item.stok ?? item.stock ?? 0,
      stock_min: item.stok_minimal ?? item.stock_min ?? 0,
      category: kategoriName ?? '',
      id_kategori: idKategori ?? null,
    });

    setIsEditModalOpen(true);
  };

  // Optimistic delete: remove locally immediately; revert snapshot on error
  const handleDelete = (id) => {
    if (!confirm('Yakin ingin menghapus item ini?')) return;

    const snapshot = [...localItems];
    setLocalItems((prev) => prev.filter((i) => i.id !== id));

    router.delete(route('items.destroy', id), {
      preserveState: true,
      onSuccess: () => {
        // replace with toast
        alert('Item berhasil dihapus');
      },
      onError: () => {
        setLocalItems(snapshot);
        alert('Gagal menghapus item. Coba lagi.');
      },
    });
  };

  // ---------- PATCHED submitEdit: use form.put (Inertia manages form.processing) ----------
  const submitEdit = (e) => {
    e.preventDefault();
    const id = form.data.id;

    // keep both id_kategori and category name in payload for compatibility
    const payload = {
      ...form.data,
      // ensure category set to name for legacy backend
      category: form.data.category ?? (kategoris.find((k) => k.id === form.data.id_kategori) || {}).nama ?? '',
    };

    // Use form.put so useForm manages processing and errors
    form.put(route('items.update', id), {
      data: payload,
      onSuccess: (page) => {
        setIsEditModalOpen(false);

        // optimistic update of local items — write both id_kategori and kategori (name)
        setLocalItems((prev) =>
          prev.map((it) =>
            it.id === id
              ? {
                  ...it,
                  // DB-language fields
                  nama: payload.name,
                  deskripsi: payload.description,
                  kode_item: payload.qrcode,
                  stok: payload.stock,
                  stok_minimal: payload.stock_min,
                  kategori: payload.category,
                  id_kategori: payload.id_kategori ?? it.id_kategori ?? null,
                  // client fallback fields
                  name: payload.name,
                  description: payload.description,
                  qrcode: payload.qrcode,
                  stock: payload.stock,
                  stock_min: payload.stock_min,
                }
              : it
          )
        );

        alert('Item berhasil diperbarui');
      },
      onError: () => {
        // form.errors will be populated automatically by Inertia
      },
    });
  };
  // -------------------------------------------------------------------------

  const paginated = items;
  const totalPages = paginated?.meta?.last_page ?? 1;
  const currentPage = paginated?.meta?.current_page ?? 1;

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title="Items" />
      <div className="relative min-h-[100vh] flex-1 overflow-hidden rounded-xl border border-sidebar-border/70 md:min-h-min dark:border-sidebar-border bg-white dark:bg-background p-4">
        <div className="flex justify-between mb-4 gap-2">
          <form onSubmit={handleSearchSubmit} className="relative w-full max-w-xs">
            <span className="absolute inset-y-0 left-3 flex items-center text-muted-foreground pointer-events-none">
              <Search size={18} />
            </span>
            <input
              type="text"
              placeholder="Pencarian..."
              className="w-full px-10 py-2 border rounded-lg bg-muted pl-12"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{ minWidth: 200 }}
            />
          </form>

          <div className="flex items-center gap-2">
            <select value={perPage} onChange={handlePerPageChange} className="border rounded px-2 py-1">
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>

            <Button onClick={handleAddItem} className="gap-2">
              <Plus size={16} />
              <span>Tambah Item</span>
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full border rounded-xl">
            <thead>
              <tr className="bg-muted">
                <th className="px-4 py-2 text-left cursor-pointer select-none" onClick={() => handleSort('name')}>
                  Nama {sortIcon('name')}
                </th>
                <th className="px-4 py-2 text-left">QR Code</th>
                <th className="px-4 py-2 text-left cursor-pointer select-none" onClick={() => handleSort('stock')}>
                  Stok {sortIcon('stock')}
                </th>
                <th className="px-4 py-2 text-left cursor-pointer select-none" onClick={() => handleSort('category')}>
                  Kategori {sortIcon('category')}
                </th>
                <th className="px-4 py-2 text-left">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {localItems.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-6 text-muted-foreground">
                    Item tidak ditemukan
                  </td>
                </tr>
              ) : (
                localItems.map((item) => (
                  <tr key={item.id} className="border-b last:border-b-0">
                    <td className="px-4 py-2">{item.nama ?? item.name}</td>
                    <td className="px-4 py-2">{item.kode_item ?? item.qrcode}</td>
                    <td className="px-4 py-2">{item.stok ?? item.stock}</td>
                    <td className="px-4 py-2">
                      {item.kategori ??
                        item.category ??
                        (item.kategori_rel ? item.kategori_rel.nama : '-')}
                    </td>
                    <td className="px-4 py-2 flex gap-2">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button onClick={() => openView(item)} className="text-primary border border-white hover:bg-primary hover:text-slate-600 hover:border-0 p-2 rounded-full transition" aria-label="Lihat">
                              <Eye size={18} />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>Lihat Detail</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button onClick={() => openEditModal(item)} className="text-primary border border-white hover:bg-primary hover:text-slate-600 hover:border-0 p-2 rounded-full transition" aria-label="Edit">
                              <Pencil size={18} />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>Edit Item</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button onClick={() => handleDelete(item.id)} className="text-destructive bg-amber-50 hover:bg-destructive hover:text-amber-50 p-2 rounded-full transition" aria-label="Hapus">
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

        {totalPages > 1 && (
          <div className="flex justify-center gap-2 mt-6 flex-wrap">
            <button onClick={() => handlePage(currentPage - 1)} disabled={currentPage === 1} className="px-3 py-1 rounded border bg-muted disabled:opacity-50">
              Previous
            </button>
            {Array.from({ length: totalPages }).map((_, idx) => (
              <button key={idx} onClick={() => handlePage(idx + 1)} className={`px-3 py-1 rounded border ${currentPage === idx + 1 ? 'bg-primary text-white' : 'bg-muted'}`}>
                {idx + 1}
              </button>
            ))}
            <button onClick={() => handlePage(currentPage + 1)} disabled={currentPage === totalPages} className="px-3 py-1 rounded border bg-muted disabled:opacity-50">
              Next
            </button>
          </div>
        )}
      </div>

      {/* View Modal */}
      <Dialog open={isViewModalOpen} onOpenChange={(open) => { if (!open) setViewItem(null); setIsViewModalOpen(open); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{viewItem ? 'Detail Item' : 'Detail'}</DialogTitle>
            <DialogDescription>Informasi lengkap dari item terpilih.</DialogDescription>
          </DialogHeader>

          {viewItem && (
            <div className="space-y-2 gap-0.5">
              <p><strong>Nama:</strong> {viewItem.nama ?? viewItem.name}</p>
              <p><strong>Deskripsi:</strong> {viewItem.deskripsi ?? viewItem.description}</p>
              <p><strong>QR Code:</strong> {viewItem.kode_item ?? viewItem.qrcode}</p>
              <p><strong>Stok:</strong> {viewItem.stok ?? viewItem.stock}</p>
              <p><strong>Stok Minimal:</strong> {viewItem.stok_minimal ?? viewItem.stock_min}</p>
              <p><strong>Kategori:</strong> {viewItem.kategori ?? viewItem.category ?? (viewItem.kategori_rel ? viewItem.kategori_rel.nama : '-')}</p>
              <img src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${viewItem.kode_item ?? viewItem.qrcode}`} alt="QR Code" className="mx-auto mt-4 rounded-lg border border-white p-3" />
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => { setIsViewModalOpen(false); setViewItem(null); }}>Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Modal (Inertia form) */}
      <Dialog open={isEditModalOpen} onOpenChange={(open) => { if (!open) { form.reset(); setIsEditModalOpen(false); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Item</DialogTitle>
            <DialogDescription>Edit informasi item lalu tekan Simpan.</DialogDescription>
          </DialogHeader>

          <form onSubmit={submitEdit} className="space-y-4">
            <div>
              <input type='hidden' value={form.data.id} readOnly />
              
              <label className="block text-sm font-medium">Nama</label>
              <input type="text" value={form.data.name} onChange={(e) => form.setData('name', e.target.value)} className="w-full border rounded px-2 py-1" />
              {form.errors.name && <div className="text-destructive text-sm">{form.errors.name}</div>}
            </div>

            <div>
              <label className="block text-sm font-medium">Deskripsi</label>
              <textarea value={form.data.description} onChange={(e) => form.setData('description', e.target.value)} className="w-full border rounded px-2 py-1" />
              {form.errors.description && <div className="text-destructive text-sm">{form.errors.description}</div>}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-sm font-medium">QR Code</label>
                <input type="text" value={form.data.qrcode} onChange={(e) => form.setData('qrcode', e.target.value)} className="w-full border rounded px-2 py-1" />
                {form.errors.qrcode && <div className="text-destructive text-sm">{form.errors.qrcode}</div>}
              </div>
              <div>
                <label className="block text-sm font-medium">Kategori</label>
                <select
                  value={form.data.id_kategori ?? ''}
                  onChange={(e) => {
                    const id = e.target.value ? Number(e.target.value) : null;
                    const k = kategoris.find((x) => x.id === id) ?? null;
                    form.setData('id_kategori', id);
                    form.setData('category', k ? k.nama : '');
                  }}
                  className="w-full border rounded px-2 py-1"
                >
                  <option value="">-- Pilih Kategori --</option>
                  {kategoris.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.nama}
                    </option>
                  ))}
                </select>
                {form.errors.category && <div className="text-destructive text-sm">{form.errors.category}</div>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-sm font-medium">Stok</label>
                <input type="number" value={form.data.stock} onChange={(e) => form.setData('stock', e.target.value)} className="w-full border rounded px-2 py-1" />
                {form.errors.stock && <div className="text-destructive text-sm">{form.errors.stock}</div>}
              </div>
              <div>
                <label className="block text-sm font-medium">Stok Minimal</label>
                <input type="number" value={form.data.stock_min} onChange={(e) => form.setData('stock_min', e.target.value)} className="w-full border rounded px-2 py-1" />
                {form.errors.stock_min && <div className="text-destructive text-sm">{form.errors.stock_min}</div>}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" onClick={() => { form.reset(); setIsEditModalOpen(false); }}>Batal</Button>
              <Button type="submit" disabled={form.processing} className="ml-2">Simpan</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

// helper used inside component
function sortIcon(col) {
  // This function is intentionally simple because sort icon state is controlled in component
  // It will be overridden by the component's sortIcon logic (kept here for clarity)
  return '⇅';
}