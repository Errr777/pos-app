import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { router, usePage } from '@inertiajs/react';
import { Plus, Pencil, Trash2, ShieldCheck, ShieldOff } from 'lucide-react';
import { useState } from 'react';

interface ModuleDef {
    label: string;
    actions: string[];
}

interface ModulePermission {
    can_view: boolean;
    can_write: boolean;
    can_delete: boolean;
}

interface RoleRow {
    id: string;
    name: string;
    label: string;
    is_system: boolean;
    permissions: Record<string, ModulePermission>;
}

interface PageProps {
    roles: RoleRow[];
    modules: Record<string, ModuleDef>;
    flash?: { success?: string };
    errors?: Record<string, string>;
    [key: string]: unknown;
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Pengguna', href: '/users' },
    { title: 'Role & Akses', href: '/users/roles' },
];

function defaultPerms(modules: Record<string, ModuleDef>): Record<string, ModulePermission> {
    return Object.fromEntries(
        Object.keys(modules).map((k) => [k, { can_view: false, can_write: false, can_delete: false }]),
    );
}

export default function Roles() {
    const { roles, modules, flash, errors } = usePage<PageProps>().props;

    // Add Role modal
    const [showAdd, setShowAdd] = useState(false);
    const [addForm, setAddForm] = useState({ name: '', label: '' });

    // Edit Role label modal
    const [editRole, setEditRole] = useState<RoleRow | null>(null);
    const [editLabel, setEditLabel] = useState('');

    // Permission modal
    const [permRole, setPermRole] = useState<RoleRow | null>(null);
    const [permForm, setPermForm] = useState<Record<string, ModulePermission>>({});

    // ── helpers ──────────────────────────────────────────────────────────────

    function openPermModal(role: RoleRow) {
        setPermRole(role);
        setPermForm(JSON.parse(JSON.stringify(role.permissions)));
    }

    function setPermValue(module: string, action: keyof ModulePermission, val: boolean) {
        setPermForm((prev) => {
            const next = { ...prev, [module]: { ...prev[module], [action]: val } };
            // enabling write/delete forces view true
            if ((action === 'can_write' || action === 'can_delete') && val) {
                next[module].can_view = true;
            }
            // disabling view forces write+delete false
            if (action === 'can_view' && !val) {
                next[module].can_write = false;
                next[module].can_delete = false;
            }
            return next;
        });
    }

    function toggleAll(module: string, checked: boolean) {
        const modDef = modules[module];
        setPermForm((prev) => ({
            ...prev,
            [module]: {
                can_view:   checked && modDef.actions.includes('view'),
                can_write:  checked && modDef.actions.includes('write'),
                can_delete: checked && modDef.actions.includes('delete'),
            },
        }));
    }

    function isAllChecked(module: string): boolean {
        const modDef = modules[module];
        const p = permForm[module];
        if (!p) return false;
        return modDef.actions.every((a) => {
            if (a === 'view')   return p.can_view;
            if (a === 'write')  return p.can_write;
            if (a === 'delete') return p.can_delete;
            return false;
        });
    }

    // ── submit handlers ───────────────────────────────────────────────────────

    function submitAdd() {
        router.post(route('roles.store'), addForm, {
            onSuccess: () => { setShowAdd(false); setAddForm({ name: '', label: '' }); },
        });
    }

    function submitEdit() {
        if (!editRole) return;
        router.put(route('roles.update', { role: editRole.id }), { label: editLabel }, {
            onSuccess: () => setEditRole(null),
        });
    }

    function submitPerms() {
        if (!permRole) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        router.post(route('roles.permissions', { role: permRole.id }), { permissions: permForm as any }, {
            onSuccess: () => setPermRole(null),
        });
    }

    function deleteRole(role: RoleRow) {
        if (!confirm(`Hapus role "${role.label}"?`)) return;
        router.delete(route('roles.destroy', { role: role.id }));
    }

    // ── render ────────────────────────────────────────────────────────────────

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <div className="p-6 space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-semibold">Role & Akses</h1>
                        <p className="text-sm text-muted-foreground">Kelola role dan hak akses per modul</p>
                    </div>
                    <button
                        onClick={() => setShowAdd(true)}
                        className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                    >
                        <Plus className="h-4 w-4" /> Tambah Role
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

                {/* Role cards */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {roles.map((role) => {
                        const visibleCount = Object.values(role.permissions).filter((p) => p.can_view).length;
                        const writeCount   = Object.values(role.permissions).filter((p) => p.can_write).length;
                        return (
                            <div key={role.id} className="rounded-lg border bg-card p-4 shadow-sm space-y-3">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold">{role.label}</span>
                                            {role.is_system && (
                                                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
                                                    Sistem
                                                </span>
                                            )}
                                        </div>
                                        <span className="text-xs text-muted-foreground font-mono">{role.name}</span>
                                    </div>
                                    <div className="flex gap-1">
                                        {!role.is_system && (
                                            <>
                                                <button
                                                    onClick={() => { setEditRole(role); setEditLabel(role.label); }}
                                                    className="rounded p-1.5 hover:bg-accent"
                                                    title="Edit label"
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </button>
                                                <button
                                                    onClick={() => deleteRole(role)}
                                                    className="rounded p-1.5 hover:bg-accent text-destructive"
                                                    title="Hapus role"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Permission summary */}
                                {role.name === 'admin' ? (
                                    <div className="flex items-center gap-1.5 text-sm text-emerald-700">
                                        <ShieldCheck className="h-4 w-4" />
                                        Semua akses (bypass)
                                    </div>
                                ) : (
                                    <div className="text-xs text-muted-foreground">
                                        Lihat {visibleCount}/{Object.keys(modules).length} modul · Tulis {writeCount} modul
                                    </div>
                                )}

                                {/* Module permission badges */}
                                {role.name !== 'admin' && (
                                    <div className="space-y-1">
                                        {Object.entries(modules).map(([key, modDef]) => {
                                            const p = role.permissions[key];
                                            return (
                                                <div key={key} className="flex items-center justify-between text-xs">
                                                    <span className="text-muted-foreground">{modDef.label}</span>
                                                    <div className="flex gap-1">
                                                        {p?.can_view   ? <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-700">Lihat</span>   : <span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground line-through">Lihat</span>}
                                                        {modDef.actions.includes('write')  && (p?.can_write  ? <span className="rounded bg-blue-100 px-1.5 py-0.5 text-blue-700">Tulis</span>  : <span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground line-through">Tulis</span>)}
                                                        {modDef.actions.includes('delete') && (p?.can_delete ? <span className="rounded bg-red-100 px-1.5 py-0.5 text-red-700">Hapus</span>  : <span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground line-through">Hapus</span>)}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* Edit permissions button */}
                                {role.name !== 'admin' && (
                                    <button
                                        onClick={() => openPermModal(role)}
                                        className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-md border px-3 py-1.5 text-xs hover:bg-accent"
                                    >
                                        <ShieldCheck className="h-3.5 w-3.5" /> Atur Hak Akses
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ── Add Role Modal ─────────────────────────────────────────────── */}
            {showAdd && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                    <div className="w-full max-w-sm rounded-lg border bg-background p-6 shadow-lg space-y-4">
                        <h2 className="font-semibold text-lg">Tambah Role</h2>
                        <div className="space-y-3">
                            <div>
                                <label className="text-sm font-medium">Nama (slug)</label>
                                <input
                                    type="text"
                                    value={addForm.name}
                                    onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value.toLowerCase().replace(/\s+/g, '_') }))}
                                    placeholder="contoh: supervisor"
                                    className="mt-1 block w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                />
                                <p className="text-xs text-muted-foreground mt-0.5">Hanya huruf kecil dan underscore</p>
                            </div>
                            <div>
                                <label className="text-sm font-medium">Label</label>
                                <input
                                    type="text"
                                    value={addForm.label}
                                    onChange={(e) => setAddForm((f) => ({ ...f, label: e.target.value }))}
                                    placeholder="contoh: Supervisor"
                                    className="mt-1 block w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
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

            {/* ── Edit Label Modal ───────────────────────────────────────────── */}
            {editRole && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                    <div className="w-full max-w-sm rounded-lg border bg-background p-6 shadow-lg space-y-4">
                        <h2 className="font-semibold text-lg">Edit Role</h2>
                        <div>
                            <label className="text-sm font-medium">Label</label>
                            <input
                                type="text"
                                value={editLabel}
                                onChange={(e) => setEditLabel(e.target.value)}
                                className="mt-1 block w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                            />
                        </div>
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setEditRole(null)} className="rounded-md border px-3 py-2 text-sm hover:bg-accent">Batal</button>
                            <button onClick={submitEdit} className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground hover:bg-primary/90">Simpan</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Permission Matrix Modal ────────────────────────────────────── */}
            {permRole && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="w-full max-w-lg rounded-lg border bg-background p-6 shadow-lg space-y-4">
                        <div>
                            <h2 className="font-semibold text-lg">Hak Akses — {permRole.label}</h2>
                            <p className="text-sm text-muted-foreground">Atur izin per modul untuk role ini</p>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b">
                                        <th className="pb-2 text-left font-medium">Modul</th>
                                        <th className="pb-2 text-center font-medium w-16">Lihat</th>
                                        <th className="pb-2 text-center font-medium w-16">Tulis</th>
                                        <th className="pb-2 text-center font-medium w-16">Hapus</th>
                                        <th className="pb-2 text-center font-medium w-16">Semua</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {Object.entries(modules).map(([key, modDef]) => {
                                        const p = permForm[key] ?? { can_view: false, can_write: false, can_delete: false };
                                        return (
                                            <tr key={key} className="border-b last:border-0">
                                                <td className="py-2.5 pr-4">{modDef.label}</td>
                                                <td className="py-2.5 text-center">
                                                    {modDef.actions.includes('view') ? (
                                                        <input
                                                            type="checkbox"
                                                            checked={p.can_view}
                                                            onChange={(e) => setPermValue(key, 'can_view', e.target.checked)}
                                                            className="h-4 w-4 rounded"
                                                        />
                                                    ) : <span className="text-muted-foreground">—</span>}
                                                </td>
                                                <td className="py-2.5 text-center">
                                                    {modDef.actions.includes('write') ? (
                                                        <input
                                                            type="checkbox"
                                                            checked={p.can_write}
                                                            onChange={(e) => setPermValue(key, 'can_write', e.target.checked)}
                                                            className="h-4 w-4 rounded"
                                                        />
                                                    ) : <span className="text-muted-foreground">—</span>}
                                                </td>
                                                <td className="py-2.5 text-center">
                                                    {modDef.actions.includes('delete') ? (
                                                        <input
                                                            type="checkbox"
                                                            checked={p.can_delete}
                                                            onChange={(e) => setPermValue(key, 'can_delete', e.target.checked)}
                                                            className="h-4 w-4 rounded"
                                                        />
                                                    ) : <span className="text-muted-foreground">—</span>}
                                                </td>
                                                <td className="py-2.5 text-center">
                                                    <input
                                                        type="checkbox"
                                                        checked={isAllChecked(key)}
                                                        onChange={(e) => toggleAll(key, e.target.checked)}
                                                        className="h-4 w-4 rounded"
                                                    />
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        <p className="text-xs text-muted-foreground">
                            Mengaktifkan Tulis/Hapus otomatis mengaktifkan Lihat. Menonaktifkan Lihat otomatis menonaktifkan Tulis & Hapus.
                        </p>

                        <div className="flex justify-end gap-2">
                            <button onClick={() => setPermRole(null)} className="rounded-md border px-3 py-2 text-sm hover:bg-accent">Batal</button>
                            <button onClick={submitPerms} className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground hover:bg-primary/90">Simpan</button>
                        </div>
                    </div>
                </div>
            )}
        </AppLayout>
    );
}
