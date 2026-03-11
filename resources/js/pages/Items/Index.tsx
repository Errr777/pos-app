import { useState, useEffect } from 'react';
import AppLayout from '@/layouts/app-layout';
import { Head, router, usePage, useForm } from '@inertiajs/react';
import { Search, Plus, Pencil, Trash, Eye, Tag } from 'lucide-react';

interface Item {
  id: number;
  name: string;
  description: string | null;
  qrcode: string;
  stock: number;
  stock_min: number;
  harga_beli: number;
  harga_jual: number;
  category: string | null;
  id_kategori: number | null;
  kategori_rel: { id: number; nama: string } | null;
  tags: { id: number; name: string; color: string }[];
}
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
import Pagination from '@/components/Pagination'; // <- ensure this file exists

const breadcrumbs = [
  { title: 'Dashboard', href: '/dashboard' },
  { title: 'Item List', href: '/item' },
];

const ITEMS_PER_PAGE = 10;

interface PageProps {
  items: { data: Item[]; meta: Record<string, unknown> };
  filters: Record<string, string>;
  kategoris: { id: number; nama: string; deskripsi?: string | null }[];
  allTags: { id: number; name: string; color: string }[];
  [key: string]: unknown;
}

export default function Items() {
  const { props } = usePage<PageProps>();
  const { items = { data: [], meta: {} }, filters = {} as Record<string, string>, kategoris = [], allTags = [] } = props;

  // --- sort key mappings (client <> server)
  const clientToServer: Record<string, string> = { name: 'nama', stock: 'stok', category: 'kategori' };
  const serverToClient: Record<string, string> = { nama: 'name', stok: 'stock', kategori: 'category' };

  // Local state copies so we can do optimistic updates
  const [localItems, setLocalItems] = useState<Item[]>(items.data ?? []);
  // normalize incoming filters.sort_by (server key) to client key
  const initialSortBy = serverToClient[filters.sort_by] ?? (filters.sort_by ?? 'name');
  const [query, setQuery] = useState<string>(filters.search ?? '');
  const [sortBy, setSortBy] = useState<string>(initialSortBy);
  const [sortDir, setSortDir] = useState<string>(filters.sort_dir ?? 'asc');
  const [perPage, setPerPage] = useState<number>(Number(filters.per_page) || ITEMS_PER_PAGE);

  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewItem, setViewItem] = useState<Item | null>(null);

  // edit modal state handled by Inertia useForm
  const form = useForm<{
    id: number | null;
    name: string;
    description: string;
    qrcode: string;
    stock: number;
    stock_min: number;
    harga_beli: number;
    harga_jual: number;
    category: string;
    id_kategori: number | null;
  }>({
    id: null,
    name: '',
    description: '',
    qrcode: '',
    stock: 0,
    stock_min: 0,
    harga_beli: 0,
    harga_jual: 0,
    category: '',
    id_kategori: null,
  });
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const [tagItem, setTagItem] = useState<Item | null>(null);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);

  useEffect(() => {
    setLocalItems(items.data ?? []);
    if (items?.meta?.per_page) {
      setPerPage(Number(items.meta.per_page));
    }

    // If server filter changes, sync sortBy & sortDir to client keys
    if (filters.sort_by) {
      const clientKey = serverToClient[filters.sort_by] ?? filters.sort_by;
      setSortBy(clientKey);
    }
    if (filters.sort_dir) {
      setSortDir(filters.sort_dir);
    }
  }, [items, filters]);

  const mapSortBy = (col: string) => clientToServer[col] ?? col;

  // helper to get server key to send
  const serverSortKey = () => mapSortBy(sortBy);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e?.preventDefault();
    router.get(
      route('item.index'),
      { search: query, per_page: perPage, sort_by: serverSortKey(), sort_dir: sortDir },
      { preserveState: true, replace: true }
    );
  };

  const handleSort = (col: string) => {
    // col is client-key ('name'|'stock'|'category')
    let newDir = 'asc';
    if (sortBy === col) newDir = sortDir === 'asc' ? 'desc' : 'asc';
    setSortBy(col);
    setSortDir(newDir);

    // always send server-key
    router.get(
      route('item.index'),
      { search: query, per_page: perPage, sort_by: clientToServer[col] ?? col, sort_dir: newDir },
      { preserveState: true, replace: true }
    );
  };

  const sortIcon = (col: string) => (sortBy === col ? (sortDir === 'asc' ? '▲' : '▼') : '⇅');

  const handlePage = (page: number) => {
    router.get(
      route('item.index'),
      { search: query, per_page: perPage, sort_by: serverSortKey(), sort_dir: sortDir, page },
      { preserveState: true }
    );
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePerPageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const pp = parseInt(e.target.value, 10) || ITEMS_PER_PAGE;
    setPerPage(pp);
    router.get(
      route('item.index'),
      { search: query, per_page: pp, sort_by: serverSortKey(), sort_dir: sortDir },
      { preserveState: true, replace: true }
    );
  };

  const handleAddItem = () => {
    router.visit(route('item.tambah'));
  };

  const openView = (item: Item) => {
    setViewItem(item);
    setIsViewModalOpen(true);
  };

  const openEditModal = (item: Item) => {
    form.reset();
    const idKategori =
      item.id_kategori ??
      (item.kategori_rel ? item.kategori_rel.id : null) ??
      (item.category ? (kategoris.find((k) => k.nama === item.category) || {}).id : null);

    const kategoriName =
      item.category ??
      (item.kategori_rel ? item.kategori_rel.nama : null) ??
      (idKategori ? (kategoris.find((k) => k.id === idKategori) || {}).nama : '');

    form.setData({
      id: item.id,
      name: item.name ?? '',
      description: item.description ?? '',
      qrcode: item.qrcode ?? '',
      stock: item.stock ?? 0,
      stock_min: item.stock_min ?? 0,
      harga_beli: item.harga_beli ?? 0,
      harga_jual: item.harga_jual ?? 0,
      category: kategoriName ?? '',
      id_kategori: idKategori ?? null,
    });

    setIsEditModalOpen(true);
  };

  const handleDelete = (id: number) => {
    if (!confirm('Yakin ingin menghapus item ini?')) return;
    const snapshot = [...localItems];
    setLocalItems((prev) => prev.filter((i) => i.id !== id));

    router.delete(route('item.destroy', id), {
      preserveState: true,
      onSuccess: () => alert('Item berhasil dihapus'),
      onError: () => {
        setLocalItems(snapshot);
        alert('Gagal menghapus item. Coba lagi.');
      },
    });
  };

  const submitEdit = (e: React.FormEvent) => {
    e.preventDefault();
    const id = form.data.id;
    if (!id) return;
    // Ensure category name is set from the selected id_kategori before submitting
    const resolvedCategory = form.data.category || (kategoris.find((k) => k.id === form.data.id_kategori) || {}).nama || '';
    form.setData('category', resolvedCategory);

    form.put(route('item.update', id), {
      onSuccess: () => {
        setIsEditModalOpen(false);
        setLocalItems((prev) =>
          prev.map((it) =>
            it.id === id
              ? {
                  ...it,
                  name: form.data.name,
                  description: form.data.description,
                  qrcode: form.data.qrcode,
                  stock: form.data.stock,
                  stock_min: form.data.stock_min,
                  category: form.data.category,
                  id_kategori: form.data.id_kategori ?? it.id_kategori ?? null,
                }
              : it
          )
        );
        alert('Item berhasil diperbarui');
      },
    });
  };

  function openTagEdit(item: Item) {
    setTagItem(item);
    setSelectedTagIds(item.tags.map((t: { id: number }) => t.id));
  }

  function submitTags() {
    if (!tagItem) return;
    router.patch(route('item.sync_tags', { item: tagItem.id }), { tag_ids: selectedTagIds }, {
      onSuccess: () => setTagItem(null),
    });
  }

  // pagination meta normalization
  const paginated = items;
  const extractMeta = (p: typeof items | null) => {
    if (!p) return null;
    const m = p.meta ?? p;
    const current_page = Number(m.current_page ?? m.currentPage ?? m.page ?? 1);
    const last_page = Number(m.last_page ?? m.lastPage ?? m.total_pages ?? 1);
    const per_page = Number(m.per_page ?? m.perPage ?? perPage);
    const total = Number(m.total ?? m.count ?? 0);
    return { current_page, last_page, per_page, total };
  };
  const meta = extractMeta(paginated);
  const totalPages = meta?.last_page ?? 1;
  const currentPage = meta?.current_page ?? 1;
  const perPageFromMeta = meta?.per_page ?? perPage;

  const gotoPage = (p: number) => {
    if (!meta) return;
    if (p < 1 || p > meta.last_page) return;
    handlePage(p);
  };

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
                <th className="px-4 py-2 text-left cursor-default select-none">#</th>
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
                <th className="px-4 py-2 text-right">Harga Jual</th>
                <th className="px-4 py-2 text-left text-xs font-medium">Tags</th>
                <th className="px-4 py-2 text-left">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {localItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-6 text-muted-foreground">
                    Item tidak ditemukan
                  </td>
                </tr>
              ) : (
                localItems.map((item, idx) => (
                  <tr key={item.id} className="border-b last:border-b-0 text-muted-foreground">
                    <td className="px-4 py-2">{(currentPage - 1) * perPageFromMeta + idx + 1}</td>
                    <td className="px-4 py-2">{item.name}</td>
                    <td className="px-4 py-2">{item.qrcode}</td>
                    <td className="px-4 py-2">{item.stock}</td>
                    <td className="px-4 py-2">
                      {item.category ?? (item.kategori_rel ? item.kategori_rel.nama : '-')}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {item.harga_jual > 0
                        ? `Rp ${item.harga_jual.toLocaleString('id-ID')}`
                        : <span className="text-muted-foreground">-</span>}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex flex-wrap gap-1">
                        {item.tags.map((t: { id: number; name: string; color: string }) => (
                          <span
                            key={t.id}
                            className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium text-white"
                            style={{ backgroundColor: t.color }}
                          >
                            {t.name}
                          </span>
                        ))}
                        {item.tags.length === 0 && (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </div>
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
                            <button onClick={() => openTagEdit(item)} title="Edit Tags" className="rounded p-1.5 hover:bg-accent text-indigo-600" aria-label="Edit Tags">
                              <Tag className="h-4 w-4" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>Edit Tags</TooltipContent>
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

        {/* Pagination */}
        <Pagination meta={meta} onPageChange={gotoPage} siblingCount={1} />
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
              <p><strong>Nama:</strong> {viewItem.name}</p>
              <p><strong>Deskripsi:</strong> {viewItem.description}</p>
              <p><strong>QR Code:</strong> {viewItem.qrcode}</p>
              <p><strong>Stok:</strong> {viewItem.stock}</p>
              <p><strong>Stok Minimal:</strong> {viewItem.stock_min}</p>
              <p><strong>Harga Beli:</strong> Rp {viewItem.harga_beli?.toLocaleString('id-ID')}</p>
              <p><strong>Harga Jual:</strong> Rp {viewItem.harga_jual?.toLocaleString('id-ID')}</p>
              <p><strong>Kategori:</strong> {viewItem.category ?? (viewItem.kategori_rel ? viewItem.kategori_rel.nama : '-')}</p>
              <img src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(viewItem.qrcode ?? '')}`} alt="QR Code" className="mx-auto mt-4 rounded-lg border border-white p-3" />
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
              <input type='hidden' value={form.data.id ?? ''} readOnly />
              
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
                <input type="number" value={form.data.stock} onChange={(e) => form.setData('stock', Number(e.target.value))} className="w-full border rounded px-2 py-1" />
                {form.errors.stock && <div className="text-destructive text-sm">{form.errors.stock}</div>}
              </div>
              <div>
                <label className="block text-sm font-medium">Stok Minimal</label>
                <input type="number" value={form.data.stock_min} onChange={(e) => form.setData('stock_min', Number(e.target.value))} className="w-full border rounded px-2 py-1" />
                {form.errors.stock_min && <div className="text-destructive text-sm">{form.errors.stock_min}</div>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-sm font-medium">Harga Beli (Rp)</label>
                <input type="number" min={0} value={form.data.harga_beli} onChange={(e) => form.setData('harga_beli', Number(e.target.value))} className="w-full border rounded px-2 py-1" />
                {form.errors.harga_beli && <div className="text-destructive text-sm">{form.errors.harga_beli}</div>}
              </div>
              <div>
                <label className="block text-sm font-medium">Harga Jual (Rp)</label>
                <input type="number" min={0} value={form.data.harga_jual} onChange={(e) => form.setData('harga_jual', Number(e.target.value))} className="w-full border rounded px-2 py-1" />
                {form.errors.harga_jual && <div className="text-destructive text-sm">{form.errors.harga_jual}</div>}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" onClick={() => { form.reset(); setIsEditModalOpen(false); }}>Batal</Button>
              <Button type="submit" disabled={form.processing} className="ml-2">Simpan</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      
      {/* View & Edit Modals omitted for brevity (unchanged) */}

      {/* Tag Assignment Modal */}
      {tagItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-lg border bg-background p-6 shadow-lg space-y-4">
            <h2 className="font-semibold text-lg">Tags — {tagItem.name}</h2>
            {allTags.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Belum ada tag.{' '}
                <a href="/tags" className="text-primary hover:underline">Buat tag dulu →</a>
              </p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {allTags.map(t => (
                  <label key={t.id} className="flex items-center gap-3 cursor-pointer hover:bg-muted/50 rounded-md p-2">
                    <input
                      type="checkbox"
                      checked={selectedTagIds.includes(t.id)}
                      onChange={e => {
                        setSelectedTagIds(prev =>
                          e.target.checked ? [...prev, t.id] : prev.filter(id => id !== t.id)
                        );
                      }}
                      className="h-4 w-4 rounded"
                    />
                    <div className="h-4 w-4 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
                    <span className="text-sm">{t.name}</span>
                  </label>
                ))}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button onClick={() => setTagItem(null)} className="rounded-md border px-3 py-2 text-sm hover:bg-accent">Batal</button>
              <button onClick={submitTags} className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground hover:bg-primary/90">Simpan</button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}