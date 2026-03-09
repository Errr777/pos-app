import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import { ArrowLeft, XCircle } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
    DialogDescription, DialogFooter, DialogClose,
} from '@/components/ui/dialog';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Retur Barang', href: '/returns' },
    { title: 'Detail Retur', href: '#' },
];

interface ReturnItemRow {
    id: number;
    itemId: number | null;
    itemName: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    condition: string;
}

interface ReturnData {
    id: number;
    returnNumber: string;
    type: string;
    customerName: string | null;
    supplierName: string | null;
    warehouseName: string;
    processedBy: string;
    occurredAt: string | null;
    status: string;
    totalAmount: number;
    reason: string | null;
    note: string | null;
    items: ReturnItemRow[];
}

interface PageProps {
    returnData: ReturnData;
    [key: string]: unknown;
}

const TYPE_LABELS: Record<string, string> = {
    customer_return: 'Retur dari Pelanggan',
    supplier_return: 'Retur ke Supplier',
};

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
    completed: { label: 'Selesai',    cls: 'bg-emerald-100 text-emerald-700' },
    void:      { label: 'Dibatalkan', cls: 'bg-rose-100 text-rose-700' },
};

const CONDITION_LABELS: Record<string, string> = {
    good:      'Baik',
    damaged:   'Rusak',
    defective: 'Cacat',
};

function formatRp(n: number) { return 'Rp ' + n.toLocaleString('id-ID'); }
function formatDate(iso: string | null) {
    if (!iso) return '-';
    return new Date(iso).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
}

export default function ReturnsShow() {
    const { returnData } = usePage<PageProps>().props;
    const [showVoid, setShowVoid] = useState(false);
    const [voiding, setVoiding]   = useState(false);

    const sc = STATUS_CONFIG[returnData.status] ?? { label: returnData.status, cls: 'bg-slate-100 text-slate-600' };

    const partyLabel = returnData.type === 'customer_return' ? 'Pelanggan' : 'Supplier';
    const partyName  = returnData.type === 'customer_return'
        ? (returnData.customerName ?? 'Walk-in')
        : (returnData.supplierName ?? '-');

    const handleVoid = () => {
        setVoiding(true);
        router.post(route('returns.void', { returnHeader: returnData.id }), {}, {
            onSuccess: () => { setShowVoid(false); setVoiding(false); },
            onError:   () => setVoiding(false),
        });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Retur ${returnData.returnNumber}`} />
            <div className="p-4 md:p-6 space-y-4 max-w-3xl">
                {/* Header */}
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <Button size="sm" variant="ghost" onClick={() => router.visit(route('returns.index'))}>
                            <ArrowLeft size={15} className="mr-1" /> Kembali
                        </Button>
                        <div>
                            <h1 className="text-xl font-semibold">{returnData.returnNumber}</h1>
                            <p className="text-sm text-muted-foreground">{TYPE_LABELS[returnData.type] ?? returnData.type}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${sc.cls}`}>{sc.label}</span>
                        {returnData.status === 'completed' && (
                            <Button size="sm" variant="destructive" onClick={() => setShowVoid(true)}>
                                <XCircle size={14} className="mr-1" /> Void
                            </Button>
                        )}
                    </div>
                </div>

                {/* Info grid */}
                <div className="rounded-lg border p-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                    <div>
                        <p className="text-muted-foreground text-xs">Tipe</p>
                        <p className="font-medium mt-0.5">{TYPE_LABELS[returnData.type] ?? returnData.type}</p>
                    </div>
                    <div>
                        <p className="text-muted-foreground text-xs">{partyLabel}</p>
                        <p className="font-medium mt-0.5">{partyName}</p>
                    </div>
                    <div>
                        <p className="text-muted-foreground text-xs">Gudang</p>
                        <p className="font-medium mt-0.5">{returnData.warehouseName}</p>
                    </div>
                    <div>
                        <p className="text-muted-foreground text-xs">Tanggal</p>
                        <p className="font-medium mt-0.5">{formatDate(returnData.occurredAt)}</p>
                    </div>
                    <div>
                        <p className="text-muted-foreground text-xs">Diproses Oleh</p>
                        <p className="font-medium mt-0.5">{returnData.processedBy}</p>
                    </div>
                    {returnData.reason && (
                        <div>
                            <p className="text-muted-foreground text-xs">Alasan</p>
                            <p className="font-medium mt-0.5">{returnData.reason}</p>
                        </div>
                    )}
                    {returnData.note && (
                        <div className="col-span-2">
                            <p className="text-muted-foreground text-xs">Catatan</p>
                            <p className="font-medium mt-0.5">{returnData.note}</p>
                        </div>
                    )}
                </div>

                {/* Items table */}
                <div className="rounded-lg border overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-muted/50 border-b">
                            <tr>
                                <th className="text-left px-4 py-3 font-medium">Item</th>
                                <th className="text-center px-4 py-3 font-medium">Kondisi</th>
                                <th className="text-right px-4 py-3 font-medium">Qty</th>
                                <th className="text-right px-4 py-3 font-medium">Harga Satuan</th>
                                <th className="text-right px-4 py-3 font-medium">Subtotal</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {returnData.items.map(ri => (
                                <tr key={ri.id} className="hover:bg-muted/30">
                                    <td className="px-4 py-3">{ri.itemName}</td>
                                    <td className="px-4 py-3 text-center">
                                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                                            ri.condition === 'good' ? 'bg-emerald-100 text-emerald-700' :
                                            ri.condition === 'damaged' ? 'bg-rose-100 text-rose-700' :
                                            'bg-amber-100 text-amber-700'
                                        }`}>
                                            {CONDITION_LABELS[ri.condition] ?? ri.condition}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right">{ri.quantity}</td>
                                    <td className="px-4 py-3 text-right">{formatRp(ri.unitPrice)}</td>
                                    <td className="px-4 py-3 text-right font-medium">{formatRp(ri.lineTotal)}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="border-t bg-muted/30">
                            <tr>
                                <td colSpan={4} className="px-4 py-3 text-right font-semibold">Total</td>
                                <td className="px-4 py-3 text-right font-bold text-base">{formatRp(returnData.totalAmount)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>

            {/* Void Confirm */}
            <Dialog open={showVoid} onOpenChange={open => { if (!open) setShowVoid(false); }}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Void Retur</DialogTitle>
                        <DialogDescription>
                            Yakin void retur <span className="font-semibold text-foreground">{returnData.returnNumber}</span>?
                            Stok akan dikembalikan ke kondisi sebelum retur.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="mt-2">
                        <DialogClose asChild><Button variant="outline" disabled={voiding}>Batal</Button></DialogClose>
                        <Button variant="destructive" disabled={voiding} onClick={handleVoid}>{voiding ? 'Memproses…' : 'Ya, Void'}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
