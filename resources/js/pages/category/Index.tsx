import { useState, useEffect } from 'react';
import AppLayout from '@/layouts/app-layout';
import { Head, router, usePage, useForm } from '@inertiajs/react';
import { Search, Plus, Pencil, Trash, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import Pagination, { PaginationMeta } from '@/components/Pagination';

const ITEMS_PER_PAGE = 10;
const breadcrumbs = [
  { title: 'Dashboard', href: '/dashboard' },
  { title: 'Kategori', href: '/category' },
];

type Kategori = {
  id: number;
  nama: string;
  deskripsi?: string | null;
  [key: string]: any;
};

export default function Index() {
  const { props } = usePage<any>();
  const { kategoris = { data: [], meta: {} }, filters = {} } = props;

  const [local, setLocal] = useState<Kategori[]>(kategoris.data ?? []);
  const [query, setQuery] = useState<string>(filters.search ?? '');
  const [perPage, setPerPage] = useState<number>(filters.per_page ?? ITEMS_PER_PAGE);

  // --- SORT STATE (keeps behavior from before) ---
  const [sortBy, setSortBy] = useState<string | null>(filters.sort_by ?? null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(
    filters.sort_dir === 'asc' ? 'asc' : 'desc'
  );

  // modals / view state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewItem, setViewItem] = useState<Kategori | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // separate forms: createForm and editForm
  const createForm = useForm({
    nama: '',
    deskripsi: '',
  });
  const editForm = useForm({
    id: null as number | null,
    nama: '',
    deskripsi: '',
  });

  useEffect(() => {
    setLocal(kategoris.data ?? []);
    if (kategoris.meta?.per_page) setPerPage(kategoris.meta.per_page);
  }, [kategoris]);

  // ----- normalize paginator meta so Pagination always works -----
  const extractMeta = (p: any): PaginationMeta | null => {
    if (!p) return null;
    const m = p.meta ?? p;
    if (!m) return null;

    const current_page = Number(m.current_page ?? m.currentPage ?? m.page ?? 1);
    const last_page = Number(m.last_page ?? m.lastPage ?? m.total_pages ?? 1);
    const per_page = Number(m.per_page ?? m.perPage ?? perPage);
    const total = Number(m.total ?? m.count ?? 0);

    return { current_page, last_page, per_page, total };
  };

  const paginated = kategoris;
  const meta = extractMeta(paginated);

  // Sorting helpers (Nama / Deskripsi)
  const applySort = (column: string) => {
    let nextDir: 'asc' | 'desc' = 'asc';
    if (sortBy === column) nextDir = sortDir === 'asc' ? 'desc' : 'asc';

    setSortBy(column);
    setSortDir(nextDir);

    router.get(
      route('kategori.index'),
      { search: query, per_page: perPage, sort_by: column, sort_dir: nextDir },
      { preserveState: true, replace: true }
    );
  };

  const sortIcon = (column: string) => {
    if (sortBy !== column) return '⇅';
    return sortDir === 'asc' ? '▲' : '▼';
  };

  const openView = (item: Kategori) => {
    setViewItem(item);
    setIsViewModalOpen(true);
  };

  const openEditModal = (item: Kategori) => {
    // populate editForm with item values
    editForm.reset();
    editForm.setData({
      id: item.id,
      nama: item.nama ?? '',
      deskripsi: item.deskripsi ?? '',
    });
    setIsEditModalOpen(true);
  };

  const handleSearch = (e?: React.FormEvent) => {
    e?.preventDefault();
    router.get(
      route('kategori.index'),
      { search: query, per_page: perPage, sort_by: sortBy ?? undefined, sort_dir: sortDir },
      { preserveState: true, replace: true }
    );
  };

  const handlePerPage = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const pp = parseInt(e.target.value, 10) || ITEMS_PER_PAGE;
    setPerPage(pp);
    router.get(
      route('kategori.index'),
      { search: query, per_page: pp, sort_by: sortBy ?? undefined, sort_dir: sortDir },
      { preserveState: true, replace: true }
    );
  };

  // create category
  const submitCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createForm.post(route('kategori.store'), {
      onSuccess: (page) => {
        setIsCreateModalOpen(false);

        // Prefer server-provided list if available — otherwise optimistic insert
        const fresh = (page.props as Record<string, any>)?.kategoris?.data;
        if (fresh) setLocal(fresh); else {
          // optimistic: prepend newest
          setLocal((prev) => [{ id: Date.now(), nama: createForm.data.nama, deskripsi: createForm.data.deskripsi }, ...prev]);
        }

        createForm.reset();
      },
    });
  };

  // submit edit
  const submitEdit = (e: React.FormEvent) => {
    e.preventDefault();
    const id = editForm.data.id;
    if (!id) return;

    // Use editForm.put so Inertia manages processing & errors
    editForm.put(route('kategori.update', id), {
      onStart: () => {
        /* optional hook */
      },
      onSuccess: (page) => {
        setIsEditModalOpen(false);

        // optimistic update local list with returned values (best effort)
        setLocal((prev) =>
          prev.map((k) =>
            k.id === id
              ? { ...k, nama: editForm.data.nama, deskripsi: editForm.data.deskripsi }
              : k
          )
        );

        // If server returned a fresh list in props, prefer that (keeps pagination consistent)
        const fresh = (page.props as Record<string, any>)?.kategoris?.data;
        if (fresh) setLocal(fresh);

        editForm.reset();
      },
      onError: () => {
        // errors available at editForm.errors
      },
    });
  };

  const handleDelete = (id: number) => {
    if (!confirm('Hapus kategori ini?')) return;
    const snapshot = [...local];
    setLocal((prev) => prev.filter((k) => k.id !== id));

    router.delete(route('kategori.destroy', id), {
      onError: () => {
        setLocal(snapshot);
        alert('Gagal menghapus kategori.');
      },
      onSuccess: () => {
        // optionally refresh from server or rely on optimistic removal
      },
    });
  };

  const gotoPage = (p: number) => {
    if (!meta) return;
    if (p < 1 || p > (meta.last_page ?? 1)) return;

    router.get(
      route('kategori.index'),
      { page: p, per_page: perPage, search: query, sort_by: sortBy ?? undefined, sort_dir: sortDir },
      { preserveState: true }
    );
  };

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title="Kategori" />
      <div className="relative min-h-[100vh] flex-1 overflow-hidden rounded-xl border border-sidebar-border/70 md:min-h-min dark:border-sidebar-border bg-white dark:bg-background p-4">
        <div className="flex justify-between mb-4 gap-2">
          <form onSubmit={handleSearch} className="relative w-full max-w-xs">
            <span className="absolute inset-y-0 left-3 flex items-center text-muted-foreground pointer-events-none">
              <Search size={16} />
            </span>
            <input
              type="text"
              className="w-full px-10 py-2 border rounded-lg bg-muted pl-12"
              placeholder="Cari kategori..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{ minWidth: 200 }}
            />
          </form>

          <div className="flex items-center gap-2">
            <select value={perPage} onChange={handlePerPage} className="border rounded px-2 py-1">
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>

            <Button onClick={() => setIsCreateModalOpen(true)} className="gap-2">
              <Plus size={16} /> Tambah Kategori
            </Button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y">
            <thead>
              <tr className="bg-muted">
                <th className="px-4 py-2 text-left">#</th>

                <th
                  className="px-4 py-2 text-left cursor-pointer select-none"
                  onClick={() => applySort('nama')}
                  role="button"
                  aria-label="Sort by Nama"
                >
                  Nama <span className="inline-block ml-1">{sortIcon('nama')}</span>
                </th>

                <th
                  className="px-4 py-2 text-left cursor-pointer select-none"
                  onClick={() => applySort('deskripsi')}
                  role="button"
                  aria-label="Sort by Deskripsi"
                >
                  Deskripsi <span className="inline-block ml-1">{sortIcon('deskripsi')}</span>
                </th>

                <th className="px-4 py-2 text-left">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {local.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-6 text-muted-foreground">
                    Tidak ada kategori
                  </td>
                </tr>
              ) : (
                local.map((k, idx) => (
                  <tr key={k.id} className="border-t last:border-b-0 text-muted-foreground">
                    <td className="px-4 py-2">
                      {(meta?.per_page ?? perPage) * ((meta?.current_page ?? 1) - 1) + idx + 1}
                    </td>
                    <td className="px-4 py-2">{k.nama}</td>
                    <td className="px-4 py-2">{k.deskripsi ?? '-'}</td>
                    <td className="px-4 py-2 flex gap-2">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => openView(k)}
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
                              onClick={() => openEditModal(k)}
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
                              onClick={() => handleDelete(k.id)}
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

        {/* Pagination */}
        <div className="mt-4">
          <Pagination meta={meta} onPageChange={gotoPage} siblingCount={1} />
        </div>
      </div>

      {/* ----- View Modal ----- */}
      <Dialog
        open={isViewModalOpen}
        onOpenChange={(open) => {
          if (!open) setViewItem(null);
          setIsViewModalOpen(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{viewItem ? 'Detail Kategori' : 'Detail'}</DialogTitle>
            <DialogDescription>Informasi lengkap kategori terpilih.</DialogDescription>
          </DialogHeader>

          {viewItem && (
            <div className="space-y-2 gap-0.5">
              <p>
                <strong>Nama:</strong> {viewItem.nama}
              </p>
              <p>
                <strong>Deskripsi:</strong> {viewItem.deskripsi ?? '-'}
              </p>
            </div>
          )}

          <DialogFooter>
            <Button
              onClick={() => {
                setIsViewModalOpen(false);
                setViewItem(null);
              }}
            >
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ----- Create Modal ----- */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tambah Kategori</DialogTitle>
            <DialogDescription>Masukkan nama dan deskripsi kategori.</DialogDescription>
          </DialogHeader>

          <form onSubmit={submitCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium">Nama</label>
              <input
                type="text"
                value={createForm.data.nama}
                onChange={(e) => createForm.setData('nama', e.target.value)}
                className="w-full border rounded px-2 py-1"
              />
              {createForm.errors.nama && <div className="text-destructive text-sm">{createForm.errors.nama}</div>}
            </div>

            <div>
              <label className="block text-sm font-medium">Deskripsi</label>
              <textarea
                value={createForm.data.deskripsi}
                onChange={(e) => createForm.setData('deskripsi', e.target.value)}
                className="w-full border rounded px-2 py-1"
              />
              {createForm.errors.deskripsi && <div className="text-destructive text-sm">{createForm.errors.deskripsi}</div>}
            </div>

            <DialogFooter>
              <Button
                type="button"
                onClick={() => {
                  createForm.reset();
                  setIsCreateModalOpen(false);
                }}
              >
                Batal
              </Button>
              <Button type="submit" disabled={createForm.processing}>
                Simpan
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ----- Edit Modal ----- */}
      <Dialog open={isEditModalOpen} onOpenChange={(open) => { if (!open) { editForm.reset(); setIsEditModalOpen(false); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Kategori</DialogTitle>
            <DialogDescription>Ubah nama atau deskripsi lalu simpan.</DialogDescription>
          </DialogHeader>

          <form onSubmit={submitEdit} className="space-y-4">
            <div>
              <input type="hidden" value={String(editForm.data.id ?? '')} readOnly />
              <label className="block text-sm font-medium">Nama</label>
              <input
                type="text"
                value={editForm.data.nama}
                onChange={(e) => editForm.setData('nama', e.target.value)}
                className="w-full border rounded px-2 py-1"
              />
              {editForm.errors.nama && <div className="text-destructive text-sm">{editForm.errors.nama}</div>}
            </div>

            <div>
              <label className="block text-sm font-medium">Deskripsi</label>
              <textarea
                value={editForm.data.deskripsi}
                onChange={(e) => editForm.setData('deskripsi', e.target.value)}
                className="w-full border rounded px-2 py-1"
              />
              {editForm.errors.deskripsi && <div className="text-destructive text-sm">{editForm.errors.deskripsi}</div>}
            </div>

            <DialogFooter>
              <Button type="button" onClick={() => { editForm.reset(); setIsEditModalOpen(false); }}>
                Batal
              </Button>
              <Button type="submit" disabled={editForm.processing}>
                Simpan
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}