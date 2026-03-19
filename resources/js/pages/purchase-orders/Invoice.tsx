import { useEffect } from 'react';
import { Head, usePage } from '@inertiajs/react';

interface InvoiceItem {
    name: string;
    code: string | null;
    unitPrice: number;
    quantity: number;
    lineTotal: number;
}

interface PoInvoiceData {
    invoiceNumber: string;
    issuedAt: string;
    poNumber: string;
    date: string;
    expectedDate: string | null;
    status: string;
    supplier: { name: string | null; phone: string | null; address: string | null };
    warehouse: { name: string | null; address: string | null; phone: string | null };
    subtotal: number;
    taxAmount: number;
    grandTotal: number;
    items: InvoiceItem[];
}

interface StoreSettings {
    store_name?: string;
    store_address?: string;
    store_phone?: string;
    store_logo?: string;
    receipt_footer?: string;
}

interface PageProps {
    invoice: PoInvoiceData;
    storeSettings: StoreSettings;
    [key: string]: unknown;
}

const STATUS_LABEL: Record<string, string> = {
    draft: 'Draft', ordered: 'Dipesan', partial: 'Sebagian Diterima',
    received: 'Diterima', cancelled: 'Dibatalkan',
};

function fmt(n: number) {
    return 'Rp ' + n.toLocaleString('id-ID');
}
function fmtDate(iso: string | null) {
    if (!iso) return '-';
    return new Date(iso).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
}

