import { useEffect, useRef, useState } from 'react';
import { formatRp, fmtDate, METHOD_LABEL, STATUS_LABEL } from '@/lib/formats';
import { Head, usePage } from '@inertiajs/react';

interface ScheduleRow {
    dueDate: string;
    amountDue: number;
    interestAmount: number;
    lateFeeApplied: number;
    totalDue: number;
    status: string;
}

interface InvoiceItem {
    name: string;
    code: string | null;
    unitPrice: number;
    quantity: number;
    discountAmount: number;
    lineTotal: number;
}

interface InvoiceData {
    invoiceNumber: string;
    issuedAt: string;
    saleNumber: string;
    date: string | null;
    cashier: string | null;
    status: string;
    paymentMethod: string;
    paymentAmount: number;
    changeAmount: number;
    note: string | null;
    paymentSplits: { paymentMethod: string; amount: number }[];
    customer: { name: string; phone: string | null; address: string | null };
    warehouse: { name: string | null; address: string | null; phone: string | null };
    subtotal: number;
    discountAmount: number;
    taxAmount: number;
    grandTotal: number;
    items: InvoiceItem[];
    schedule: ScheduleRow[] | null;
}

interface StoreSettings {
    store_name?: string;
    store_address?: string;
    store_phone?: string;
    store_logo?: string;
    receipt_footer?: string;
}

interface PageProps {
    invoice: InvoiceData;
    storeSettings: StoreSettings;
    [key: string]: unknown;
}



