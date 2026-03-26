/**
 * Shared component for Customers and Suppliers index pages.
 * Used by resources/js/pages/customers/Index.tsx and supplier/Index.tsx.
 */
import { useEffect, useState } from 'react';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import { Search, Plus, Pencil, Trash2, Eye, Download, Phone, Mail, MapPin, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
    DialogDescription, DialogFooter, DialogClose,
} from '@/components/ui/dialog';
import Pagination, { type PaginationMeta } from '@/components/Pagination';

export interface ContactRow {
    id: string;
    name: string;
    code: string | null;
    contactPerson?: string | null;
    phone: string | null;
    email: string | null;
    address: string | null;
    city: string | null;
    notes: string | null;
    isActive: boolean;
    createdAt: string | null;
}

interface PaginatedContacts {
    data: ContactRow[];
    current_page: number; last_page: number;
    per_page: number; total: number;
    from: number | null; to: number | null;
}

interface Filters {
    search?: string; sort_by?: string; sort_dir?: string;
    per_page?: string | number; status?: string;
}

export interface ContactsPageConfig {
    entitySingular: string;
    entityKey: string;
    dataKey: string;
    routePrefix: string;
    breadcrumbs: BreadcrumbItem[];
    headTitle: string;
    pageHeading: string;
    pageSubheading: string;
    searchPlaceholder: string;
    EmptyIcon: React.ElementType;
    emptyMessage: string;
    emptySubMessage: string;
    ViewIcon: React.ElementType;
    hasContactPerson: boolean;
    showDetailRoute?: string;
    csvFilename: string;
    activeLabel: string;
    nameLabel: string;
    namePlaceholder: string;
    codePlaceholder: string;
    summaryLabel: string;
}

const emptyBaseForm = {
    name: '', code: '', contact_person: '',
    phone: '', email: '', address: '', city: '', notes: '', is_active: true,
};