export default function PoInvoice() {
    const { invoice, storeSettings } = usePage<PageProps>().props;

    useEffect(() => {
        const t = setTimeout(() => window.print(), 400);
        return () => clearTimeout(t);
    }, []);

    return (
        <>
            <Head title={`Invoice PO ${invoice.invoiceNumber}`} />
            <div className="inv-root">
                {/* Header */}
                <div className="inv-header">
                    <div className="inv-from">
                        {storeSettings?.store_logo && (
                            <img src={`/storage/${storeSettings.store_logo}`} alt="" className="inv-logo" />
                        )}
                        <div className="inv-store-name">{storeSettings?.store_name ?? 'Toko'}</div>
                        {storeSettings?.store_address && <div className="inv-small">{storeSettings.store_address}</div>}
                        {storeSettings?.store_phone && <div className="inv-small">{storeSettings.store_phone}</div>}
                    </div>
                    <div className="inv-meta-right">
                        <div className="inv-invoice-number">{invoice.invoiceNumber}</div>
                        <div className="inv-meta-row"><span>Tanggal:</span><span>{fmtDate(invoice.issuedAt)}</span></div>
                        <div className="inv-meta-row"><span>No. PO:</span><span>{invoice.poNumber}</span></div>
                        {invoice.expectedDate && (
                            <div className="inv-meta-row"><span>Tgl. Pengiriman:</span><span>{fmtDate(invoice.expectedDate)}</span></div>
                        )}
                        <div className="inv-meta-row">
                            <span>Status:</span>
                            <span>{STATUS_LABEL[invoice.status] ?? invoice.status}</span>
                        </div>
                    </div>
                </div>

                <hr className="inv-divider" />

                {/* To */}
                <div className="inv-to-section">
                    <div className="inv-label">KEPADA (SUPPLIER):</div>
                    <div className="inv-to-name">{invoice.supplier.name ?? '-'}</div>
                    {invoice.supplier.phone && <div className="inv-small">{invoice.supplier.phone}</div>}
                    {invoice.supplier.address && <div className="inv-small">{invoice.supplier.address}</div>}
                </div>

                {/* Warehouse */}
                <div className="inv-to-section">
                    <div className="inv-label">KIRIM KE:</div>
                    <div className="inv-to-name">{invoice.warehouse.name ?? '-'}</div>
                    {invoice.warehouse.address && <div className="inv-small">{invoice.warehouse.address}</div>}
                    {invoice.warehouse.phone && <div className="inv-small">{invoice.warehouse.phone}</div>}
                </div>

                {/* Items */}
                <table className="inv-table">
                    <thead>
                        <tr>
                            <th className="inv-th inv-th-center" style={{ width: '2rem' }}>No</th>
                            <th className="inv-th inv-th-left">Produk</th>
                            <th className="inv-th inv-th-right">Harga Satuan</th>
                            <th className="inv-th inv-th-center" style={{ width: '3rem' }}>Qty</th>
                            <th className="inv-th inv-th-right">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {invoice.items.map((item, i) => (
                            <tr key={i} className="inv-tr">
                                <td className="inv-td inv-td-center">{i + 1}</td>
                                <td className="inv-td">
                                    <div className="inv-item-name">{item.name}</div>
                                </td>
                                <td className="inv-td inv-td-right">{fmt(item.unitPrice)}</td>
                                <td className="inv-td inv-td-center">{item.quantity}</td>
                                <td className="inv-td inv-td-right inv-bold">{fmt(item.lineTotal)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* Totals */}
                <div className="inv-totals-wrap">
                    <div className="inv-totals">
                        <div className="inv-total-row">
                            <span className="inv-muted">Subtotal</span>
                            <span>{fmt(invoice.subtotal)}</span>
                        </div>
                        {invoice.taxAmount > 0 && (
                            <div className="inv-total-row">
                                <span className="inv-muted">Pajak</span>
                                <span>{fmt(invoice.taxAmount)}</span>
                            </div>
                        )}
                        <div className="inv-total-row inv-grand-total">
                            <span>Total</span>
                            <span>{fmt(invoice.grandTotal)}</span>
                        </div>
                    </div>
                </div>

                {/* Signature */}
                <div className="inv-signature">
                    <div className="inv-sig-col">
                        <div className="inv-muted inv-small">Dipesan oleh,</div>
                        <div className="inv-sig-line" />
                        <div className="inv-small">{storeSettings?.store_name ?? 'Toko'}</div>
                    </div>
                    <div className="inv-sig-col">
                        <div className="inv-muted inv-small">Disetujui oleh,</div>
                        <div className="inv-sig-line" />
                        <div className="inv-small">{invoice.supplier.name ?? 'Supplier'}</div>
                    </div>
                </div>

                {storeSettings?.receipt_footer && (
                    <div className="inv-footer">{storeSettings.receipt_footer}</div>
                )}
            </div>

            <style>{`
                * { box-sizing: border-box; margin: 0; padding: 0; }
                body { background: #fff; font-family: 'Inter', system-ui, sans-serif; font-size: 13px; color: #111; }
                .inv-root { max-width: 210mm; margin: 0 auto; padding: 20mm; }
                .inv-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
                .inv-from { flex: 1; }
                .inv-logo { height: 40px; width: auto; margin-bottom: 6px; }
                .inv-store-name { font-size: 16px; font-weight: 700; margin-bottom: 2px; }
                .inv-meta-right { text-align: right; }
                .inv-invoice-number { font-size: 18px; font-weight: 700; margin-bottom: 6px; color: #1d4ed8; }
                .inv-meta-row { display: flex; justify-content: flex-end; gap: 12px; font-size: 12px; margin-bottom: 2px; }
                .inv-meta-row span:first-child { color: #666; }
                .inv-divider { border: none; border-top: 2px solid #111; margin: 12px 0; }
                .inv-small { font-size: 11px; }
                .inv-muted { color: #666; }
                .inv-bold { font-weight: 600; }
                .inv-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #888; margin-bottom: 4px; }
                .inv-to-section { margin-bottom: 12px; }
                .inv-to-name { font-size: 14px; font-weight: 600; }
                .inv-table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
                .inv-th { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.3px; padding: 6px 8px; border-bottom: 1px solid #ddd; border-top: 1px solid #ddd; background: #f9f9f9; }
                .inv-th-left { text-align: left; }
                .inv-th-right { text-align: right; }
                .inv-th-center { text-align: center; }
                .inv-tr { border-bottom: 1px solid #f0f0f0; }
                .inv-td { padding: 8px; vertical-align: top; font-size: 12px; }
                .inv-td-right { text-align: right; }
                .inv-td-center { text-align: center; }
                .inv-item-name { font-weight: 500; }
                .inv-totals-wrap { display: flex; justify-content: flex-end; margin-bottom: 16px; }
                .inv-totals { width: 260px; }
                .inv-total-row { display: flex; justify-content: space-between; padding: 3px 0; font-size: 12px; }
                .inv-grand-total { font-size: 15px; font-weight: 700; border-top: 2px solid #111; border-bottom: 1px solid #ddd; padding: 6px 0; color: #1d4ed8; }
                .inv-signature { display: flex; justify-content: space-between; margin-top: 32px; margin-bottom: 16px; }
                .inv-sig-col { width: 160px; text-align: center; }
                .inv-sig-line { border-bottom: 1px solid #999; margin: 40px 0 6px; }
                .inv-footer { text-align: center; font-size: 11px; color: #888; border-top: 1px dashed #ccc; padding-top: 10px; white-space: pre-wrap; }
                @page { size: A4; margin: 0; }
                @media print { body { margin: 0; } .inv-root { padding: 15mm; max-width: 100%; } }
            `}</style>
        </>
    );
}
