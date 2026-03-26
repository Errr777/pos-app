import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem, type SharedData } from '@/types';
import { router, usePage } from '@inertiajs/react';
import {
    ArrowLeft, Minus, Plus, Search, Truck, AlertCircle, ExternalLink,
} from 'lucide-react';
import { useRef, useState } from 'react';

interface WarehouseOption { id: string; name: string; code: string; is_default: boolean; }
interface ItemOption {
    id: string; name: string; code: string; category: string | null;
    global_price: number; main_stock: number;
}
interface UserOption { id: string; name: string; role: string; }

interface PrefillData {
    to_warehouse_id: string;
    item: ItemOption;
    quantity: number;
    reference?: string | null;
    note?: string | null;
}

interface Props {
    mainWarehouse: { id: string; name: string; code: string } | null;
    warehouses: WarehouseOption[];
    items: ItemOption[];
    users: UserOption[];
    prefill?: PrefillData | null;
    pendingByOutlet?: Record<string, { id: string; doNumber: string }[]>;
}

interface CartItem {
    item_id: string;
    name: string;
    code: string;
    quantity: number;
    unit_price: number;
    main_stock: number;
}

const fmt = (v: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v);

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Inventory', href: '/inventory/transfers' },
    { title: 'Surat Jalan', href: '/inventory/delivery-orders' },
    { title: 'Buat Baru', href: '#' },
];