export default function ContactsPage({ config }: { config: ContactsPageConfig }) {
    const pageProps = usePage<{ [key: string]: unknown; filters: Filters }>().props;
    const contacts = pageProps[config.dataKey] as PaginatedContacts;
    const filters = pageProps.filters as Filters;

    const [search, setSearch]   = useState(filters.search ?? '');
    const [sortBy, setSortBy]   = useState(filters.sort_by ?? 'name');
    const [sortDir, setSortDir] = useState(filters.sort_dir ?? 'asc');
    const [perPage, setPerPage] = useState(String(filters.per_page ?? '20'));
    const [status, setStatus]   = useState(filters.status ?? 'all');

    const [showForm, setShowForm]         = useState(false);
    const [editTarget, setEditTarget]     = useState<ContactRow | null>(null);
    const [form, setForm]                 = useState({ ...emptyBaseForm });
    const [errors, setErrors]             = useState<Record<string, string>>({});
    const [submitting, setSubmitting]     = useState(false);

    const [viewTarget, setViewTarget]     = useState<ContactRow | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<ContactRow | null>(null);
    const [deleting, setDeleting]         = useState(false);

    useEffect(() => {
        setSearch(filters.search ?? '');
        setSortBy(filters.sort_by ?? 'name');
        setSortDir(filters.sort_dir ?? 'asc');
        setPerPage(String(filters.per_page ?? '20'));
        setStatus(filters.status ?? 'all');
    }, [filters]);

    const navigate = (overrides: Partial<Filters & { page?: number }> = {}) => {
        router.get(
            route(`${config.routePrefix}.index`),
            { search, sort_by: sortBy, sort_dir: sortDir, per_page: perPage, status, ...overrides },
            { preserveState: true, replace: true },
        );
    };

    const handleSort = (col: string) => {
        const newDir = col === sortBy && sortDir === 'asc' ? 'desc' : 'asc';
        setSortBy(col); setSortDir(newDir);
        navigate({ sort_by: col, sort_dir: newDir, page: 1 });
    };

    const SortIcon = ({ col }: { col: string }) =>
        col !== sortBy
            ? <span className="opacity-30 ml-1">↕</span>
            : <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>;

    const openAdd = () => {
        setEditTarget(null); setForm({ ...emptyBaseForm }); setErrors({}); setShowForm(true);
    };

    const openEdit = (c: ContactRow) => {
        setEditTarget(c);
        setForm({
            name: c.name, code: c.code ?? '', contact_person: c.contactPerson ?? '',
            phone: c.phone ?? '', email: c.email ?? '', address: c.address ?? '',
            city: c.city ?? '', notes: c.notes ?? '', is_active: c.isActive,
        });
        setErrors({}); setShowForm(true);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        const payload = { ...form, is_active: form.is_active ? 1 : 0 };
        const opts = {
            onSuccess: () => { setShowForm(false); setSubmitting(false); },
            onError: (errs: Record<string, string>) => { setErrors(errs); setSubmitting(false); },
        };
        if (editTarget) router.put(route(`${config.routePrefix}.update`, { [config.entityKey]: editTarget.id }), payload, opts);
        else router.post(route(`${config.routePrefix}.store`), payload, opts);
    };

    const handleDelete = () => {
        if (!deleteTarget) return;
        setDeleting(true);
        router.delete(route(`${config.routePrefix}.destroy`, { [config.entityKey]: deleteTarget.id }), {
            onSuccess: () => { setDeleteTarget(null); setDeleting(false); },
            onError: () => setDeleting(false),
        });
    };

    const exportCSV = () => {
        const headers = config.hasContactPerson
            ? ['Nama', 'Kode', 'Kontak', 'Telepon', 'Email', 'Kota', 'Status']
            : ['Nama', 'Kode', 'Telepon', 'Email', 'Kota', 'Status'];
        const rows = contacts.data.map(c => config.hasContactPerson
            ? [c.name, c.code ?? '', c.contactPerson ?? '', c.phone ?? '', c.email ?? '', c.city ?? '', c.isActive ? 'Aktif' : 'Nonaktif']
            : [c.name, c.code ?? '', c.phone ?? '', c.email ?? '', c.city ?? '', c.isActive ? 'Aktif' : 'Nonaktif']
        );
        const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `${config.csvFilename}.csv`; a.click();
        URL.revokeObjectURL(url);
    };

    const meta: PaginationMeta = {
        current_page: contacts.current_page, last_page: contacts.last_page,
        per_page: contacts.per_page, total: contacts.total,
        from: contacts.from, to: contacts.to,
    };

    const inputCls = (field: string) =>
        `w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary ${errors[field] ? 'border-red-400' : 'border-border'}`;

    const { EmptyIcon, ViewIcon } = config;

    return (
        <AppLayout breadcrumbs={config.breadcrumbs}>
            <Head title={config.headTitle} />
            <div className="p-4 md:p-6 space-y-4">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                        <h1 className="text-xl font-semibold">{config.pageHeading}</h1>
                        <p className="text-sm text-muted-foreground mt-0.5">{config.pageSubheading}</p>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={exportCSV}><Download size={15} className="mr-1" /> Ekspor CSV</Button>
                        <Button size="sm" onClick={openAdd}><Plus size={15} className="mr-1" /> Tambah {config.entitySingular}</Button>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-2">
                    <form onSubmit={e => { e.preventDefault(); navigate({ page: 1 }); }} className="flex gap-2 flex-1">
                        <div className="relative flex-1">
                            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <input type="text" placeholder={config.searchPlaceholder}
                                className="pl-8 pr-3 py-2 text-sm border border-border rounded w-full focus:outline-none focus:ring-2 focus:ring-primary"
                                value={search} onChange={e => setSearch(e.target.value)} />
                        </div>
                        <Button type="submit" size="sm" variant="outline">Cari</Button>
                    </form>
                    <select className="text-sm border border-border rounded px-2 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                        value={status} onChange={e => { setStatus(e.target.value); navigate({ status: e.target.value, page: 1 }); }}>
                        <option value="all">Semua Status</option>
                        <option value="active">Aktif</option>
                        <option value="inactive">Nonaktif</option>
                    </select>
                    <select className="text-sm border border-border rounded px-2 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                        value={perPage} onChange={e => { setPerPage(e.target.value); navigate({ per_page: e.target.value, page: 1 }); }}>
                        {['10', '20', '50', '100'].map(n => <option key={n} value={n}>{n} / halaman</option>)}
                    </select>
                </div>

                {/* Table */}
                <div className="rounded-lg border overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-muted/50 border-b">
                            <tr>
                                <th className="text-left px-4 py-3 font-medium cursor-pointer select-none" onClick={() => handleSort('name')}>
                                    Nama {config.entitySingular} <SortIcon col="name" />
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
                            {contacts.data.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="py-16 text-center">
                                        <div className="flex flex-col items-center gap-3 text-muted-foreground">
                                            <EmptyIcon className="h-10 w-10 opacity-40" />
                                            <div>
                                                <p className="font-medium text-foreground">{config.emptyMessage}</p>
                                                <p className="text-sm mt-1">{config.emptySubMessage}</p>
                                            </div>
                                            <button onClick={openAdd}
                                                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition">
                                                <Plus size={15} /> Tambah {config.entitySingular}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ) : contacts.data.map(c => (
                                <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                                    <td className="px-4 py-3">
                                        <div className="font-medium">{c.name}</div>
                                        {config.hasContactPerson && c.contactPerson && (
                                            <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                                <User size={11} /> {c.contactPerson}
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-4 py-3">
                                        {c.code
                                            ? <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{c.code}</span>
                                            : <span className="text-muted-foreground">—</span>}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="space-y-0.5">
                                            {c.phone && <div className="flex items-center gap-1 text-xs text-muted-foreground"><Phone size={11} /> {c.phone}</div>}
                                            {c.email && <div className="flex items-center gap-1 text-xs text-muted-foreground"><Mail size={11} /> {c.email}</div>}
                                            {!c.phone && !c.email && <span className="text-muted-foreground">—</span>}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        {c.city
                                            ? <div className="flex items-center gap-1 text-sm"><MapPin size={12} className="text-muted-foreground" /> {c.city}</div>
                                            : <span className="text-muted-foreground">—</span>}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${c.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                                            {c.isActive ? 'Aktif' : 'Nonaktif'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center justify-end gap-1">
                                            <button className="p-1.5 rounded hover:bg-sky-100 text-sky-600 transition-colors" title="Lihat detail" onClick={() => setViewTarget(c)}>
                                                <Eye size={15} />
                                            </button>
                                            {config.showDetailRoute && (
                                                <a href={route(config.showDetailRoute, { [config.entityKey]: c.id })}
                                                    className="p-1.5 rounded hover:bg-indigo-100 text-indigo-600 transition-colors" title="Lihat cicilan">
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="5" rx="2" /><line x1="2" x2="22" y1="10" y2="10" /></svg>
                                                </a>
                                            )}
                                            <button className="p-1.5 rounded hover:bg-amber-100 text-amber-600 transition-colors" title="Edit" onClick={() => openEdit(c)}>
                                                <Pencil size={15} />
                                            </button>
                                            <button className="p-1.5 rounded hover:bg-red-100 text-red-600 transition-colors" title="Hapus" onClick={() => setDeleteTarget(c)}>
                                                <Trash2 size={15} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <Pagination meta={meta} onPageChange={page => navigate({ page })}
                    summary={<span>Total: <span className="font-medium text-foreground">{contacts.total}</span> {config.summaryLabel}</span>} />
            </div>

            {/* Add / Edit Dialog */}
            <Dialog open={showForm} onOpenChange={open => { if (!open) setShowForm(false); }}>
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editTarget ? `Edit ${config.entitySingular}` : `Tambah ${config.entitySingular} Baru`}</DialogTitle>
                        <DialogDescription>{editTarget ? `Memperbarui data "${editTarget.name}"` : `Isi informasi ${config.entitySingular.toLowerCase()} baru`}</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4 mt-2">
                        <div>
                            <label className="block text-sm font-medium mb-1">{config.nameLabel} <span className="text-red-500">*</span></label>
                            <input type="text" className={inputCls('name')} value={form.name}
                                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder={config.namePlaceholder} />
                            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Kode</label>
                            <input type="text" className={inputCls('code')} value={form.code}
                                onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder={config.codePlaceholder} />
                            {errors.code && <p className="text-red-500 text-xs mt-1">{errors.code}</p>}
                        </div>
                        {config.hasContactPerson && (
                            <div>
                                <label className="block text-sm font-medium mb-1">Nama Kontak</label>
                                <input type="text" className={inputCls('contact_person')} value={form.contact_person}
                                    onChange={e => setForm(f => ({ ...f, contact_person: e.target.value }))} placeholder="PIC / nama kontak" />
                                {errors.contact_person && <p className="text-red-500 text-xs mt-1">{errors.contact_person}</p>}
                            </div>
                        )}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-sm font-medium mb-1">Telepon</label>
                                <input type="text" className={inputCls('phone')} value={form.phone}
                                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="0812…" />
                                {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Email</label>
                                <input type="email" className={inputCls('email')} value={form.email}
                                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="email@contoh.com" />
                                {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Kota</label>
                            <input type="text" className={inputCls('city')} value={form.city}
                                onChange={e => setForm(f => ({ ...f, city: e.target.value }))} placeholder="Jakarta, Surabaya, dll." />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Alamat</label>
                            <textarea rows={2} className={inputCls('address')} value={form.address}
                                onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Jl. …" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Catatan</label>
                            <textarea rows={2} className={inputCls('notes')} value={form.notes}
                                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
                        </div>
                        <div className="flex items-center gap-2">
                            <input type="checkbox" id="contact_active" checked={form.is_active}
                                onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} className="w-4 h-4 accent-primary" />
                            <label htmlFor="contact_active" className="text-sm">{config.activeLabel}</label>
                        </div>
                        <DialogFooter className="pt-2">
                            <DialogClose asChild><Button type="button" variant="outline" disabled={submitting}>Batal</Button></DialogClose>
                            <Button type="submit" disabled={submitting}>
                                {submitting ? 'Menyimpan…' : (editTarget ? 'Simpan Perubahan' : `Tambah ${config.entitySingular}`)}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* View Dialog */}
            <Dialog open={!!viewTarget} onOpenChange={open => { if (!open) setViewTarget(null); }}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2"><ViewIcon size={18} /> {viewTarget?.name}</DialogTitle>
                    </DialogHeader>
                    {viewTarget && (
                        <div className="space-y-3 text-sm">
                            {viewTarget.code && <div className="flex gap-2"><span className="text-muted-foreground w-24 shrink-0">Kode</span><span className="font-mono bg-muted px-1.5 py-0.5 rounded text-xs">{viewTarget.code}</span></div>}
                            {config.hasContactPerson && viewTarget.contactPerson && (
                                <div className="flex gap-2"><span className="text-muted-foreground w-24 shrink-0">Kontak</span><span>{viewTarget.contactPerson}</span></div>
                            )}
                            {viewTarget.phone && <div className="flex gap-2"><span className="text-muted-foreground w-24 shrink-0">Telepon</span><span>{viewTarget.phone}</span></div>}
                            {viewTarget.email && <div className="flex gap-2"><span className="text-muted-foreground w-24 shrink-0">Email</span><span>{viewTarget.email}</span></div>}
                            {viewTarget.city && <div className="flex gap-2"><span className="text-muted-foreground w-24 shrink-0">Kota</span><span>{viewTarget.city}</span></div>}
                            {viewTarget.address && <div className="flex gap-2"><span className="text-muted-foreground w-24 shrink-0">Alamat</span><span className="leading-relaxed">{viewTarget.address}</span></div>}
                            {viewTarget.notes && <div className="flex gap-2"><span className="text-muted-foreground w-24 shrink-0">Catatan</span><span className="leading-relaxed">{viewTarget.notes}</span></div>}
                            <div className="flex gap-2"><span className="text-muted-foreground w-24 shrink-0">Status</span>
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${viewTarget.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                                    {viewTarget.isActive ? 'Aktif' : 'Nonaktif'}
                                </span>
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <DialogClose asChild><Button variant="outline">Tutup</Button></DialogClose>
                        {viewTarget && <Button onClick={() => { openEdit(viewTarget); setViewTarget(null); }}><Pencil size={14} className="mr-1" /> Edit</Button>}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirm */}
            <Dialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Hapus {config.entitySingular}</DialogTitle>
                        <DialogDescription>Yakin ingin menghapus <span className="font-semibold text-foreground">"{deleteTarget?.name}"</span>? Tindakan ini tidak dapat dibatalkan.</DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="mt-2">
                        <DialogClose asChild><Button variant="outline" disabled={deleting}>Batal</Button></DialogClose>
                        <Button variant="destructive" disabled={deleting} onClick={handleDelete}>
                            {deleting ? 'Menghapus…' : 'Ya, Hapus'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
