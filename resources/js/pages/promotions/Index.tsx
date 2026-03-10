import { useState } from 'react';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router, useForm, usePage } from '@inertiajs/react';
import { Plus, Search, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Dialog, DialogContent, DialogHeader,
    DialogTitle, DialogFooter,
} from '@/components/ui/dialog';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Promo', href: '/promotions' },
];

interface Promotion {
    id: number;
    name: string;
    code: string | null;
    type: 'percentage' | 'fixed';
    value: number;
    applies_to: 'all' | 'category' | 'item';
    applies_id: number | null;
    min_purchase: number;
    max_discount: number;
    start_date: string;
    end_date: string;
    is_active: boolean;
}

interface CategoryOption { id: number; nama: string; }
interface ItemOption     { id: number; nama: string; }

interface PageProps {
    promotions: { data: Promotion[]; current_page: number; last_page: number; total: number };
    categories: CategoryOption[];
    items: ItemOption[];
    filters: { search?: string };
    [key: string]: unknown;
}

const today = new Date().toISOString().split('T')[0];

const emptyForm = {
    name: '', code: '', type: 'percentage' as 'percentage' | 'fixed',
    value: '', applies_to: 'all' as 'all' | 'category' | 'item',
    applies_id: '', min_purchase: '0', max_discount: '0',
    start_date: today, end_date: today, is_active: true,
};

function formatRp(n: number) { return 'Rp ' + n.toLocaleString('id-ID'); }

const STATUS: Record<string, string> = {
    active:   'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    inactive: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
};

const TYPE_LABEL: Record<string, string> = {
    percentage: 'Persentase (%)',
    fixed:      'Nominal (Rp)',
};

const APPLIES_LABEL: Record<string, string> = {
    all:      'Semua Produk',
    category: 'Kategori',
    item:     'Produk Tertentu',
};

