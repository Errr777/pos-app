import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import { useState } from 'react';
import { Plus, Pencil, Trash2, Tag } from 'lucide-react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Tags Produk', href: '/tags' },
];

interface TagRow {
    id: number;
    name: string;
    slug: string;
    color: string;
    items_count: number;
}

interface PageProps {
    tags: TagRow[];
    flash?: { success?: string };
    [key: string]: unknown;
}

const PRESET_COLORS = [
    '#6366f1', '#10b981', '#f59e0b',
    '#ef4444', '#8b5cf6', '#06b6d4', '#f97316',
];

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
    return (
        <div className="flex items-center gap-2 flex-wrap">
            {PRESET_COLORS.map(c => (
                <button
                    key={c}
                    type="button"
                    onClick={() => onChange(c)}
                    className={`w-6 h-6 rounded-full border-2 transition-transform ${value === c ? 'border-foreground scale-110' : 'border-transparent'}`}
                    style={{ backgroundColor: c }}
                />
            ))}
            <input
                type="color"
                value={value}
                onChange={e => onChange(e.target.value)}
                className="w-6 h-6 rounded cursor-pointer border border-border"
                title="Custom color"
            />
        </div>
    );
}

export default function TagsIndex() {
    const { tags, flash } = usePage<PageProps>().props;

    const [showAdd, setShowAdd]   = useState(false);
    const [addName, setAddName]   = useState('');
    const [addColor, setAddColor] = useState('#6366f1');

    const [editTag, setEditTag]     = useState<TagRow | null>(null);
    const [editName, setEditName]   = useState('');
    const [editColor, setEditColor] = useState('#6366f1');

    function submitAdd() {
        if (!addName.trim()) return;
        router.post(route('tags.store'), { name: addName.trim(), color: addColor }, {
            onSuccess: () => { setShowAdd(false); setAddName(''); setAddColor('#6366f1'); },
        });
    }

    function openEdit(t: TagRow) {
        setEditTag(t);
        setEditName(t.name);
        setEditColor(t.color);
    }

    function submitEdit() {
        if (!editTag || !editName.trim()) return;
        router.put(route('tags.update', { tag: editTag.id }), { name: editName.trim(), color: editColor }, {
            onSuccess: () => setEditTag(null),
        });
    }

    function handleDelete(t: TagRow) {
        if (!confirm(`Hapus tag "${t.name}"? Tag akan dihapus dari semua produk.`)) return;
        router.delete(route('tags.destroy', { tag: t.id }));
    }

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Tags Produk" />
            <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-semibold">Tags Produk</h1>
                        <p className="text-sm text-muted-foreground">Label warna untuk mengelompokkan produk</p>
                    </div>
                    <button
                        onClick={() => setShowAdd(true)}
                        className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                    >
                        <Plus className="h-4 w-4" /> Tambah Tag
                    </button>
                </div>

                {flash?.success && (
                    <div className="rounded-md border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-800">
                        {flash.success}
                    </div>
                )}

                {tags.length === 0 ? (
                    <div className="rounded-xl border bg-muted/30 p-12 text-center space-y-3">
                        <Tag className="h-10 w-10 mx-auto text-muted-foreground/40" />
                        <p className="font-medium text-muted-foreground">Belum ada tag produk</p>
                        <p className="text-sm text-muted-foreground">Buat tag untuk mengelompokkan produk dan mengatur promo berdasarkan tag.</p>
                        <button
                            onClick={() => setShowAdd(true)}
                            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                        >
                            <Plus className="h-4 w-4" /> Buat Tag Pertama
                        </button>
                    </div>
                ) : (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {tags.map(t => (
                            <div key={t.id} className="flex items-center gap-3 rounded-lg border bg-card p-4 shadow-sm">
                                <div className="shrink-0 h-8 w-8 rounded-full" style={{ backgroundColor: t.color }} />
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium text-sm truncate">{t.name}</p>
                                    <p className="text-xs text-muted-foreground">{t.items_count} produk</p>
                                </div>
                                <div className="flex gap-1 shrink-0">
                                    <button
                                        onClick={() => openEdit(t)}
                                        className="rounded p-1.5 hover:bg-accent"
                                        title="Edit"
                                    >
                                        <Pencil className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(t)}
                                        className="rounded p-1.5 hover:bg-accent text-destructive"
                                        title="Hapus"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Add Modal */}
            {showAdd && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="w-full max-w-sm rounded-lg border bg-background p-6 shadow-lg space-y-4">
                        <h2 className="font-semibold text-lg">Tambah Tag</h2>
                        <div className="space-y-3">
                            <div>
                                <label className="text-sm font-medium">Nama Tag</label>
                                <input
                                    type="text"
                                    value={addName}
                                    onChange={e => setAddName(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && submitAdd()}
                                    placeholder="cth: Flash Sale, Promo Lebaran"
                                    className="mt-1 block w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium mb-2 block">Warna</label>
                                <ColorPicker value={addColor} onChange={setAddColor} />
                            </div>
                            <div className="flex items-center gap-2 pt-1">
                                <div className="h-6 w-6 rounded-full shrink-0" style={{ backgroundColor: addColor }} />
                                <span className="text-sm font-medium">{addName || 'Preview'}</span>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setShowAdd(false)} className="rounded-md border px-3 py-2 text-sm hover:bg-accent">Batal</button>
                            <button onClick={submitAdd} className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground hover:bg-primary/90">Simpan</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {editTag && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="w-full max-w-sm rounded-lg border bg-background p-6 shadow-lg space-y-4">
                        <h2 className="font-semibold text-lg">Edit Tag</h2>
                        <div className="space-y-3">
                            <div>
                                <label className="text-sm font-medium">Nama Tag</label>
                                <input
                                    type="text"
                                    value={editName}
                                    onChange={e => setEditName(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && submitEdit()}
                                    className="mt-1 block w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium mb-2 block">Warna</label>
                                <ColorPicker value={editColor} onChange={setEditColor} />
                            </div>
                            <div className="flex items-center gap-2 pt-1">
                                <div className="h-6 w-6 rounded-full shrink-0" style={{ backgroundColor: editColor }} />
                                <span className="text-sm font-medium">{editName}</span>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setEditTag(null)} className="rounded-md border px-3 py-2 text-sm hover:bg-accent">Batal</button>
                            <button onClick={submitEdit} className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground hover:bg-primary/90">Simpan</button>
                        </div>
                    </div>
                </div>
            )}
        </AppLayout>
    );
}
