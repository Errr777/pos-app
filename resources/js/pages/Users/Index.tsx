import { useEffect, useState } from 'react';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import { Search, Plus, Pencil, Trash, KeyRound, Download, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter, DialogClose,
} from '@/components/ui/dialog';

const breadcrumbs: BreadcrumbItem[] = [
  { title: 'Dashboard', href: '/dashboard' },
  { title: 'Manajemen Pengguna', href: '/users' },
];

interface UserPermission {
  can_view: boolean;
  can_write: boolean;
  can_delete: boolean;
}

interface UserRow {
  id: number;
  name: string;
  email: string;
  role: string;
  created: string;
  isMe: boolean;
  permissions: Record<string, UserPermission>;
}

interface ModuleDefinition {
  label: string;
  actions: string[];
}

interface PaginatedUsers {
  data: UserRow[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

interface Filters {
  search?: string;
  sort_by?: string;
  sort_dir?: string;
  per_page?: string | number;
}

interface PageProps {
  users: PaginatedUsers;
  roles: string[];
  modules: Record<string, ModuleDefinition>;
  filters: Filters;
  [key: string]: unknown;
}

const roleBadge: Record<string, string> = {
  admin:  'bg-violet-100 text-violet-700',
  staff:  'bg-sky-100 text-sky-700',
  kasir:  'bg-emerald-100 text-emerald-700',
};

const actionLabel: Record<string, string> = {
  view:   'Lihat',
  write:  'Tulis',
  delete: 'Hapus',
};

const actionColor: Record<string, string> = {
  view:   'text-sky-600',
  write:  'text-emerald-600',
  delete: 'text-rose-600',
};

export default function UsersIndex() {
  const { props } = usePage<PageProps>();
  const { users, roles, modules, filters } = props;

  const [query, setQuery] = useState<string>(filters.search ?? '');
  const [sortBy, setSortBy] = useState<string>(filters.sort_by ?? 'name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(
    filters.sort_dir === 'desc' ? 'desc' : 'asc'
  );

  useEffect(() => {
    setQuery(filters.search ?? '');
    setSortBy(filters.sort_by ?? 'name');
    setSortDir(filters.sort_dir === 'desc' ? 'desc' : 'asc');
  }, [filters]);

  // --- Add form ---
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', email: '', role: roles[1] ?? 'staff', password: '', password_confirmation: '' });
  const [addErrors, setAddErrors] = useState<Record<string, string>>({});

  // --- Edit form ---
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<UserRow | null>(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', role: 'staff' });
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});

  // --- Reset PW form ---
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<UserRow | null>(null);
  const [resetForm, setResetForm] = useState({ password: '', password_confirmation: '' });
  const [resetErrors, setResetErrors] = useState<Record<string, string>>({});

  // --- Permissions form ---
  const [isPermOpen, setIsPermOpen] = useState(false);
  const [permTarget, setPermTarget] = useState<UserRow | null>(null);
  const [permForm, setPermForm] = useState<Record<string, UserPermission>>({});
  const [permSaving, setPermSaving] = useState(false);

  const navigate = (overrides: Record<string, unknown> = {}) => {
    router.get(
      route('users.index'),
      { search: query, sort_by: sortBy, sort_dir: sortDir, per_page: filters.per_page ?? 20, ...overrides },
      { preserveState: true, replace: true }
    );
  };

  const handleSort = (col: string) => {
    const newDir: 'asc' | 'desc' = sortBy === col ? (sortDir === 'asc' ? 'desc' : 'asc') : 'asc';
    setSortBy(col); setSortDir(newDir);
    navigate({ sort_by: col, sort_dir: newDir });
  };

  const sortIcon = (col: string) =>
    sortBy === col ? (sortDir === 'asc' ? '▲' : '▼') : '⇅';

  const handlePage = (page: number) => {
    navigate({ page });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Add
  const openAdd = () => {
    setAddForm({ name: '', email: '', role: roles[1] ?? 'staff', password: '', password_confirmation: '' });
    setAddErrors({});
    setIsAddOpen(true);
  };
  const submitAdd = (e: React.FormEvent) => {
    e.preventDefault();
    setAddErrors({});
    router.post(route('users.store'), addForm, {
      onSuccess: () => setIsAddOpen(false),
      onError: (errs) => setAddErrors(errs as Record<string, string>),
    });
  };

  // Edit
  const openEdit = (row: UserRow) => {
    setEditTarget(row);
    setEditForm({ name: row.name, email: row.email, role: row.role });
    setEditErrors({});
    setIsEditOpen(true);
  };
  const submitEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    setEditErrors({});
    router.put(route('users.update', { user: editTarget.id }), editForm, {
      onSuccess: () => setIsEditOpen(false),
      onError: (errs) => setEditErrors(errs as Record<string, string>),
    });
  };

  // Reset password
  const openReset = (row: UserRow) => {
    setResetTarget(row);
    setResetForm({ password: '', password_confirmation: '' });
    setResetErrors({});
    setIsResetOpen(true);
  };
  const submitReset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTarget) return;
    setResetErrors({});
    router.post(route('users.reset_password', { user: resetTarget.id }), resetForm, {
      onSuccess: () => setIsResetOpen(false),
      onError: (errs) => setResetErrors(errs as Record<string, string>),
    });
  };

  // Permissions
  const openPerms = (row: UserRow) => {
    setPermTarget(row);
    // Deep-copy current permissions into form state
    const copy: Record<string, UserPermission> = {};
    Object.keys(modules).forEach((mod) => {
      copy[mod] = { ...(row.permissions[mod] ?? { can_view: false, can_write: false, can_delete: false }) };
    });
    setPermForm(copy);
    setIsPermOpen(true);
  };

  const togglePerm = (mod: string, action: 'can_view' | 'can_write' | 'can_delete') => {
    setPermForm((prev) => {
      const updated = { ...prev, [mod]: { ...prev[mod] } };
      const newVal = !updated[mod][action];
      updated[mod][action] = newVal;
      // If enabling write or delete → also enable view
      if ((action === 'can_write' || action === 'can_delete') && newVal) {
        updated[mod].can_view = true;
      }
      // If disabling view → also disable write and delete
      if (action === 'can_view' && !newVal) {
        updated[mod].can_write = false;
        updated[mod].can_delete = false;
      }
      return updated;
    });
  };

  const setAllForModule = (mod: string, value: boolean) => {
    setPermForm((prev) => ({
      ...prev,
      [mod]: { can_view: value, can_write: value, can_delete: value },
    }));
  };

  const submitPerms = (e: React.FormEvent) => {
    e.preventDefault();
    if (!permTarget) return;
    setPermSaving(true);
    router.post(
      route('users.permissions', { user: permTarget.id }),
      { permissions: permForm },
      {
        onSuccess: () => { setIsPermOpen(false); setPermSaving(false); },
        onError: () => setPermSaving(false),
      }
    );
  };

  // Delete
  const handleDelete = (row: UserRow) => {
    if (row.isMe) return;
    if (!confirm(`Hapus pengguna "${row.name}"?`)) return;
    router.delete(route('users.destroy', { user: row.id }));
  };

  // Export CSV
  const exportCSV = () => {
    const header = ['Nama', 'Email', 'Role', 'Bergabung'];
    const lines = users.data.map(u => [u.name, u.email, u.role, u.created]);
    const csv = [header, ...lines]
      .map(row => row.map(c => {
        const s = String(c);
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      }).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pengguna_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const meta = users;

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title="Manajemen Pengguna" />
      <div className="relative min-h-[100vh] flex-1 overflow-hidden rounded-xl border border-sidebar-border/70 md:min-h-min dark:border-sidebar-border bg-white dark:bg-background p-4">

        {/* Toolbar */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
          <form className="flex-1" onSubmit={(e) => { e.preventDefault(); navigate({ search: query, page: 1 }); }}>
            <div className="relative w-full max-w-md">
              <span className="absolute inset-y-0 left-3 flex items-center text-muted-foreground pointer-events-none">
                <Search size={18} />
              </span>
              <input
                type="text"
                placeholder="Cari nama / email / role..."
                className="w-full px-10 py-2 border rounded-lg bg-muted pl-12"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onBlur={() => navigate({ search: query, page: 1 })}
              />
            </div>
          </form>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="gap-2" onClick={exportCSV} disabled={users.data.length === 0}>
              <Download size={16} /> Export CSV
            </Button>
            <Button onClick={openAdd} className="gap-2">
              <Plus size={16} /> Tambah Pengguna
            </Button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full border rounded-xl">
            <thead>
              <tr className="bg-muted">
                <th className="px-4 py-2 text-left cursor-pointer select-none" onClick={() => handleSort('name')}>Nama {sortIcon('name')}</th>
                <th className="px-4 py-2 text-left cursor-pointer select-none" onClick={() => handleSort('email')}>Email {sortIcon('email')}</th>
                <th className="px-4 py-2 text-left cursor-pointer select-none" onClick={() => handleSort('role')}>Role {sortIcon('role')}</th>
                <th className="px-4 py-2 text-left">Hak Akses</th>
                <th className="px-4 py-2 text-left cursor-pointer select-none" onClick={() => handleSort('created')}>Bergabung {sortIcon('created')}</th>
                <th className="px-4 py-2 text-left">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {users.data.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-6 text-muted-foreground">Data tidak ditemukan</td></tr>
              ) : (
                users.data.map((row) => (
                  <tr key={row.id} className="border-b last:border-b-0">
                    <td className="px-4 py-2 font-medium">
                      {row.name}
                      {row.isMe && <span className="ml-2 text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">Anda</span>}
                    </td>
                    <td className="px-4 py-2 text-sm text-muted-foreground">{row.email}</td>
                    <td className="px-4 py-2">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold capitalize ${roleBadge[row.role] ?? 'bg-muted text-muted-foreground'}`}>
                        {row.role}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      {row.role === 'admin' ? (
                        <span className="text-xs text-violet-600 font-semibold">Semua Akses</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(modules).map(([mod, def]) => {
                            const p = row.permissions[mod];
                            if (!p?.can_view) return null;
                            return (
                              <span key={mod} className="text-xs bg-muted px-1.5 py-0.5 rounded" title={def.label}>
                                {def.label.split(' ')[0]}
                                {p.can_write && p.can_delete ? ' ✦' : p.can_write ? ' ✎' : ''}
                              </span>
                            );
                          })}
                          {Object.values(row.permissions).every(p => !p.can_view) && (
                            <span className="text-xs text-muted-foreground italic">Tidak ada akses</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2 text-sm text-muted-foreground">{row.created}</td>
                    <td className="px-4 py-2 flex gap-1">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button onClick={() => openEdit(row)} className="text-primary border border-white hover:bg-primary hover:text-slate-600 hover:border-0 p-2 rounded-full transition">
                              <Pencil size={16} />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>Edit</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button onClick={() => openPerms(row)} className="text-violet-600 border border-white hover:bg-violet-100 p-2 rounded-full transition" disabled={row.role === 'admin'}>
                              <ShieldCheck size={16} />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>{row.role === 'admin' ? 'Admin memiliki semua akses' : 'Atur Hak Akses'}</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button onClick={() => openReset(row)} className="text-amber-600 border border-white hover:bg-amber-100 p-2 rounded-full transition">
                              <KeyRound size={16} />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>Reset Password</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => handleDelete(row)}
                              disabled={row.isMe}
                              className="text-destructive bg-amber-50 hover:bg-destructive hover:text-amber-50 p-2 rounded-full transition disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              <Trash size={16} />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>{row.isMe ? 'Tidak bisa hapus akun sendiri' : 'Hapus'}</TooltipContent>
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
        <div className="flex justify-between items-center mt-6 flex-wrap gap-2">
          <div className="text-sm text-muted-foreground">
            {meta.total > 0 && <span>Halaman {meta.current_page} / {meta.last_page} · {meta.total} pengguna</span>}
          </div>
          {meta.last_page > 1 && (
            <div className="flex gap-2 flex-wrap">
              {Array.from({ length: meta.last_page }).map((_, idx) => (
                <button key={idx} onClick={() => handlePage(idx + 1)}
                  className={`px-3 py-1 rounded border ${meta.current_page === idx + 1 ? 'bg-primary text-white' : 'bg-muted'}`}>
                  {idx + 1}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Add User ── */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent>
          <form onSubmit={submitAdd}>
            <DialogHeader>
              <DialogTitle>Tambah Pengguna</DialogTitle>
              <DialogDescription>Buat akun pengguna baru.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 mt-2">
              <div>
                <label className="block font-semibold mb-1">Nama</label>
                <input value={addForm.name} onChange={(e) => setAddForm(f => ({ ...f, name: e.target.value }))} className="w-full px-3 py-2 border rounded-lg" required />
                {addErrors.name && <p className="text-destructive text-sm mt-1">{addErrors.name}</p>}
              </div>
              <div>
                <label className="block font-semibold mb-1">Email</label>
                <input type="email" value={addForm.email} onChange={(e) => setAddForm(f => ({ ...f, email: e.target.value }))} className="w-full px-3 py-2 border rounded-lg" required />
                {addErrors.email && <p className="text-destructive text-sm mt-1">{addErrors.email}</p>}
              </div>
              <div>
                <label className="block font-semibold mb-1">Role</label>
                <select value={addForm.role} onChange={(e) => setAddForm(f => ({ ...f, role: e.target.value }))} className="w-full px-3 py-2 border rounded-lg">
                  {roles.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                </select>
                {addErrors.role && <p className="text-destructive text-sm mt-1">{addErrors.role}</p>}
              </div>
              <div>
                <label className="block font-semibold mb-1">Password</label>
                <input type="password" value={addForm.password} onChange={(e) => setAddForm(f => ({ ...f, password: e.target.value }))} className="w-full px-3 py-2 border rounded-lg" required />
                {addErrors.password && <p className="text-destructive text-sm mt-1">{addErrors.password}</p>}
              </div>
              <div>
                <label className="block font-semibold mb-1">Konfirmasi Password</label>
                <input type="password" value={addForm.password_confirmation} onChange={(e) => setAddForm(f => ({ ...f, password_confirmation: e.target.value }))} className="w-full px-3 py-2 border rounded-lg" required />
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button type="submit">Simpan</Button>
              <DialogClose asChild><Button type="button" variant="outline">Batal</Button></DialogClose>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Edit User ── */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <form onSubmit={submitEdit}>
            <DialogHeader>
              <DialogTitle>Edit Pengguna</DialogTitle>
              <DialogDescription>Ubah data {editTarget?.name}.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 mt-2">
              <div>
                <label className="block font-semibold mb-1">Nama</label>
                <input value={editForm.name} onChange={(e) => setEditForm(f => ({ ...f, name: e.target.value }))} className="w-full px-3 py-2 border rounded-lg" required />
                {editErrors.name && <p className="text-destructive text-sm mt-1">{editErrors.name}</p>}
              </div>
              <div>
                <label className="block font-semibold mb-1">Email</label>
                <input type="email" value={editForm.email} onChange={(e) => setEditForm(f => ({ ...f, email: e.target.value }))} className="w-full px-3 py-2 border rounded-lg" required />
                {editErrors.email && <p className="text-destructive text-sm mt-1">{editErrors.email}</p>}
              </div>
              <div>
                <label className="block font-semibold mb-1">Role</label>
                <select value={editForm.role} onChange={(e) => setEditForm(f => ({ ...f, role: e.target.value }))} className="w-full px-3 py-2 border rounded-lg">
                  {roles.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                </select>
                {editErrors.role && <p className="text-destructive text-sm mt-1">{editErrors.role}</p>}
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button type="submit">Update</Button>
              <DialogClose asChild><Button type="button" variant="outline">Batal</Button></DialogClose>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Reset Password ── */}
      <Dialog open={isResetOpen} onOpenChange={setIsResetOpen}>
        <DialogContent>
          <form onSubmit={submitReset}>
            <DialogHeader>
              <DialogTitle>Reset Password</DialogTitle>
              <DialogDescription>Set password baru untuk {resetTarget?.name}.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 mt-2">
              <div>
                <label className="block font-semibold mb-1">Password Baru</label>
                <input type="password" value={resetForm.password} onChange={(e) => setResetForm(f => ({ ...f, password: e.target.value }))} className="w-full px-3 py-2 border rounded-lg" required />
                {resetErrors.password && <p className="text-destructive text-sm mt-1">{resetErrors.password}</p>}
              </div>
              <div>
                <label className="block font-semibold mb-1">Konfirmasi Password</label>
                <input type="password" value={resetForm.password_confirmation} onChange={(e) => setResetForm(f => ({ ...f, password_confirmation: e.target.value }))} className="w-full px-3 py-2 border rounded-lg" required />
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button type="submit" variant="destructive">Reset Password</Button>
              <DialogClose asChild><Button type="button" variant="outline">Batal</Button></DialogClose>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Permissions Matrix ── */}
      <Dialog open={isPermOpen} onOpenChange={setIsPermOpen}>
        <DialogContent className="max-w-lg">
          <form onSubmit={submitPerms}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShieldCheck size={20} className="text-violet-600" />
                Hak Akses — {permTarget?.name}
              </DialogTitle>
              <DialogDescription>
                Pilih modul dan aksi yang diizinkan. "Tulis" dan "Hapus" otomatis mengaktifkan "Lihat".
              </DialogDescription>
            </DialogHeader>

            <div className="mt-3 rounded-lg border overflow-hidden">
              {/* Header row */}
              <div className="grid grid-cols-[1fr_auto_auto_auto_auto] bg-muted px-4 py-2 text-xs font-semibold text-muted-foreground gap-4 items-center">
                <span>Modul</span>
                {['view', 'write', 'delete'].map(a => (
                  <span key={a} className={`text-center w-12 ${actionColor[a]}`}>{actionLabel[a]}</span>
                ))}
                <span className="text-center w-12">Semua</span>
              </div>

              {Object.entries(modules).map(([mod, def], i) => {
                const p = permForm[mod] ?? { can_view: false, can_write: false, can_delete: false };
                const allOn = p.can_view && p.can_write && p.can_delete;
                return (
                  <div
                    key={mod}
                    className={`grid grid-cols-[1fr_auto_auto_auto_auto] px-4 py-3 gap-4 items-center ${i % 2 === 0 ? '' : 'bg-muted/30'}`}
                  >
                    <span className="text-sm font-medium">{def.label}</span>

                    {(['can_view', 'can_write', 'can_delete'] as const).map((action, ai) => {
                      const actionKey = ['view', 'write', 'delete'][ai];
                      const applicable = def.actions.includes(actionKey);
                      return (
                        <div key={action} className="flex justify-center w-12">
                          {applicable ? (
                            <input
                              type="checkbox"
                              checked={p[action]}
                              onChange={() => togglePerm(mod, action)}
                              className="w-4 h-4 accent-violet-600 cursor-pointer"
                            />
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </div>
                      );
                    })}

                    <div className="flex justify-center w-12">
                      <input
                        type="checkbox"
                        checked={allOn}
                        onChange={() => setAllForModule(mod, !allOn)}
                        className="w-4 h-4 accent-violet-600 cursor-pointer"
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <DialogFooter className="mt-4">
              <Button type="submit" disabled={permSaving}>
                {permSaving ? 'Menyimpan...' : 'Simpan Hak Akses'}
              </Button>
              <DialogClose asChild><Button type="button" variant="outline">Batal</Button></DialogClose>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
