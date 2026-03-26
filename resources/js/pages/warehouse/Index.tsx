import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Link, router, usePage } from '@inertiajs/react';
import { Plus, Pencil, Trash2, Eye, Warehouse, AlertTriangle, Package, TrendingDown } from 'lucide-react';
import { useState } from 'react';

interface WarehouseRow {
    id: string;
    code: string;
    name: string;
    location: string | null;
    description: string | null;
    phone: string | null;
    city: string | null;
    is_active: boolean;
    is_default: boolean;
    itemCount: number;
    totalStock: number;
    lowStockCount: number;
}

interface PageProps {
    warehouses: WarehouseRow[];
    flash?: { success?: string };
    errors?: Record<string, string>;
    [key: string]: unknown;
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Outlet', href: '/warehouses' },
];

export default function WarehouseIndex() {
    const { warehouses, flash, errors } = usePage<PageProps>().props;

    const [showAdd, setShowAdd] = useState(false);
    const [addForm, setAddForm] = useState({ code: '', name: '', location: '', description: '', phone: '', city: '' });
    const [addErrors, setAddErrors] = useState<Record<string, string>>({});

    const [editWh, setEditWh] = useState<WarehouseRow | null>(null);
    const [editForm, setEditForm] = useState({ name: '', location: '', description: '', phone: '', city: '', is_active: true });

    function submitAdd() {
        router.post(route('warehouses.store'), addForm, {
            onSuccess: () => { setShowAdd(false); setAddForm({ code: '', name: '', location: '', description: '', phone: '', city: '' }); },
            onError: (errs) => setAddErrors(errs),
        });
    }

    function openEdit(wh: WarehouseRow) {
        setEditWh(wh);
        setEditForm({
            name:        wh.name,
            location:    wh.location ?? '',
            description: wh.description ?? '',
            phone:       wh.phone ?? '',
            city:        wh.city ?? '',
            is_active:   wh.is_active,
        });
    }

    function submitEdit() {
        if (!editWh) return;
        router.put(route('warehouses.update', { warehouse: editWh.id }), editForm, {
            onSuccess: () => setEditWh(null),
        });
    }

    function handleDelete(wh: WarehouseRow) {
        const msg = wh.lowStockCount > 0 || wh.totalStock > 0
            ? `Outlet "${wh.name}" memiliki stok. Outlet akan dinonaktifkan. Lanjutkan?`
            : `Hapus outlet "${wh.name}"?`;
        if (!confirm(msg)) return;
        router.delete(route('warehouses.destroy', { warehouse: wh.id }));
    }

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <div className="p-6 space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-semibold">Manajemen Outlet</h1>
                        <p className="text-sm text-muted-foreground">Kelola outlet dan stok per lokasi</p>
                    </div>
                    <button
                        onClick={() => setShowAdd(true)}
                        className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                    >
                        <Plus className="h-4 w-4" /> Tambah Outlet
                    </button>
                </div>

                {/* Flash */}
                {flash?.success && (
                    <div className="rounded-md border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-800">
                        {flash.success}
                    </div>
                )}
                {errors?.general && (
                    <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
                        {errors.general}
                    </div>
                )}

                {/* Warehouse cards */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {warehouses.map((wh) => (
                        <div
                            key={wh.id}
                            className={`rounded-lg border bg-card p-5 shadow-sm space-y-4 ${!wh.is_active ? 'opacity-60' : ''}`}
                        >
                            {/* Card header */}
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <Warehouse className="h-4 w-4 text-muted-foreground shrink-0" />
                                        <span className="font-semibold truncate">{wh.name}</span>
                                        {wh.is_default && (
                                            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700 shrink-0">
                                                Utama
                                            </span>
                                        )}
                                        {!wh.is_active && (
                                            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500 shrink-0">
                                                Nonaktif
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <span className="text-xs font-mono text-muted-foreground">{wh.code}</span>
                                        {wh.location && (
                                            <span className="text-xs text-muted-foreground">· {wh.location}</span>
                                        )}
                                    </div>
                                    {(wh.city || wh.phone) && (
                                        <p className="text-xs text-muted-foreground">
                                            {[wh.city, wh.phone].filter(Boolean).join(' · ')}
                                        </p>
                                    )}
                                </div>
                                <div className="flex gap-1 shrink-0">
                                    <button
                                        onClick={() => openEdit(wh)}
                                        className="rounded p-1.5 hover:bg-accent"
                                        title="Edit"
                                    >
                                        <Pencil className="h-3.5 w-3.5" />
                                    </button>
                                    {!wh.is_default && (
                                        <button
                                            onClick={() => handleDelete(wh)}
                                            className="rounded p-1.5 hover:bg-accent text-destructive"
                                            title="Hapus / Nonaktifkan"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Stats */}
                            <div className="grid grid-cols-3 gap-2">
                                <div className="rounded-md bg-muted px-3 py-2 text-center">
                                    <div className="text-lg font-bold">{wh.itemCount}</div>
                                    <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                                        <Package className="h-3 w-3" /> Item
                                    </div>
                                </div>
                                <div className="rounded-md bg-muted px-3 py-2 text-center">
                                    <div className="text-lg font-bold">{wh.totalStock.toLocaleString()}</div>
                                    <div className="text-xs text-muted-foreground">Total Stok</div>
                                </div>
                                <div className={`rounded-md px-3 py-2 text-center ${wh.lowStockCount > 0 ? 'bg-red-50 dark:bg-red-950/30' : 'bg-muted'}`}>
                                    <div className={`text-lg font-bold ${wh.lowStockCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>
                                        {wh.lowStockCount}
                                    </div>
                                    <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                                        {wh.lowStockCount > 0
                                            ? <><AlertTriangle className="h-3 w-3 text-red-500" /> Stok Minim</>
                                            : <><TrendingDown className="h-3 w-3" /> Minim</>
                                        }
                                    </div>
                                </div>
                            </div>

                            {/* Description */}
                            {wh.description && (
                                <p className="text-xs text-muted-foreground line-clamp-2">{wh.description}</p>
                            )}

                            {/* View detail button */}
                            <Link
                                href={route('warehouses.show', { warehouse: wh.id })}
                                className="flex w-full items-center justify-center gap-1.5 rounded-md border px-3 py-1.5 text-xs hover:bg-accent transition-colors"
                            >
                                <Eye className="h-3.5 w-3.5" /> Lihat Detail
                            </Link>
                        </div>
                    ))}

                    {warehouses.length === 0 && (
                        <div className="col-span-full rounded-lg border bg-muted/30 p-10 text-center text-sm text-muted-foreground">
                            Belum ada outlet. Tambahkan outlet pertama Anda.
                        </div>
                    )}
                </div>
            </div>

            {/* ── Add Warehouse Modal ─────────────────────────────────────────── */}
            {showAdd && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="w-full max-w-md rounded-lg border bg-background p-6 shadow-lg space-y-4">
                        <h2 className="font-semibold text-lg">Tambah Outlet</h2>
                        <div className="space-y-3">
                            <div>
                                <label className="text-sm font-medium">Kode Outlet</label>
                                <input
                                    type="text"
                                    value={addForm.code}
                                    onChange={(e) => setAddForm((f) => ({ ...f, code: e.target.value.toUpperCase().replace(/[^A-Z0-9\-]/g, '') }))}
                                    placeholder="WH-02"
                                    className="mt-1 block w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                />
                                <p className="text-xs text-muted-foreground mt-0.5">Huruf kapital, angka, dan tanda minus saja</p>
                                {addErrors.code && <p className="text-xs text-destructive mt-1">{addErrors.code}</p>}
                            </div>
                            <div>
                                <label className="text-sm font-medium">Nama Outlet</label>
                                <input
                                    type="text"
                                    value={addForm.name}
                                    onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                                    placeholder="Outlet Selatan"
                                    className="mt-1 block w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                />
                                {addErrors.name && <p className="text-xs text-destructive mt-1">{addErrors.name}</p>}
                            </div>
                            <div>
                                <label className="text-sm font-medium">Lokasi (opsional)</label>
                                <input
                                    type="text"
                                    value={addForm.location}
                                    onChange={(e) => setAddForm((f) => ({ ...f, location: e.target.value }))}
                                    placeholder="Jl. Contoh No. 1, Jakarta"
                                    className="mt-1 block w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-sm font-medium">No. Telepon</label>
                                <input
                                    type="text"
                                    className="w-full border rounded-lg px-3 py-2 bg-background text-sm"
                                    placeholder="Contoh: 021-5551234"
                                    value={addForm.phone}
                                    onChange={e => setAddForm(f => ({ ...f, phone: e.target.value }))}
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-sm font-medium">Kota</label>
                                <input
                                    type="text"
                                    className="w-full border rounded-lg px-3 py-2 bg-background text-sm"
                                    placeholder="Contoh: Jakarta"
                                    value={addForm.city}
                                    onChange={e => setAddForm(f => ({ ...f, city: e.target.value }))}
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium">Deskripsi (opsional)</label>
                                <textarea
                                    value={addForm.description}
                                    onChange={(e) => setAddForm((f) => ({ ...f, description: e.target.value }))}
                                    placeholder="Keterangan gudang..."
                                    className="mt-1 block w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                    rows={2}
                                />
                            </div>
                        </div>
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setShowAdd(false)} className="rounded-md border px-3 py-2 text-sm hover:bg-accent">Batal</button>
                            <button onClick={submitAdd} className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground hover:bg-primary/90">Simpan</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Edit Warehouse Modal ────────────────────────────────────────── */}
            {editWh && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="w-full max-w-md rounded-lg border bg-background p-6 shadow-lg space-y-4">
                        <h2 className="font-semibold text-lg">Edit Outlet — {editWh.name}</h2>
                        <div className="space-y-3">
                            <div>
                                <label className="text-sm font-medium">Nama Outlet</label>
                                <input
                                    type="text"
                                    value={editForm.name}
                                    onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                                    className="mt-1 block w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium">Lokasi</label>
                                <input
                                    type="text"
                                    value={editForm.location}
                                    onChange={(e) => setEditForm((f) => ({ ...f, location: e.target.value }))}
                                    className="mt-1 block w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-sm font-medium">No. Telepon</label>
                                <input
                                    type="text"
                                    className="w-full border rounded-lg px-3 py-2 bg-background text-sm"
                                    placeholder="Contoh: 021-5551234"
                                    value={editForm.phone}
                                    onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))}
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-sm font-medium">Kota</label>
                                <input
                                    type="text"
                                    className="w-full border rounded-lg px-3 py-2 bg-background text-sm"
                                    placeholder="Contoh: Jakarta"
                                    value={editForm.city}
                                    onChange={e => setEditForm(f => ({ ...f, city: e.target.value }))}
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium">Deskripsi</label>
                                <textarea
                                    value={editForm.description}
                                    onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                                    className="mt-1 block w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                    rows={2}
                                />
                            </div>
                            {!editWh.is_default && (
                                <label className="flex items-center gap-2 text-sm">
                                    <input
                                        type="checkbox"
                                        checked={editForm.is_active}
                                        onChange={(e) => setEditForm((f) => ({ ...f, is_active: e.target.checked }))}
                                        className="h-4 w-4 rounded"
                                    />
                                    Outlet aktif
                                </label>
                            )}
                        </div>
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setEditWh(null)} className="rounded-md border px-3 py-2 text-sm hover:bg-accent">Batal</button>
                            <button onClick={submitEdit} className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground hover:bg-primary/90">Simpan</button>
                        </div>
                    </div>
                </div>
            )}
        </AppLayout>
    );
}
