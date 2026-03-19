import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem, type SharedData } from '@/types';
import { router, usePage } from '@inertiajs/react';
import {
    AlertCircle, ArrowLeft, CheckCircle2, Package, Plus, Printer, Search, Truck, XCircle,
} from 'lucide-react';
import { useRef, useState } from 'react';

interface DOItem {
    id: number;
    itemId: number;
    itemName: string;
    itemCode: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
    quantityReceived: number | null;
}

interface DOWarehouse {
    id: number;
    name: string;
    location: string | null;
    city: string | null;
    phone: string | null;
}

interface DeliveryOrderData {
    id: number;
    doNumber: string;
    status: 'pending' | 'confirmed' | 'cancelled';
    fromWarehouse: DOWarehouse | null;
    toWarehouse: DOWarehouse | null;
    senderName: string;
    senderUser: string | null;
    recipientName: string | null;
    recipientUser: string | null;
    sentAt: string | null;
    confirmedAt: string | null;
    note: string | null;
    createdAt: string | null;
    createdBy: string | null;
    items: DOItem[];
    grandTotal: number;
}

interface AddableItem {
    id: number; name: string; code: string; global_price: number; main_stock: number;
}

interface Props {
    order: DeliveryOrderData;
    addableItems?: AddableItem[];
}

const fmt = (v: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v);

function fmtDate(iso: string | null, time = false) {
    if (!iso) return '-';
    const opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'long', year: 'numeric' };
    if (time) { opts.hour = '2-digit'; opts.minute = '2-digit'; }
    return new Date(iso).toLocaleDateString('id-ID', opts);
}

const STATUS_LABEL: Record<string, { label: string; icon: React.ReactNode; class: string }> = {
    pending: {
        label: 'Pending',
        icon: <Package className="w-4 h-4" />,
        class: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
    },
    confirmed: {
        label: 'Dikonfirmasi',
        icon: <CheckCircle2 className="w-4 h-4" />,
        class: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
    },
    cancelled: {
        label: 'Dibatalkan',
        icon: <XCircle className="w-4 h-4" />,
        class: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
    },
};