export default function CreateDeliveryOrder({ mainWarehouse, warehouses, items, users, prefill, pendingByOutlet = {} }: Props) {
    const { permissions } = usePage<SharedData>().props;

    const outlets = warehouses.filter(w => !w.is_default);

    const [toWarehouseId, setToWarehouseId] = useState(() => prefill ? String(prefill.to_warehouse_id) : '');
    const [senderName, setSenderName]       = useState('');
    const [senderId, setSenderId]           = useState('');
    const [note, setNote]                   = useState(() => prefill?.note ?? '');
    const [processing, setProcessing]       = useState(false);
    const [formErrors, setFormErrors]       = useState<Record<string, string>>({})

    // Item search
    const [itemSearch, setItemSearch] = useState('');
    const [itemDropOpen, setItemDropOpen] = useState(false);
    const searchRef = useRef<HTMLInputElement>(null);

    const filteredItems = items.filter(it => {
        if (!itemSearch) return true;
        const q = itemSearch.toLowerCase();
        return it.name.toLowerCase().includes(q) || it.code.toLowerCase().includes(q);
    }).slice(0, 30);

    const [cartItems, setCartItems] = useState<CartItem[]>(() => {
        if (!prefill?.item) return [];
        return [{
            item_id:    prefill.item.id,
            name:       prefill.item.name,
            code:       prefill.item.code,
            quantity:   prefill.quantity,
            unit_price: prefill.item.global_price,
            main_stock: prefill.item.main_stock,
        }];
    });

    function addItem(it: ItemOption) {
        const existing = cartItems.find(c => c.item_id === it.id);
        if (existing) {
            setCartItems(cartItems.map(c =>
                c.item_id === it.id ? { ...c, quantity: Math.min(c.quantity + 1, c.main_stock) } : c
            ));
        } else {
            setCartItems([...cartItems, {
                item_id: it.id,
                name: it.name,
                code: it.code,
                quantity: 1,
                unit_price: it.global_price,
                main_stock: it.main_stock,
            }]);
        }
        setItemSearch('');
        setItemDropOpen(false);
    }

    function removeItem(id: string) {
        setCartItems(cartItems.filter(c => c.item_id !== id));
    }

    function setQty(id: string, val: number) {
        const item = cartItems.find(c => c.item_id === id);
        if (!item) return;
        const qty = Math.max(1, Math.min(val, item.main_stock));
        setCartItems(cartItems.map(c => c.item_id === id ? { ...c, quantity: qty } : c));
    }

    function setPrice(id: string, val: number) {
        setCartItems(cartItems.map(c => c.item_id === id ? { ...c, unit_price: Math.max(0, val) } : c));
    }

    const grandTotal = cartItems.reduce((s, c) => s + c.quantity * c.unit_price, 0);

    function submit(e: React.FormEvent) {
        e.preventDefault();
        setProcessing(true);
        router.post('/inventory/delivery-orders', {
            to_warehouse_id: toWarehouseId,
            sender_name: senderName,
            sender_id: senderId,
            note,
            items: cartItems.map(c => ({
                item_id: c.item_id,
                quantity: c.quantity,
                unit_price: c.unit_price,
            })),
        }, {
            onError: (errs) => setFormErrors(errs as Record<string, string>),
            onFinish: () => setProcessing(false),
        });
    }

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <div className="space-y-4 p-4 max-w-4xl mx-auto">
                {/* Header */}
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => router.visit('/inventory/delivery-orders')}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border bg-background hover:bg-muted transition-colors font-medium"
                    >
                        <ArrowLeft className="w-4 h-4" /> Kembali
                    </button>
                    <div>
                        <h1 className="text-xl font-bold flex items-center gap-2">
                            <Truck className="w-5 h-5 text-indigo-500" />
                            Buat Surat Jalan
                        </h1>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            Pengiriman dari {mainWarehouse?.name ?? 'Toko Pusat'} ke outlet
                        </p>
                    </div>
                </div>

                <form onSubmit={submit} className="space-y-4">
                    {/* Info card */}
                    <div className="rounded-xl border bg-card p-4 space-y-4">
                        <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Informasi Pengiriman</h2>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            {/* From */}
                            <div>
                                <label className="block text-sm font-medium mb-1">Dari (Gudang Asal)</label>
                                <div className="px-3 py-2 rounded-lg border bg-muted/40 text-sm text-muted-foreground">
                                    {mainWarehouse?.name ?? '—'}
                                </div>
                            </div>

                            {/* To */}
                            <div>
                                <label className="block text-sm font-medium mb-1">Ke (Outlet Tujuan) <span className="text-red-500">*</span></label>
                                <select
                                    value={toWarehouseId}
                                    onChange={e => setToWarehouseId(e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    required
                                >
                                    <option value="">— Pilih Outlet —</option>
                                    {outlets.map(o => (
                                        <option key={o.id} value={o.id}>{o.name} ({o.code})</option>
                                    ))}
                                </select>
                                {formErrors.to_warehouse_id && (
                                    <p className="text-xs text-red-500 mt-1">{formErrors.to_warehouse_id}</p>
                                )}
                                {/* Pending SJ banner for selected outlet */}
                                {toWarehouseId && pendingByOutlet[toWarehouseId]?.length > 0 && (
                                    <div className="mt-2 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700 p-3 space-y-1.5">
                                        <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                                            <AlertCircle className="w-3.5 h-3.5" />
                                            Sudah ada Surat Jalan pending ke outlet ini
                                        </p>
                                        {pendingByOutlet[toWarehouseId].map(pending => (
                                            <a
                                                key={pending.id}
                                                href={`/inventory/delivery-orders/${pending.id}`}
                                                className="flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400 underline hover:text-amber-900"
                                            >
                                                <ExternalLink className="w-3 h-3" />
                                                {pending.doNumber} — klik untuk menambah item ke surat jalan ini
                                            </a>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Sender name */}
                            <div>
                                <label className="block text-sm font-medium mb-1">Nama Pengirim <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    value={senderName}
                                    onChange={e => setSenderName(e.target.value)}
                                    placeholder="Nama pengirim barang"
                                    className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    required
                                />
                                {formErrors.sender_name && (
                                    <p className="text-xs text-red-500 mt-1">{formErrors.sender_name}</p>
                                )}
                            </div>

                            {/* Sender user */}
                            <div>
                                <label className="block text-sm font-medium mb-1">Pengguna Pengirim (opsional)</label>
                                <select
                                    value={senderId}
                                    onChange={e => {
                                        const uid = e.target.value;
                                        setSenderId(uid);
                                        if (uid) {
                                            const u = users.find(u => String(u.id) === uid);
                                            if (u) setSenderName(u.name);
                                        }
                                    }}
                                    className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                >
                                    <option value="">— Pilih dari daftar pengguna —</option>
                                    {users.map(u => (
                                        <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                                    ))}
                                </select>
                            </div>

                            {/* Note */}
                            <div className="sm:col-span-2">
                                <label className="block text-sm font-medium mb-1">Catatan (opsional)</label>
                                <textarea
                                    value={note}
                                    onChange={e => setNote(e.target.value)}
                                    rows={2}
                                    placeholder="Catatan tambahan untuk surat jalan ini…"
                                    className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Items */}
                    <div className="rounded-xl border bg-card p-4 space-y-3">
                        <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Daftar Produk</h2>

                        {/* Search to add */}
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <input
                                ref={searchRef}
                                type="text"
                                value={itemSearch}
                                onChange={e => { setItemSearch(e.target.value); setItemDropOpen(true); }}
                                onFocus={() => setItemDropOpen(true)}
                                onBlur={() => setTimeout(() => setItemDropOpen(false), 150)}
                                placeholder="Cari dan tambah produk…"
                                className="w-full pl-9 pr-4 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                            {itemDropOpen && filteredItems.length > 0 && (
                                <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-popover border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                    {filteredItems.map(it => (
                                        <button
                                            key={it.id}
                                            type="button"
                                            onMouseDown={() => addItem(it)}
                                            className="w-full text-left px-3 py-2 hover:bg-muted/60 flex items-center justify-between gap-2 text-sm"
                                        >
                                            <div>
                                                <div className="font-medium">{it.name}</div>
                                                <div className="text-xs text-muted-foreground">{it.code} · Stok: {it.main_stock}</div>
                                            </div>
                                            <span className="text-xs text-muted-foreground whitespace-nowrap">{fmt(it.global_price)}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {formErrors.items && (
                            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 dark:bg-red-950/30 px-3 py-2 rounded-lg">
                                <AlertCircle className="w-4 h-4 shrink-0" /> {formErrors.items}
                            </div>
                        )}

                        {cartItems.length === 0 && (
                            <p className="text-sm text-muted-foreground text-center py-6">
                                Belum ada produk. Gunakan kolom pencarian di atas untuk menambah produk.
                            </p>
                        )}

                        {cartItems.length > 0 && (
                            <div className="rounded-lg border overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b bg-muted/40">
                                            <th className="text-left px-3 py-2 font-medium">Produk</th>
                                            <th className="text-center px-3 py-2 font-medium w-32">Qty</th>
                                            <th className="text-right px-3 py-2 font-medium w-36">Harga Satuan</th>
                                            <th className="text-right px-3 py-2 font-medium w-32">Subtotal</th>
                                            <th className="px-3 py-2 w-10" />
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {cartItems.map(ci => (
                                            <tr key={ci.item_id} className="hover:bg-muted/10">
                                                <td className="px-3 py-2">
                                                    <div className="font-medium">{ci.name}</div>
                                                    <div className="text-xs text-muted-foreground">{ci.code} · Stok tersedia: {ci.main_stock}</div>
                                                    {ci.quantity > ci.main_stock && (
                                                        <div className="text-xs text-red-500 mt-0.5 flex items-center gap-1">
                                                            <AlertCircle className="w-3 h-3" /> Melebihi stok tersedia
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-3 py-2">
                                                    <div className="flex items-center justify-center gap-1">
                                                        <button type="button" onClick={() => setQty(ci.item_id, ci.quantity - 1)}
                                                            className="w-6 h-6 flex items-center justify-center rounded border hover:bg-muted text-muted-foreground">
                                                            <Minus className="w-3 h-3" />
                                                        </button>
                                                        <input
                                                            type="number" min={1} max={ci.main_stock}
                                                            value={ci.quantity}
                                                            onChange={e => setQty(ci.item_id, parseInt(e.target.value) || 1)}
                                                            className="w-14 text-center border rounded px-1 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                                        />
                                                        <button type="button" onClick={() => setQty(ci.item_id, ci.quantity + 1)}
                                                            className="w-6 h-6 flex items-center justify-center rounded border hover:bg-muted text-muted-foreground">
                                                            <Plus className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                </td>
                                                <td className="px-3 py-2 text-right">
                                                    <input
                                                        type="number" min={0}
                                                        value={ci.unit_price}
                                                        onChange={e => setPrice(ci.item_id, parseInt(e.target.value) || 0)}
                                                        className="w-full text-right border rounded px-2 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                                    />
                                                </td>
                                                <td className="px-3 py-2 text-right font-medium">
                                                    {fmt(ci.quantity * ci.unit_price)}
                                                </td>
                                                <td className="px-3 py-2 text-center">
                                                    <button type="button" onClick={() => removeItem(ci.item_id)}
                                                        className="text-muted-foreground hover:text-red-500 transition-colors">
                                                        ×
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="border-t bg-muted/30">
                                            <td colSpan={3} className="px-3 py-2 text-sm font-medium text-right">Total</td>
                                            <td className="px-3 py-2 text-right font-bold">{fmt(grandTotal)}</td>
                                            <td />
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Submit */}
                    <div className="flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={() => router.visit('/inventory/delivery-orders')}
                            className="px-4 py-2 rounded-lg border text-sm hover:bg-muted transition-colors"
                        >
                            Batal
                        </button>
                        <button
                            type="submit"
                            disabled={processing || cartItems.length === 0 || !toWarehouseId || !senderName}
                            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 text-sm font-medium transition-colors disabled:opacity-50"
                        >
                            <Truck className="w-4 h-4" />
                            {processing ? 'Menyimpan…' : 'Buat Surat Jalan'}
                        </button>
                    </div>
                </form>
            </div>
        </AppLayout>
    );
}