export default function PromotionsIndex() {
    const { promotions, categories, items, filters } = usePage<PageProps>().props;

    const [search, setSearch] = useState(filters?.search ?? '');
    const [openCreate, setOpenCreate] = useState(false);
    const [openEdit, setOpenEdit]     = useState(false);
    const [editTarget, setEditTarget] = useState<Promotion | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<Promotion | null>(null);

    const navigate = (overrides: Record<string, unknown> = {}) => {
        router.get(route('promotions.index'), { search, ...overrides }, { preserveState: true, replace: true });
    };

    // Create form
    const createForm = useForm({ ...emptyForm });
    const submitCreate = (e: React.FormEvent) => {
        e.preventDefault();
        createForm.post(route('promotions.store'), {
            onSuccess: () => { setOpenCreate(false); createForm.reset(); },
        });
    };

    // Edit form
    const editForm = useForm({ ...emptyForm });
    const openEditDialog = (promo: Promotion) => {
        setEditTarget(promo);
        editForm.setData({
            name: promo.name, code: promo.code ?? '',
            type: promo.type, value: String(promo.value),
            applies_to: promo.applies_to, applies_id: String(promo.applies_id ?? ''),
            min_purchase: String(promo.min_purchase), max_discount: String(promo.max_discount),
            start_date: promo.start_date, end_date: promo.end_date,
            is_active: promo.is_active,
        });
        setOpenEdit(true);
    };
    const submitEdit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!editTarget) return;
        editForm.put(route('promotions.update', editTarget.id), {
            onSuccess: () => { setOpenEdit(false); setEditTarget(null); },
        });
    };

    const confirmDelete = () => {
        if (!deleteTarget) return;
        router.delete(route('promotions.destroy', deleteTarget.id), {
            onSuccess: () => setDeleteTarget(null),
        });
    };

    const safePromos = promotions ?? { data: [], current_page: 1, last_page: 1, total: 0 };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Promo & Diskon" />
            <div className="flex flex-col gap-4 p-4">

                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold">Promo & Diskon</h1>
                        <p className="text-sm text-muted-foreground mt-0.5">Kelola aturan diskon dan promo aktif</p>
                    </div>
                    <Button className="gap-2" onClick={() => setOpenCreate(true)}>
                        <Plus size={16} />
                        Tambah Promo
                    </Button>
                </div>

                {/* Search */}
                <div className="relative max-w-sm">
                    <Search size={16} className="absolute left-3 top-2.5 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Cari nama atau kode promo..."
                        className="pl-9 pr-3 py-2 border rounded-md text-sm w-full bg-background"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && navigate({ search, page: 1 })}
                    />
                </div>

                {/* Table */}
                <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
                    <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                            <tr>
                                <th className="text-left px-4 py-2.5 font-medium text-xs">Nama Promo</th>
                                <th className="text-left px-4 py-2.5 font-medium text-xs">Kode</th>
                                <th className="text-left px-4 py-2.5 font-medium text-xs">Tipe</th>
                                <th className="text-left px-4 py-2.5 font-medium text-xs">Nilai</th>
                                <th className="text-left px-4 py-2.5 font-medium text-xs">Berlaku Untuk</th>
                                <th className="text-left px-4 py-2.5 font-medium text-xs">Periode</th>
                                <th className="text-center px-4 py-2.5 font-medium text-xs">Status</th>
                                <th className="text-center px-4 py-2.5 font-medium text-xs">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {safePromos.data.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="text-center py-12 text-muted-foreground text-xs">
                                        Belum ada promo. Klik "Tambah Promo" untuk membuat promo baru.
                                    </td>
                                </tr>
                            ) : safePromos.data.map(p => (
                                <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                                    <td className="px-4 py-2.5 font-medium text-xs">{p.name}</td>
                                    <td className="px-4 py-2.5 text-xs font-mono text-muted-foreground">{p.code ?? '-'}</td>
                                    <td className="px-4 py-2.5 text-xs">{TYPE_LABEL[p.type]}</td>
                                    <td className="px-4 py-2.5 text-xs font-semibold">
                                        {p.type === 'percentage' ? `${p.value}%` : formatRp(p.value)}
                                    </td>
                                    <td className="px-4 py-2.5 text-xs">{APPLIES_LABEL[p.applies_to]}</td>
                                    <td className="px-4 py-2.5 text-xs text-muted-foreground">
                                        {p.start_date} s/d {p.end_date}
                                    </td>
                                    <td className="px-4 py-2.5 text-center">
                                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${p.is_active ? STATUS.active : STATUS.inactive}`}>
                                            {p.is_active ? 'Aktif' : 'Nonaktif'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-2.5">
                                        <div className="flex items-center justify-center gap-1">
                                            <button onClick={() => openEditDialog(p)}
                                                className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                                                <Pencil size={14} />
                                            </button>
                                            <button onClick={() => setDeleteTarget(p)}
                                                className="p-1.5 rounded hover:bg-rose-50 text-muted-foreground hover:text-rose-600 transition-colors dark:hover:bg-rose-950/30">
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {safePromos.last_page > 1 && (
                    <div className="flex justify-center gap-2">
                        {Array.from({ length: safePromos.last_page }).map((_, i) => (
                            <button key={i} onClick={() => navigate({ page: i + 1 })}
                                className={`px-3 py-1 rounded border text-xs ${safePromos.current_page === i + 1 ? 'bg-primary text-white' : 'bg-muted'}`}>
                                {i + 1}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* ── Create Dialog ── */}
            <Dialog open={openCreate} onOpenChange={setOpenCreate}>
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Tambah Promo Baru</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={submitCreate} className="space-y-3 mt-2">
                        <PromoForm form={createForm} categories={categories} items={items} />
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setOpenCreate(false)}>Batal</Button>
                            <Button type="submit" disabled={createForm.processing}>Simpan</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* ── Edit Dialog ── */}
            <Dialog open={openEdit} onOpenChange={setOpenEdit}>
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Edit Promo</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={submitEdit} className="space-y-3 mt-2">
                        <PromoForm form={editForm} categories={categories} items={items} />
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setOpenEdit(false)}>Batal</Button>
                            <Button type="submit" disabled={editForm.processing}>Simpan</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* ── Delete Confirm ── */}
            <Dialog open={!!deleteTarget} onOpenChange={v => !v && setDeleteTarget(null)}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Hapus Promo?</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground">
                        Promo <span className="font-semibold text-foreground">"{deleteTarget?.name}"</span> akan dihapus permanen.
                    </p>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteTarget(null)}>Batal</Button>
                        <Button variant="destructive" onClick={confirmDelete}>Hapus</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}

// ── Shared form fields ──────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function PromoForm({ form, categories, items }: {
    form: any;
    categories: { id: number; nama: string }[];
    items: { id: number; nama: string }[];
}) {
    return (
        <>
            <Field label="Nama Promo *">
                <input className={input} value={form.data.name as string}
                    onChange={e => form.setData('name', e.target.value)} required />
                {form.errors.name && <Err>{form.errors.name}</Err>}
            </Field>

            <Field label="Kode Promo (opsional)">
                <input className={input} value={form.data.code as string}
                    placeholder="contoh: DISKON10"
                    onChange={e => form.setData('code', e.target.value.toUpperCase())} />
                {form.errors.code && <Err>{form.errors.code}</Err>}
            </Field>

            <div className="grid grid-cols-2 gap-3">
                <Field label="Tipe Diskon">
                    <select className={input} value={form.data.type as string}
                        onChange={e => form.setData('type', e.target.value)}>
                        <option value="percentage">Persentase (%)</option>
                        <option value="fixed">Nominal (Rp)</option>
                    </select>
                </Field>
                <Field label={form.data.type === 'percentage' ? 'Nilai (%)' : 'Nilai (Rp)'}>
                    <input className={input} type="number" min={1}
                        value={form.data.value as string}
                        onChange={e => form.setData('value', e.target.value)} required />
                    {form.errors.value && <Err>{form.errors.value}</Err>}
                </Field>
            </div>

            <Field label="Berlaku Untuk">
                <select className={input} value={form.data.applies_to as string}
                    onChange={e => { form.setData('applies_to', e.target.value); form.setData('applies_id', ''); }}>
                    <option value="all">Semua Produk</option>
                    <option value="category">Kategori Tertentu</option>
                    <option value="item">Produk Tertentu</option>
                </select>
            </Field>

            {form.data.applies_to === 'category' && (
                <Field label="Pilih Kategori">
                    <select className={input} value={form.data.applies_id as string}
                        onChange={e => form.setData('applies_id', e.target.value)}>
                        <option value="">-- Pilih --</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.nama}</option>)}
                    </select>
                </Field>
            )}

            {form.data.applies_to === 'item' && (
                <Field label="Pilih Produk">
                    <select className={input} value={form.data.applies_id as string}
                        onChange={e => form.setData('applies_id', e.target.value)}>
                        <option value="">-- Pilih --</option>
                        {items.map(i => <option key={i.id} value={i.id}>{i.nama}</option>)}
                    </select>
                </Field>
            )}

            <div className="grid grid-cols-2 gap-3">
                <Field label="Min. Pembelian (Rp)">
                    <input className={input} type="number" min={0}
                        value={form.data.min_purchase as string}
                        onChange={e => form.setData('min_purchase', e.target.value)} />
                </Field>
                <Field label="Maks. Diskon (Rp, 0=∞)">
                    <input className={input} type="number" min={0}
                        value={form.data.max_discount as string}
                        onChange={e => form.setData('max_discount', e.target.value)} />
                </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <Field label="Tanggal Mulai">
                    <input className={input} type="date"
                        value={form.data.start_date as string}
                        onChange={e => form.setData('start_date', e.target.value)} required />
                </Field>
                <Field label="Tanggal Berakhir">
                    <input className={input} type="date"
                        value={form.data.end_date as string}
                        onChange={e => form.setData('end_date', e.target.value)} required />
                </Field>
            </div>

            <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox"
                    checked={form.data.is_active as boolean}
                    onChange={e => form.setData('is_active', e.target.checked)}
                    className="rounded" />
                Aktifkan promo ini
            </label>
        </>
    );
}

const input = 'w-full border rounded-md px-3 py-2 text-sm bg-background';
const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted-foreground">{label}</label>
        {children}
    </div>
);
const Err = ({ children }: { children: React.ReactNode }) => (
    <p className="text-xs text-rose-600">{children}</p>
);
