import { useEffect } from 'react';

interface DOItem {
    id: number;
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

interface Props { order: DeliveryOrderData; }

const fmt = (v: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v);

function fmtDate(iso: string | null) {
    if (!iso) return '-';
    return new Date(iso).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
}

const STATUS_LABEL: Record<string, string> = {
    pending:   'PENDING',
    confirmed: 'DIKONFIRMASI',
    cancelled: 'DIBATALKAN',
};

export default function PrintDeliveryOrder({ order }: Props) {
    useEffect(() => {
        window.print();
    }, []);

    return (
        <>
            <style>{`
                @media print {
                    body { margin: 0; }
                    .no-print { display: none !important; }
                    @page { size: A4; margin: 15mm; }
                }
                body { font-family: Arial, sans-serif; font-size: 12px; color: #111; }
            `}</style>

            {/* Back button — hidden on print */}
            <div className="no-print p-4">
                <button
                    onClick={() => window.history.back()}
                    className="text-sm text-blue-600 hover:underline"
                >
                    ← Kembali
                </button>
                <button
                    onClick={() => window.print()}
                    className="ml-4 px-3 py-1.5 bg-gray-800 text-white text-sm rounded hover:bg-gray-700"
                >
                    Cetak
                </button>
            </div>

            <div className="mx-auto max-w-3xl p-8 print:p-0">
                {/* Header */}
                <div className="border-b-2 border-black pb-4 mb-4">
                    <div className="flex items-start justify-between">
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight">SURAT JALAN</h1>
                            <p className="text-sm text-gray-500">Delivery Order</p>
                        </div>
                        <div className="text-right">
                            <div className="font-bold text-lg font-mono">{order.doNumber}</div>
                            <div className="text-sm text-gray-600">Tanggal: {fmtDate(order.sentAt)}</div>
                            <div className={`mt-1 inline-block px-2 py-0.5 text-xs font-bold border-2 ${
                                order.status === 'confirmed' ? 'border-green-600 text-green-700' :
                                order.status === 'cancelled' ? 'border-red-600 text-red-700' :
                                'border-amber-500 text-amber-700'
                            }`}>
                                {STATUS_LABEL[order.status] ?? order.status.toUpperCase()}
                            </div>
                        </div>
                    </div>
                </div>

                {/* From / To */}
                <div className="grid grid-cols-2 gap-6 mb-6">
                    <div>
                        <div className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Pengirim</div>
                        <div className="font-bold">{order.fromWarehouse?.name ?? '-'}</div>
                        {order.fromWarehouse?.location && (
                            <div className="text-sm text-gray-600">{order.fromWarehouse.location}</div>
                        )}
                        {order.fromWarehouse?.city && (
                            <div className="text-sm text-gray-600">{order.fromWarehouse.city}</div>
                        )}
                        {order.fromWarehouse?.phone && (
                            <div className="text-sm text-gray-600">Telp: {order.fromWarehouse.phone}</div>
                        )}
                        <div className="mt-1 text-sm">Dikirim oleh: <span className="font-medium">{order.senderName}</span></div>
                    </div>
                    <div>
                        <div className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Penerima</div>
                        <div className="font-bold">{order.toWarehouse?.name ?? '-'}</div>
                        {order.toWarehouse?.location && (
                            <div className="text-sm text-gray-600">{order.toWarehouse.location}</div>
                        )}
                        {order.toWarehouse?.city && (
                            <div className="text-sm text-gray-600">{order.toWarehouse.city}</div>
                        )}
                        {order.toWarehouse?.phone && (
                            <div className="text-sm text-gray-600">Telp: {order.toWarehouse.phone}</div>
                        )}
                        {order.recipientName && (
                            <div className="mt-1 text-sm">Diterima oleh: <span className="font-medium">{order.recipientName}</span></div>
                        )}
                        {order.confirmedAt && (
                            <div className="text-sm text-gray-600">Tgl diterima: {fmtDate(order.confirmedAt)}</div>
                        )}
                    </div>
                </div>

                {order.note && (
                    <div className="mb-4 p-2 border border-gray-300 rounded text-sm">
                        <span className="font-medium">Catatan:</span> {order.note}
                    </div>
                )}

                {/* Items table */}
                <table className="w-full border-collapse border border-gray-400 text-sm mb-6">
                    <thead>
                        <tr className="bg-gray-100">
                            <th className="border border-gray-400 px-3 py-2 text-left w-8">No.</th>
                            <th className="border border-gray-400 px-3 py-2 text-left">Kode</th>
                            <th className="border border-gray-400 px-3 py-2 text-left">Nama Produk</th>
                            <th className="border border-gray-400 px-3 py-2 text-center w-16">Qty Kirim</th>
                            {order.status === 'confirmed' && (
                                <th className="border border-gray-400 px-3 py-2 text-center w-16">Qty Terima</th>
                            )}
                            <th className="border border-gray-400 px-3 py-2 text-right w-28">Harga Satuan</th>
                            <th className="border border-gray-400 px-3 py-2 text-right w-28">Subtotal</th>
                        </tr>
                    </thead>
                    <tbody>
                        {order.items.map((it, idx) => (
                            <tr key={it.id} className={idx % 2 === 0 ? '' : 'bg-gray-50'}>
                                <td className="border border-gray-400 px-3 py-2 text-center">{idx + 1}</td>
                                <td className="border border-gray-400 px-3 py-2 font-mono text-xs">{it.itemCode}</td>
                                <td className="border border-gray-400 px-3 py-2">{it.itemName}</td>
                                <td className="border border-gray-400 px-3 py-2 text-center">{it.quantity}</td>
                                {order.status === 'confirmed' && (
                                    <td className="border border-gray-400 px-3 py-2 text-center font-medium">
                                        {it.quantityReceived ?? 0}
                                    </td>
                                )}
                                <td className="border border-gray-400 px-3 py-2 text-right">{fmt(it.unitPrice)}</td>
                                <td className="border border-gray-400 px-3 py-2 text-right font-medium">{fmt(it.subtotal)}</td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr className="bg-gray-100">
                            <td colSpan={order.status === 'confirmed' ? 6 : 5} className="border border-gray-400 px-3 py-2 text-right font-bold">
                                Total Nilai
                            </td>
                            <td className="border border-gray-400 px-3 py-2 text-right font-bold">
                                {fmt(order.grandTotal)}
                            </td>
                        </tr>
                    </tfoot>
                </table>

                {/* Signatures */}
                <div className="grid grid-cols-2 gap-12 mt-8">
                    <div className="text-center">
                        <div className="text-sm font-medium mb-12">Pengirim</div>
                        <div className="border-t border-black pt-1">
                            <div className="font-medium">{order.senderName}</div>
                            <div className="text-xs text-gray-500">{order.fromWarehouse?.name}</div>
                        </div>
                    </div>
                    <div className="text-center">
                        <div className="text-sm font-medium mb-12">Penerima</div>
                        <div className="border-t border-black pt-1">
                            <div className="font-medium">{order.recipientName ?? '( _________________ )'}</div>
                            <div className="text-xs text-gray-500">{order.toWarehouse?.name}</div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="mt-8 pt-3 border-t border-gray-300 text-xs text-gray-400 text-center">
                    Dicetak dari sistem POS · {order.doNumber} · {fmtDate(order.createdAt)}
                </div>
            </div>
        </>
    );
}