export default function ShowDeliveryOrder({ order, addableItems = [] }: Props) {
    const { permissions } = usePage<SharedData>().props;
    const canWrite = permissions.inventory?.can_write;

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Inventory', href: '/inventory/transfers' },
        { title: 'Surat Jalan', href: '/inventory/delivery-orders' },
        { title: order.doNumber, href: '#' },
    ];

    const s = STATUS_LABEL[order.status] ?? { label: order.status, icon: null, class: 'bg-muted text-muted-foreground' };

    // ── Confirm checklist state ───────────────────────────────────────────────
    const [showConfirmForm, setShowConfirmForm] = useState(false);
    const [cancelConfirm, setCancelConfirm]     = useState(false);
    const [recipientName, setRecipientName]     = useState('');
    const [confirming, setConfirming]           = useState(false);
    const [confirmErr, setConfirmErr]           = useState<Record<string, string>>({});

    // Per-item checklist: doi_id → { checked, quantityReceived }
    const [checklist, setChecklist] = useState<Record<number, { checked: boolean; qty: number }>>(
        () => Object.fromEntries(order.items.map(it => [it.id, { checked: true, qty: it.quantity }]))
    );

    // ── Add-item inline form state ────────────────────────────────────────────
    const [showAddItem, setShowAddItem]     = useState(false);
    const [addSearch, setAddSearch]         = useState('');
    const [addDropOpen, setAddDropOpen]     = useState(false);
    const [addSelected, setAddSelected]     = useState<AddableItem | null>(null);
    const [addQty, setAddQty]               = useState(1);
    const [addPrice, setAddPrice]           = useState(0);
    const [addProcessing, setAddProcessing] = useState(false);
    const [addErrors, setAddErrors]         = useState<Record<string, string>>({});
    const addSearchRef = useRef<HTMLInputElement>(null);

    const filteredAddable = addableItems.filter(it => {
        const q = addSearch.toLowerCase();
        return !q || it.name.toLowerCase().includes(q) || it.code.toLowerCase().includes(q);
    }).slice(0, 30);

    function selectAddItem(it: AddableItem) {
        setAddSelected(it);
        setAddQty(1);
        setAddPrice(it.global_price);
        setAddSearch('');
        setAddDropOpen(false);
    }

    function submitAddItem(e: React.FormEvent) {
        e.preventDefault();
        if (!addSelected) return;
        setAddProcessing(true);
        setAddErrors({});
        router.post(
            `/inventory/delivery-orders/${order.id}/items`,
            { item_id: addSelected.id, quantity: addQty, unit_price: addPrice },
            {
                onError: (errs) => setAddErrors(errs as Record<string, string>),
                onFinish: () => setAddProcessing(false),
                onSuccess: () => { setShowAddItem(false); setAddSelected(null); },
            }
        );
    }

    function setItemChecked(doiId: number, checked: boolean) {
        setChecklist(prev => ({ ...prev, [doiId]: { ...prev[doiId], checked } }));
    }
    function setItemQty(doiId: number, qty: number) {
        const item = order.items.find(it => it.id === doiId);
        const max  = item?.quantity ?? 9999;
        setChecklist(prev => ({ ...prev, [doiId]: { ...prev[doiId], qty: Math.max(0, Math.min(qty, max)) } }));
    }

    function submitConfirm(e: React.FormEvent) {
        e.preventDefault();
        setConfirmErr({});
        setConfirming(true);
        router.post(
            `/inventory/delivery-orders/${order.id}/confirm`,
            {
                recipient_name: recipientName,
                items: order.items.map(it => ({
                    doi_id:            it.id,
                    quantity_received: checklist[it.id]?.checked ? (checklist[it.id]?.qty ?? 0) : 0,
                })),
            },
            {
                onError: (errs) => setConfirmErr(errs as Record<string, string>),
                onFinish: () => setConfirming(false),
            }
        );
    }

    function doCancel() {
        router.post(`/inventory/delivery-orders/${order.id}/cancel`);
    }

    const allUnchecked = order.items.every(it => !checklist[it.id]?.checked);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <div className="space-y-4 p-4 max-w-4xl mx-auto">
                {/* Header */}
                <div className="flex flex-wrap items-start justify-between gap-3">
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
                                {order.doNumber}
                            </h1>
                            <p className="text-sm text-muted-foreground mt-0.5">
                                Dibuat {fmtDate(order.createdAt, true)} oleh {order.createdBy ?? '-'}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${s.class}`}>
                            {s.icon} {s.label}
                        </span>
                        <button
                            onClick={() => router.visit(`/inventory/delivery-orders/${order.id}/print`)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm hover:bg-muted transition-colors"
                        >
                            <Printer className="w-4 h-4" /> Cetak
                        </button>
                    </div>
                </div>

                {/* Info grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Shipping info */}
                    <div className="rounded-xl border bg-card p-4 space-y-3">
                        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Pengiriman</h2>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between gap-2">
                                <span className="text-muted-foreground">Dari</span>
                                <span className="font-medium text-right">{order.fromWarehouse?.name ?? '-'}</span>
                            </div>
                            <div className="flex justify-between gap-2">
                                <span className="text-muted-foreground">Ke</span>
                                <span className="font-medium text-right">{order.toWarehouse?.name ?? '-'}</span>
                            </div>
                            <div className="flex justify-between gap-2">
                                <span className="text-muted-foreground">Tanggal Kirim</span>
                                <span className="font-medium">{fmtDate(order.sentAt)}</span>
                            </div>
                            {order.confirmedAt && (
                                <div className="flex justify-between gap-2">
                                    <span className="text-muted-foreground">Dikonfirmasi</span>
                                    <span className="font-medium text-emerald-600">{fmtDate(order.confirmedAt, true)}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* People */}
                    <div className="rounded-xl border bg-card p-4 space-y-3">
                        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Pengirim & Penerima</h2>
                        <div className="space-y-2 text-sm">
                            <div className="flex items-start justify-between gap-2">
                                <span className="text-muted-foreground">Pengirim</span>
                                <div className="text-right">
                                    <div className="font-medium">{order.senderName}</div>
                                    {order.senderUser && order.senderUser !== order.senderName && (
                                        <div className="text-xs text-muted-foreground">{order.senderUser}</div>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-start justify-between gap-2">
                                <span className="text-muted-foreground">Penerima</span>
                                <div className="text-right">
                                    {order.recipientName
                                        ? <>
                                            <div className="font-medium">{order.recipientName}</div>
                                            {order.recipientUser && order.recipientUser !== order.recipientName && (
                                                <div className="text-xs text-muted-foreground">{order.recipientUser}</div>
                                            )}
                                          </>
                                        : <span className="text-muted-foreground italic">Belum dikonfirmasi</span>
                                    }
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {order.note && (
                    <div className="rounded-xl border bg-card px-4 py-3 text-sm">
                        <span className="text-muted-foreground font-medium">Catatan: </span>
                        {order.note}
                    </div>
                )}

                {/* Items table */}
                <div className="rounded-xl border bg-card overflow-hidden">
                    <div className="px-4 py-3 border-b">
                        <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Daftar Produk</h2>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b bg-muted/40">
                                    <th className="text-left px-4 py-3 font-medium">Produk</th>
                                    <th className="text-center px-4 py-3 font-medium">Dikirim</th>
                                    {order.status === 'confirmed' && (
                                        <th className="text-center px-4 py-3 font-medium">Diterima</th>
                                    )}
                                    <th className="text-right px-4 py-3 font-medium">Harga Satuan</th>
                                    <th className="text-right px-4 py-3 font-medium">Subtotal</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {order.items.map(it => (
                                    <tr key={it.id} className="hover:bg-muted/10">
                                        <td className="px-4 py-3">
                                            <div className="font-medium">{it.itemName}</div>
                                            <div className="text-xs text-muted-foreground">{it.itemCode}</div>
                                        </td>
                                        <td className="px-4 py-3 text-center">{it.quantity}</td>
                                        {order.status === 'confirmed' && (
                                            <td className="px-4 py-3 text-center">
                                                <span className={it.quantityReceived === it.quantity ? 'text-emerald-600 font-medium' : 'text-amber-600 font-medium'}>
                                                    {it.quantityReceived ?? 0}
                                                </span>
                                            </td>
                                        )}
                                        <td className="px-4 py-3 text-right text-muted-foreground">{fmt(it.unitPrice)}</td>
                                        <td className="px-4 py-3 text-right font-medium">{fmt(it.subtotal)}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="border-t bg-muted/30">
                                    <td colSpan={order.status === 'confirmed' ? 4 : 3} className="px-4 py-3 text-right font-medium text-sm">Total Nilai</td>
                                    <td className="px-4 py-3 text-right font-bold">{fmt(order.grandTotal)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>

                {/* Tambah Produk (pending only) */}
                {order.status === 'pending' && canWrite && addableItems.length > 0 && (
                    <div className="rounded-xl border bg-card p-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Tambah Produk ke Surat Jalan</h2>
                            {!showAddItem && (
                                <button
                                    onClick={() => setShowAddItem(true)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
                                >
                                    <Plus className="w-4 h-4" /> Tambah Produk
                                </button>
                            )}
                        </div>

                        {showAddItem && (
                            <form onSubmit={submitAddItem} className="space-y-3">
                                {/* Item search */}
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <input
                                        ref={addSearchRef}
                                        type="text"
                                        value={addSelected ? addSelected.name : addSearch}
                                        onChange={e => { setAddSelected(null); setAddSearch(e.target.value); setAddDropOpen(true); }}
                                        onFocus={() => setAddDropOpen(true)}
                                        onBlur={() => setTimeout(() => setAddDropOpen(false), 150)}
                                        placeholder="Cari produk untuk ditambahkan…"
                                        className="w-full pl-9 pr-4 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        readOnly={!!addSelected}
                                    />
                                    {!addSelected && addDropOpen && filteredAddable.length > 0 && (
                                        <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-popover border rounded-lg shadow-lg max-h-52 overflow-y-auto">
                                            {filteredAddable.map(it => (
                                                <button
                                                    key={it.id}
                                                    type="button"
                                                    onMouseDown={() => selectAddItem(it)}
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
                                    {addSelected && (
                                        <button type="button" onClick={() => { setAddSelected(null); setAddSearch(''); }}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs">✕</button>
                                    )}
                                </div>

                                {addErrors.item_id && <p className="text-xs text-red-500">{addErrors.item_id}</p>}

                                {addSelected && (
                                    <div className="flex items-end gap-3">
                                        <div>
                                            <label className="block text-xs font-medium mb-1 text-muted-foreground">Jumlah</label>
                                            <input
                                                type="number" min={1} max={addSelected.main_stock}
                                                value={addQty}
                                                onChange={e => setAddQty(Math.max(1, Math.min(parseInt(e.target.value) || 1, addSelected!.main_stock)))}
                                                className="w-24 text-center border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                            />
                                            {addErrors.quantity && <p className="text-xs text-red-500 mt-1">{addErrors.quantity}</p>}
                                        </div>
                                        <div className="flex-1">
                                            <label className="block text-xs font-medium mb-1 text-muted-foreground">Harga Satuan</label>
                                            <input
                                                type="number" min={0}
                                                value={addPrice}
                                                onChange={e => setAddPrice(Math.max(0, parseInt(e.target.value) || 0))}
                                                className="w-full border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                            />
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                type="submit"
                                                disabled={addProcessing}
                                                className="px-4 py-1.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
                                            >
                                                {addProcessing ? 'Menambah…' : 'Tambah'}
                                            </button>
                                            <button type="button" onClick={() => { setShowAddItem(false); setAddSelected(null); setAddSearch(''); }}
                                                className="px-3 py-1.5 rounded-lg border text-sm hover:bg-muted transition-colors">
                                                Batal
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </form>
                        )}
                    </div>
                )}

                {/* Actions for pending */}
                {order.status === 'pending' && canWrite && (
                    <div className="rounded-xl border bg-card p-4 space-y-4">
                        <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Tindakan</h2>

                        {!showConfirmForm && !cancelConfirm && (
                            <div className="flex flex-wrap gap-3">
                                <button
                                    onClick={() => setShowConfirmForm(true)}
                                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 text-sm font-medium transition-colors"
                                >
                                    <CheckCircle2 className="w-4 h-4" /> Konfirmasi Penerimaan
                                </button>
                                <button
                                    onClick={() => setCancelConfirm(true)}
                                    className="flex items-center gap-2 px-4 py-2 rounded-lg border text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 text-sm font-medium transition-colors"
                                >
                                    <XCircle className="w-4 h-4" /> Batalkan
                                </button>
                            </div>
                        )}

                        {/* Confirm checklist form */}
                        {showConfirmForm && (
                            <form onSubmit={submitConfirm} className="space-y-4 border-t pt-4">
                                <div>
                                    <p className="text-sm text-muted-foreground mb-3">
                                        Centang produk yang sudah tiba di <strong>{order.toWarehouse?.name}</strong> dan verifikasi jumlahnya.
                                        Stok hanya dipindahkan untuk produk yang dicentang.
                                    </p>

                                    {/* Recipient name */}
                                    <div className="mb-4 max-w-sm">
                                        <label className="block text-sm font-medium mb-1">Nama Penerima <span className="text-red-500">*</span></label>
                                        <input
                                            type="text"
                                            value={recipientName}
                                            onChange={e => setRecipientName(e.target.value)}
                                            placeholder="Nama penerima barang"
                                            className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                            required
                                        />
                                        {confirmErr.recipient_name && (
                                            <p className="text-xs text-red-500 mt-1">{confirmErr.recipient_name}</p>
                                        )}
                                    </div>

                                    {/* Per-item checklist */}
                                    <div className="rounded-lg border overflow-hidden">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="border-b bg-muted/40">
                                                    <th className="w-10 px-3 py-2 text-center">
                                                        <input
                                                            type="checkbox"
                                                            checked={order.items.every(it => checklist[it.id]?.checked)}
                                                            onChange={e => order.items.forEach(it => setItemChecked(it.id, e.target.checked))}
                                                            className="rounded"
                                                        />
                                                    </th>
                                                    <th className="text-left px-3 py-2 font-medium">Produk</th>
                                                    <th className="text-center px-3 py-2 font-medium w-24">Dikirim</th>
                                                    <th className="text-center px-3 py-2 font-medium w-32">Diterima</th>
                                                    <th className="text-center px-3 py-2 font-medium w-24">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y">
                                                {order.items.map(it => {
                                                    const row     = checklist[it.id] ?? { checked: true, qty: it.quantity };
                                                    const isShort = row.checked && row.qty < it.quantity;
                                                    const isFull  = row.checked && row.qty === it.quantity;
                                                    return (
                                                        <tr key={it.id} className={`transition-colors ${!row.checked ? 'opacity-50 bg-muted/20' : 'hover:bg-muted/10'}`}>
                                                            <td className="px-3 py-2.5 text-center">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={row.checked}
                                                                    onChange={e => setItemChecked(it.id, e.target.checked)}
                                                                    className="rounded"
                                                                />
                                                            </td>
                                                            <td className="px-3 py-2.5">
                                                                <div className="font-medium">{it.itemName}</div>
                                                                <div className="text-xs text-muted-foreground">{it.itemCode}</div>
                                                            </td>
                                                            <td className="px-3 py-2.5 text-center text-muted-foreground">{it.quantity}</td>
                                                            <td className="px-3 py-2.5 text-center">
                                                                {row.checked ? (
                                                                    <input
                                                                        type="number"
                                                                        min={0}
                                                                        max={it.quantity}
                                                                        value={row.qty}
                                                                        onChange={e => setItemQty(it.id, parseInt(e.target.value) || 0)}
                                                                        className="w-20 text-center border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                                                    />
                                                                ) : (
                                                                    <span className="text-muted-foreground">—</span>
                                                                )}
                                                            </td>
                                                            <td className="px-3 py-2.5 text-center">
                                                                {!row.checked && (
                                                                    <span className="text-xs bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 px-2 py-0.5 rounded-full">Tidak tiba</span>
                                                                )}
                                                                {isFull && (
                                                                    <span className="text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 px-2 py-0.5 rounded-full">Lengkap</span>
                                                                )}
                                                                {isShort && (
                                                                    <span className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 px-2 py-0.5 rounded-full">Sebagian</span>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {allUnchecked && (
                                    <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 rounded-lg">
                                        <AlertCircle className="w-4 h-4 shrink-0" />
                                        Tidak ada produk yang dicentang. Centang minimal satu produk untuk konfirmasi.
                                    </div>
                                )}

                                {confirmErr.stock && (
                                    <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 dark:bg-red-950/30 px-3 py-2 rounded-lg">
                                        <AlertCircle className="w-4 h-4 shrink-0" /> {confirmErr.stock}
                                    </div>
                                )}

                                <div className="flex gap-2">
                                    <button
                                        type="submit"
                                        disabled={confirming || !recipientName || allUnchecked}
                                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 text-sm font-medium transition-colors disabled:opacity-50"
                                    >
                                        <CheckCircle2 className="w-4 h-4" />
                                        {confirming ? 'Memproses…' : 'Konfirmasi Penerimaan'}
                                    </button>
                                    <button type="button" onClick={() => setShowConfirmForm(false)}
                                        className="px-3 py-2 rounded-lg border text-sm hover:bg-muted transition-colors">
                                        Batal
                                    </button>
                                </div>
                            </form>
                        )}

                        {/* Cancel confirm */}
                        {cancelConfirm && (
                            <div className="border-t pt-3 space-y-3">
                                <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 rounded-lg">
                                    <AlertCircle className="w-4 h-4 shrink-0" />
                                    Yakin ingin membatalkan surat jalan <strong>{order.doNumber}</strong>? Stok tidak akan berubah.
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={doCancel}
                                        className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 text-sm font-medium transition-colors"
                                    >
                                        Ya, Batalkan
                                    </button>
                                    <button onClick={() => setCancelConfirm(false)}
                                        className="px-3 py-2 rounded-lg border text-sm hover:bg-muted transition-colors">
                                        Tidak
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </AppLayout>
    );
}