export default function PosInvoice() {
    const { invoice, storeSettings } = usePage<PageProps>().props;

    const isWalkIn = invoice.customer.name === 'Walk-in';
    const [showDialog, setShowDialog] = useState(isWalkIn);
    const [customerName, setCustomerName] = useState(isWalkIn ? '' : invoice.customer.name);
    const [ready, setReady] = useState(!isWalkIn);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (showDialog) inputRef.current?.focus();
    }, [showDialog]);

    useEffect(() => {
        if (!ready) return;
        const t = setTimeout(() => window.print(), 400);
        return () => clearTimeout(t);
    }, [ready]);

    const handlePrint = (name: string) => {
        setCustomerName(name.trim() || 'Walk-in');
        setShowDialog(false);
        setReady(true);
    };

    const dueDate = invoice.schedule
        ? invoice.schedule[invoice.schedule.length - 1]?.dueDate
        : null;

    return (
        <>
            <Head title={`Invoice ${invoice.invoiceNumber}`} />

            {showDialog && (
                <div className="nd-overlay">
                    <div className="nd-box">
                        <div className="nd-title">Nama Penerima Invoice</div>
                        <div className="nd-desc">Tidak ada pelanggan terdaftar. Masukkan nama penerima (opsional).</div>
                        <input
                            ref={inputRef}
                            type="text"
                            className="nd-input"
                            placeholder="Contoh: Budi Santoso"
                            value={customerName}
                            onChange={e => setCustomerName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handlePrint(customerName)}
                        />
                        <div className="nd-actions">
                            <button className="nd-btn-skip" onClick={() => handlePrint('')}>Lewati</button>
                            <button className="nd-btn-print" onClick={() => handlePrint(customerName)}>Cetak Invoice</button>
                        </div>
                    </div>
                </div>
            )}
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
                        <div className="inv-meta-row"><span>Transaksi:</span><span>{invoice.saleNumber}</span></div>
                        {dueDate && (
                            <div className="inv-meta-row"><span>Jatuh Tempo:</span><span>{fmtDate(dueDate)}</span></div>
                        )}
                        {invoice.status === 'void' && <div className="inv-void">VOID</div>}
                    </div>
                </div>

                <hr className="inv-divider" />

                {/* To */}
                <div className="inv-to-section">
                    <div className="inv-label">KEPADA:</div>
                    <div className="inv-to-name">{customerName}</div>
                    {invoice.customer.phone && <div className="inv-small">{invoice.customer.phone}</div>}
                    {invoice.customer.address && <div className="inv-small">{invoice.customer.address}</div>}
                </div>

                {/* Items */}
                <table className="inv-table">
                    <thead>
                        <tr>
                            <th className="inv-th inv-th-center" style={{ width: '2rem' }}>No</th>
                            <th className="inv-th inv-th-left">Produk</th>
                            <th className="inv-th inv-th-right">Harga Satuan</th>
                            <th className="inv-th inv-th-center" style={{ width: '3rem' }}>Qty</th>
                            <th className="inv-th inv-th-right">Diskon</th>
                            <th className="inv-th inv-th-right">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {invoice.items.map((item, i) => (
                            <tr key={i} className="inv-tr">
                                <td className="inv-td inv-td-center">{i + 1}</td>
                                <td className="inv-td">
                                    <div className="inv-item-name">{item.name}</div>
                                    {item.code && <div className="inv-small inv-muted">{item.code}</div>}
                                </td>
                                <td className="inv-td inv-td-right">{formatRp(item.unitPrice)}</td>
                                <td className="inv-td inv-td-center">{item.quantity}</td>
                                <td className="inv-td inv-td-right">
                                    {item.discountAmount > 0 ? <span className="inv-discount">-{formatRp(item.discountAmount)}</span> : '-'}
                                </td>
                                <td className="inv-td inv-td-right inv-bold">{formatRp(item.lineTotal)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* Totals */}
                <div className="inv-totals-wrap">
                    <div className="inv-totals">
                        <div className="inv-total-row">
                            <span className="inv-muted">Subtotal</span>
                            <span>{formatRp(invoice.subtotal)}</span>
                        </div>
                        {invoice.discountAmount > 0 && (
                            <div className="inv-total-row inv-discount">
                                <span>Diskon</span><span>-{formatRp(invoice.discountAmount)}</span>
                            </div>
                        )}
                        {invoice.taxAmount > 0 && (
                            <div className="inv-total-row">
                                <span className="inv-muted">Pajak</span><span>{formatRp(invoice.taxAmount)}</span>
                            </div>
                        )}
                        <div className="inv-total-row inv-grand-total">
                            <span>Total</span><span>{formatRp(invoice.grandTotal)}</span>
                        </div>
                        {invoice.paymentMethod === 'multiple' && invoice.paymentSplits?.length > 0 ? (
                            invoice.paymentSplits.map((sp, i) => (
                                <div key={i} className="inv-total-row inv-muted">
                                    <span>Bayar ({METHOD_LABEL[sp.paymentMethod] ?? sp.paymentMethod})</span>
                                    <span>{formatRp(sp.amount)}</span>
                                </div>
                            ))
                        ) : (
                            <div className="inv-total-row inv-muted">
                                <span>Bayar ({METHOD_LABEL[invoice.paymentMethod] ?? invoice.paymentMethod})</span>
                                <span>{formatRp(invoice.paymentAmount)}</span>
                            </div>
                        )}
                        {invoice.changeAmount > 0 && (
                            <div className="inv-total-row inv-change">
                                <span>Kembalian</span><span>{formatRp(invoice.changeAmount)}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Installment schedule */}
                {invoice.schedule && invoice.schedule.length > 0 && (
                    <div className="inv-schedule">
                        <div className="inv-section-title">Jadwal Cicilan</div>
                        <table className="inv-table">
                            <thead>
                                <tr>
                                    <th className="inv-th inv-th-center" style={{ width: '2rem' }}>No</th>
                                    <th className="inv-th inv-th-left">Jatuh Tempo</th>
                                    <th className="inv-th inv-th-right">Jumlah</th>
                                    <th className="inv-th inv-th-right">Bunga</th>
                                    <th className="inv-th inv-th-left">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {invoice.schedule.map((row, i) => (
                                    <tr key={i} className="inv-tr">
                                        <td className="inv-td inv-td-center">{i + 1}</td>
                                        <td className="inv-td">{i === 0 ? 'Sekarang (DP)' : fmtDate(row.dueDate)}</td>
                                        <td className="inv-td inv-td-right">{formatRp(row.amountDue)}</td>
                                        <td className="inv-td inv-td-right">
                                            {row.interestAmount > 0 ? formatRp(row.interestAmount) : '-'}
                                        </td>
                                        <td className="inv-td">{STATUS_LABEL[row.status] ?? row.status}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Note */}
                {invoice.note && (
                    <div className="inv-note">
                        <span className="inv-muted">Catatan: </span>{invoice.note}
                    </div>
                )}

                {/* Signature */}
                <div className="inv-signature">
                    <div className="inv-sig-col">
                        <div className="inv-muted inv-small">Hormat kami,</div>
                        <div className="inv-sig-line" />
                        <div className="inv-small">{storeSettings?.store_name ?? 'Toko'}</div>
                    </div>
                    <div className="inv-sig-col">
                        <div className="inv-muted inv-small">Penerima,</div>
                        <div className="inv-sig-line" />
                        <div className="inv-small">{customerName}</div>
                    </div>
                </div>

                {/* Footer */}
                {storeSettings?.receipt_footer && (
                    <div className="inv-footer">{storeSettings.receipt_footer}</div>
                )}
            </div>

            <style>{`
                * { box-sizing: border-box; margin: 0; padding: 0; }
                body { background: #fff; font-family: 'Inter', system-ui, sans-serif; font-size: 13px; color: #111; }

                .inv-root { max-width: 210mm; margin: 0 auto; padding: 20mm; }

                /* Header */
                .inv-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
                .inv-from { flex: 1; }
                .inv-logo { height: 40px; width: auto; margin-bottom: 6px; }
                .inv-store-name { font-size: 16px; font-weight: 700; margin-bottom: 2px; }
                .inv-meta-right { text-align: right; }
                .inv-invoice-number { font-size: 18px; font-weight: 700; margin-bottom: 6px; color: #1d4ed8; }
                .inv-meta-row { display: flex; justify-content: flex-end; gap: 12px; font-size: 12px; margin-bottom: 2px; }
                .inv-meta-row span:first-child { color: #666; }
                .inv-void { display: inline-block; margin-top: 6px; padding: 2px 10px; border-radius: 9999px; font-size: 11px; font-weight: 600; background: #fee2e2; color: #b91c1c; }

                .inv-divider { border: none; border-top: 2px solid #111; margin: 12px 0; }
                .inv-small { font-size: 11px; }
                .inv-muted { color: #666; }
                .inv-bold { font-weight: 600; }
                .inv-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #888; margin-bottom: 4px; }

                /* To section */
                .inv-to-section { margin-bottom: 16px; }
                .inv-to-name { font-size: 14px; font-weight: 600; }

                /* Table */
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
                .inv-discount { color: #dc2626; }

                /* Totals */
                .inv-totals-wrap { display: flex; justify-content: flex-end; margin-bottom: 16px; }
                .inv-totals { width: 260px; }
                .inv-total-row { display: flex; justify-content: space-between; padding: 3px 0; font-size: 12px; }
                .inv-grand-total { font-size: 15px; font-weight: 700; border-top: 2px solid #111; border-bottom: 1px solid #ddd; padding: 6px 0; color: #1d4ed8; }
                .inv-change { color: #16a34a; font-weight: 600; }

                /* Schedule */
                .inv-schedule { margin-bottom: 16px; }
                .inv-section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #888; margin-bottom: 6px; }

                /* Note */
                .inv-note { border: 1px solid #e5e7eb; border-radius: 4px; padding: 8px 10px; font-size: 12px; margin-bottom: 16px; }

                /* Signature */
                .inv-signature { display: flex; justify-content: space-between; margin-top: 32px; margin-bottom: 16px; }
                .inv-sig-col { width: 160px; text-align: center; }
                .inv-sig-line { border-bottom: 1px solid #999; margin: 40px 0 6px; }

                /* Footer */
                .inv-footer { text-align: center; font-size: 11px; color: #888; border-top: 1px dashed #ccc; padding-top: 10px; white-space: pre-wrap; }

                /* Name dialog */
                .nd-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.55); display: flex; align-items: center; justify-content: center; z-index: 9999; }
                .nd-box { background: #fff; border-radius: 10px; padding: 28px 24px; width: 360px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); }
                .nd-title { font-size: 16px; font-weight: 700; margin-bottom: 8px; }
                .nd-desc { font-size: 13px; color: #666; margin-bottom: 16px; line-height: 1.5; }
                .nd-input { width: 100%; border: 1px solid #d1d5db; border-radius: 6px; padding: 9px 12px; font-size: 14px; outline: none; box-sizing: border-box; }
                .nd-input:focus { border-color: #1d4ed8; box-shadow: 0 0 0 3px rgba(29,78,216,0.12); }
                .nd-actions { display: flex; gap: 8px; margin-top: 16px; justify-content: flex-end; }
                .nd-btn-skip { padding: 8px 16px; border: 1px solid #d1d5db; border-radius: 6px; background: #fff; font-size: 13px; cursor: pointer; color: #374151; }
                .nd-btn-skip:hover { background: #f3f4f6; }
                .nd-btn-print { padding: 8px 18px; border: none; border-radius: 6px; background: #1d4ed8; color: #fff; font-size: 13px; font-weight: 600; cursor: pointer; }
                .nd-btn-print:hover { background: #1e40af; }

                @page { size: A4; margin: 0; }
                @media print {
                    body { margin: 0; }
                    .inv-root { padding: 15mm; max-width: 100%; }
                    .nd-overlay { display: none; }
                }
            `}</style>
        </>
    );
}
