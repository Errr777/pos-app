import { useEffect, useState } from 'react';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import {
  Search, Plus, Pencil, Trash2, Eye, Download,
  Phone, Mail, MapPin, User, Building2, Truck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter, DialogClose,
} from '@/components/ui/dialog';
import Pagination, { type PaginationMeta } from '@/components/Pagination';

const breadcrumbs: BreadcrumbItem[] = [
  { title: 'Dashboard', href: '/dashboard' },
  { title: 'Supplier', href: '/suppliers' },
];

interface SupplierRow {
  id: number;
  name: string;
  code: string | null;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string | null;
}

interface PaginatedSuppliers {
  data: SupplierRow[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from: number | null;
  to: number | null;
}

interface Filters {
  search?: string;
  sort_by?: string;
  sort_dir?: string;
  per_page?: string | number;
  status?: string;
}

interface PageProps {
  suppliers: PaginatedSuppliers;
  filters: Filters;
  [key: string]: unknown;
}

const emptyForm = {
  name: '',
  code: '',
  contact_person: '',
  phone: '',
  email: '',
  address: '',
  city: '',
  notes: '',
  is_active: true,
};

export default function SupplierIndex() {
  const { suppliers, filters } = usePage<PageProps>().props;

  const [search, setSearch]   = useState(filters.search ?? '');
  const [sortBy, setSortBy]   = useState(filters.sort_by ?? 'name');
  const [sortDir, setSortDir] = useState(filters.sort_dir ?? 'asc');
  const [perPage, setPerPage] = useState(String(filters.per_page ?? '20'));
  const [status, setStatus]   = useState(filters.status ?? 'all');

  const [showForm, setShowForm]       = useState(false);
  const [editTarget, setEditTarget]   = useState<SupplierRow | null>(null);
  const [form, setForm]               = useState({ ...emptyForm });
  const [errors, setErrors]           = useState<Record<string, string>>({});
  const [submitting, setSubmitting]   = useState(false);

  const [viewTarget, setViewTarget]   = useState<SupplierRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SupplierRow | null>(null);
  const [deleting, setDeleting]       = useState(false);

  useEffect(() => {
    setSearch(filters.search ?? '');
    setSortBy(filters.sort_by ?? 'name');
    setSortDir(filters.sort_dir ?? 'asc');
    setPerPage(String(filters.per_page ?? '20'));
    setStatus(filters.status ?? 'all');
  }, [filters]);

  const navigate = (overrides: Partial<Filters & { page?: number }> = {}) => {
    router.get(
      route('suppliers.index'),
      {
        search,
        sort_by: sortBy,
        sort_dir: sortDir,
        per_page: perPage,
        status,
        ...overrides,
      },
      { preserveState: true, replace: true },
    );
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    navigate({ page: 1 });
  };

  const handleSort = (col: string) => {
    const newDir = col === sortBy && sortDir === 'asc' ? 'desc' : 'asc';
    setSortBy(col);
    setSortDir(newDir);
    navigate({ sort_by: col, sort_dir: newDir, page: 1 });
  };

  const handlePage = (page: number) => navigate({ page });

  const SortIcon = ({ col }: { col: string }) => {
    if (col !== sortBy) return <span className="opacity-30 ml-1">↕</span>;
    return <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  // ─── Form helpers ───────────────────────────────────────────────────────────
  const openAdd = () => {
    setEditTarget(null);
    setForm({ ...emptyForm });
    setErrors({});
    setShowForm(true);
  };

  const openEdit = (s: SupplierRow) => {
    setEditTarget(s);
    setForm({
      name:           s.name,
      code:           s.code ?? '',
      contact_person: s.contactPerson ?? '',
      phone:          s.phone ?? '',
      email:          s.email ?? '',
      address:        s.address ?? '',
      city:           s.city ?? '',
      notes:          s.notes ?? '',
      is_active:      s.isActive,
    });
    setErrors({});
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const payload = {
      ...form,
      is_active: form.is_active ? 1 : 0,
    };
    const opts = {
      onSuccess: () => { setShowForm(false); setSubmitting(false); },
      onError: (errs: Record<string, string>) => { setErrors(errs); setSubmitting(false); },
    };
    if (editTarget) {
      router.put(route('suppliers.update', { supplier: editTarget.id }), payload, opts);
    } else {
      router.post(route('suppliers.store'), payload, opts);
    }
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    setDeleting(true);
    router.delete(route('suppliers.destroy', { supplier: deleteTarget.id }), {
      onSuccess: () => { setDeleteTarget(null); setDeleting(false); },
      onError: () => setDeleting(false),
    });
  };

  // ─── CSV export ─────────────────────────────────────────────────────────────
  const exportCSV = () => {
    const headers = ['Nama', 'Kode', 'Kontak', 'Telepon', 'Email', 'Kota', 'Status'];
    const rows = suppliers.data.map(s => [
      s.name,
      s.code ?? '',
      s.contactPerson ?? '',
      s.phone ?? '',
      s.email ?? '',
      s.city ?? '',
      s.isActive ? 'Aktif' : 'Nonaktif',
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'suppliers.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const meta: PaginationMeta = {
    current_page: suppliers.current_page,
    last_page:    suppliers.last_page,
    per_page:     suppliers.per_page,
    total:        suppliers.total,
    from:         suppliers.from,
    to:           suppliers.to,
  };

  const inputCls = (field: string) =>
    `w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary ${
      errors[field] ? 'border-red-400' : 'border-border'
    }`;

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title="Supplier" />

      <div className="p-4 md:p-6 space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Manajemen Supplier</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Kelola daftar supplier/pemasok barang
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportCSV}>
              <Download size={15} className="mr-1" /> Ekspor CSV
            </Button>
            <Button size="sm" onClick={openAdd}>
              <Plus size={15} className="mr-1" /> Tambah Supplier
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-2">
          <form onSubmit={handleSearch} className="flex gap-2 flex-1">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Cari nama, kode, kota…"
                className="pl-8 pr-3 py-2 text-sm border border-border rounded w-full focus:outline-none focus:ring-2 focus:ring-primary"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <Button type="submit" size="sm" variant="outline">Cari</Button>
          </form>
          <select
            className="text-sm border border-border rounded px-2 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
            value={status}
            onChange={e => { setStatus(e.target.value); navigate({ status: e.target.value, page: 1 }); }}
          >
            <option value="all">Semua Status</option>
            <option value="active">Aktif</option>
            <option value="inactive">Nonaktif</option>
          </select>
          <select
            className="text-sm border border-border rounded px-2 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
            value={perPage}
            onChange={e => { setPerPage(e.target.value); navigate({ per_page: e.target.value, page: 1 }); }}
          >
            {['10','20','50','100'].map(n => <option key={n} value={n}>{n} / halaman</option>)}
          </select>
        </div>

        {/* Table */}
        <div className="rounded-lg border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium cursor-pointer select-none" onClick={() => handleSort('name')}>
                  Nama Supplier <SortIcon col="name" />
                </th>
                <th className="text-left px-4 py-3 font-medium cursor-pointer select-none" onClick={() => handleSort('code')}>
                  Kode <SortIcon col="code" />
                </th>
                <th className="text-left px-4 py-3 font-medium">Kontak</th>
                <th className="text-left px-4 py-3 font-medium cursor-pointer select-none" onClick={() => handleSort('city')}>
                  Kota <SortIcon col="city" />
                </th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-right px-4 py-3 font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {suppliers.data.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3 text-muted-foreground">
                      <Truck className="h-10 w-10 opacity-40" />
                      <div>
                        <p className="font-medium text-foreground">Belum ada supplier</p>
                        <p className="text-sm mt-1">Tambahkan supplier untuk mulai membuat Purchase Order.</p>
                      </div>
                      <button
                        onClick={openAdd}
                        className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition"
                      >
                        <Plus size={15} /> Tambah Supplier
                      </button>
                    </div>
                  </td>
                </tr>
              ) : suppliers.data.map(s => (
                <tr key={s.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium">{s.name}</div>
                    {s.contactPerson && (
                      <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <User size={11} /> {s.contactPerson}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {s.code ? (
                      <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{s.code}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="space-y-0.5">
                      {s.phone && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Phone size={11} /> {s.phone}
                        </div>
                      )}
                      {s.email && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Mail size={11} /> {s.email}
                        </div>
                      )}
                      {!s.phone && !s.email && <span className="text-muted-foreground">—</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {s.city ? (
                      <div className="flex items-center gap-1 text-sm">
                        <MapPin size={12} className="text-muted-foreground" /> {s.city}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      s.isActive
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}>
                      {s.isActive ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        className="p-1.5 rounded hover:bg-sky-100 text-sky-600 transition-colors"
                        title="Lihat detail"
                        onClick={() => setViewTarget(s)}
                      >
                        <Eye size={15} />
                      </button>
                      <button
                        className="p-1.5 rounded hover:bg-amber-100 text-amber-600 transition-colors"
                        title="Edit supplier"
                        onClick={() => openEdit(s)}
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        className="p-1.5 rounded hover:bg-red-100 text-red-600 transition-colors"
                        title="Hapus supplier"
                        onClick={() => setDeleteTarget(s)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Pagination
          meta={meta}
          onPageChange={handlePage}
          summary={<span>Total: <span className="font-medium text-foreground">{suppliers.total}</span> supplier</span>}
        />
      </div>

      {/* ── Add / Edit Dialog ───────────────────────────────────────────────── */}
      <Dialog open={showForm} onOpenChange={open => { if (!open) setShowForm(false); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editTarget ? 'Edit Supplier' : 'Tambah Supplier Baru'}</DialogTitle>
            <DialogDescription>
              {editTarget ? `Memperbarui data supplier "${editTarget.name}"` : 'Isi informasi supplier baru'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium mb-1">
                Nama Supplier <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className={inputCls('name')}
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Nama perusahaan / supplier"
              />
              {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
            </div>

            {/* Code */}
            <div>
              <label className="block text-sm font-medium mb-1">Kode Supplier</label>
              <input
                type="text"
                className={inputCls('code')}
                value={form.code}
                onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
                placeholder="Biarkan kosong untuk generate otomatis"
              />
              {errors.code && <p className="text-red-500 text-xs mt-1">{errors.code}</p>}
            </div>

            {/* Contact Person */}
            <div>
              <label className="block text-sm font-medium mb-1">Nama Kontak</label>
              <input
                type="text"
                className={inputCls('contact_person')}
                value={form.contact_person}
                onChange={e => setForm(f => ({ ...f, contact_person: e.target.value }))}
                placeholder="PIC / nama kontak"
              />
              {errors.contact_person && <p className="text-red-500 text-xs mt-1">{errors.contact_person}</p>}
            </div>

            {/* Phone + Email */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Telepon</label>
                <input
                  type="text"
                  className={inputCls('phone')}
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="0812…"
                />
                {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input
                  type="email"
                  className={inputCls('email')}
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="email@contoh.com"
                />
                {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
              </div>
            </div>

            {/* City */}
            <div>
              <label className="block text-sm font-medium mb-1">Kota</label>
              <input
                type="text"
                className={inputCls('city')}
                value={form.city}
                onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                placeholder="Jakarta, Surabaya, dll."
              />
              {errors.city && <p className="text-red-500 text-xs mt-1">{errors.city}</p>}
            </div>

            {/* Address */}
            <div>
              <label className="block text-sm font-medium mb-1">Alamat</label>
              <textarea
                rows={2}
                className={inputCls('address')}
                value={form.address}
                onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                placeholder="Jl. …"
              />
              {errors.address && <p className="text-red-500 text-xs mt-1">{errors.address}</p>}
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium mb-1">Catatan</label>
              <textarea
                rows={2}
                className={inputCls('notes')}
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Catatan tambahan…"
              />
              {errors.notes && <p className="text-red-500 text-xs mt-1">{errors.notes}</p>}
            </div>

            {/* Is Active */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_active"
                checked={form.is_active}
                onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                className="w-4 h-4 accent-primary"
              />
              <label htmlFor="is_active" className="text-sm">Supplier aktif</label>
            </div>

            <DialogFooter className="pt-2">
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={submitting}>Batal</Button>
              </DialogClose>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Menyimpan…' : (editTarget ? 'Simpan Perubahan' : 'Tambah Supplier')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── View Detail Dialog ──────────────────────────────────────────────── */}
      <Dialog open={!!viewTarget} onOpenChange={open => { if (!open) setViewTarget(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 size={18} />
              {viewTarget?.name}
            </DialogTitle>
          </DialogHeader>
          {viewTarget && (
            <div className="space-y-3 text-sm">
              {viewTarget.code && (
                <div className="flex gap-2">
                  <span className="text-muted-foreground w-28 shrink-0">Kode</span>
                  <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-xs">{viewTarget.code}</span>
                </div>
              )}
              {viewTarget.contactPerson && (
                <div className="flex gap-2">
                  <span className="text-muted-foreground w-28 shrink-0">Kontak</span>
                  <span>{viewTarget.contactPerson}</span>
                </div>
              )}
              {viewTarget.phone && (
                <div className="flex gap-2">
                  <span className="text-muted-foreground w-28 shrink-0">Telepon</span>
                  <span>{viewTarget.phone}</span>
                </div>
              )}
              {viewTarget.email && (
                <div className="flex gap-2">
                  <span className="text-muted-foreground w-28 shrink-0">Email</span>
                  <span>{viewTarget.email}</span>
                </div>
              )}
              {viewTarget.city && (
                <div className="flex gap-2">
                  <span className="text-muted-foreground w-28 shrink-0">Kota</span>
                  <span>{viewTarget.city}</span>
                </div>
              )}
              {viewTarget.address && (
                <div className="flex gap-2">
                  <span className="text-muted-foreground w-28 shrink-0">Alamat</span>
                  <span className="leading-relaxed">{viewTarget.address}</span>
                </div>
              )}
              {viewTarget.notes && (
                <div className="flex gap-2">
                  <span className="text-muted-foreground w-28 shrink-0">Catatan</span>
                  <span className="leading-relaxed">{viewTarget.notes}</span>
                </div>
              )}
              <div className="flex gap-2">
                <span className="text-muted-foreground w-28 shrink-0">Status</span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                  viewTarget.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  {viewTarget.isActive ? 'Aktif' : 'Nonaktif'}
                </span>
              </div>
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Tutup</Button>
            </DialogClose>
            {viewTarget && (
              <Button onClick={() => { openEdit(viewTarget); setViewTarget(null); }}>
                <Pencil size={14} className="mr-1" /> Edit
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm Dialog ───────────────────────────────────────────── */}
      <Dialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Hapus Supplier</DialogTitle>
            <DialogDescription>
              Yakin ingin menghapus supplier{' '}
              <span className="font-semibold text-foreground">"{deleteTarget?.name}"</span>?
              Tindakan ini tidak dapat dibatalkan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-2">
            <DialogClose asChild>
              <Button variant="outline" disabled={deleting}>Batal</Button>
            </DialogClose>
            <Button variant="destructive" disabled={deleting} onClick={handleDelete}>
              {deleting ? 'Menghapus…' : 'Ya, Hapus'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
