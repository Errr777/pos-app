import { useEffect } from 'react';
import { Head, usePage } from '@inertiajs/react';

interface SaleItemRow {
  id: number;
  itemName: string;
  itemCode: string | null;
  unitPrice: number;
  quantity: number;
  discountAmount: number;
  lineTotal: number;
}

interface SaleDetail {
  id: number;
  saleNumber: string;
  date: string | null;
  cashier: string;
  customerName: string;
  customerPhone: string | null;
  warehouseName: string;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  grandTotal: number;
  paymentMethod: string;
  paymentAmount: number;
  changeAmount: number;
  status: string;
  note: string | null;
  items: SaleItemRow[];
}

interface StoreSettings {
  store_name?: string;
  store_address?: string;
  store_phone?: string;
  receipt_footer?: string;
}

interface PageProps {
  sale: SaleDetail;
  storeSettings: StoreSettings;
  [key: string]: unknown;
}

const METHOD_LABEL: Record<string, string> = {
  cash: 'Tunai', transfer: 'Transfer Bank', qris: 'QRIS', card: 'Kartu', credit: 'Kredit',
};

function formatRp(n: number) {
  return 'Rp ' + n.toLocaleString('id-ID');
}

function formatDate(iso: string | null) {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('id-ID', {
    day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export default function PosPrint() {
  const { sale, storeSettings } = usePage<PageProps>().props;

  useEffect(() => {
    const root = document.querySelector('.nota-root') as HTMLElement | null;
    if (root) {
      const heightMm = Math.ceil(root.offsetHeight * 25.4 / 96) + 8;
      const style = document.createElement('style');
      style.id = 'dynamic-page-size';
      style.textContent = `@page { size: 80mm ${heightMm}mm; margin: 0; }`;
      document.head.appendChild(style);
    }
    const timeout = setTimeout(() => window.print(), 400);
    return () => clearTimeout(timeout);
  }, []);

  return (
    <>
      <Head title={`Nota ${sale.saleNumber}`} />
      <div className="nota-root">
        {/* Store header */}
        {storeSettings?.store_name && (
          <div className="nota-header">
            <div className="nota-store-name">{storeSettings.store_name}</div>
            {storeSettings.store_address && <div className="nota-small">{storeSettings.store_address}</div>}
            {storeSettings.store_phone && <div className="nota-small">{storeSettings.store_phone}</div>}
            <hr className="nota-divider" />
          </div>
        )}

        {/* Sale number + date */}
        <div className="nota-center">
          <div className="nota-sale-number">{sale.saleNumber}</div>
          <div className="nota-small nota-muted">{formatDate(sale.date)}</div>
          {sale.status === 'void' && <div className="nota-void">VOID</div>}
        </div>

        {/* Meta grid */}
        <div className="nota-meta">
          <div>
            <div className="nota-label">Pelanggan</div>
            <div className="nota-value">{sale.customerName}</div>
            {sale.customerPhone && <div className="nota-small nota-muted">{sale.customerPhone}</div>}
          </div>
          <div>
            <div className="nota-label">Kasir</div>
            <div className="nota-value">{sale.cashier}</div>
          </div>
          <div>
            <div className="nota-label">Outlet</div>
            <div className="nota-value">{sale.warehouseName}</div>
          </div>
          <div>
            <div className="nota-label">Metode Bayar</div>
            <div className="nota-value">{METHOD_LABEL[sale.paymentMethod] ?? sale.paymentMethod}</div>
          </div>
        </div>

        {/* Items */}
        <div className="nota-section-label">ITEM</div>
        <table className="nota-table">
          <thead>
            <tr>
              <th className="nota-th nota-th-left">Produk</th>
              <th className="nota-th nota-th-right">Harga</th>
              <th className="nota-th nota-th-right">Qty</th>
              <th className="nota-th nota-th-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {sale.items.map(si => (
              <tr key={si.id} className="nota-tr">
                <td className="nota-td">
                  <div>{si.itemName}</div>
                  {si.itemCode && <div className="nota-small nota-muted">{si.itemCode}</div>}
                  {si.discountAmount > 0 && (
                    <div className="nota-small nota-discount">Diskon: -{formatRp(si.discountAmount)}</div>
                  )}
                </td>
                <td className="nota-td nota-td-right">{formatRp(si.unitPrice)}</td>
                <td className="nota-td nota-td-right">{si.quantity}</td>
                <td className="nota-td nota-td-right nota-bold">{formatRp(si.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="nota-totals">
          <div className="nota-total-row">
            <span className="nota-muted">Subtotal</span>
            <span>{formatRp(sale.subtotal)}</span>
          </div>
          {sale.discountAmount > 0 && (
            <div className="nota-total-row nota-discount">
              <span>Diskon</span>
              <span>-{formatRp(sale.discountAmount)}</span>
            </div>
          )}
          {sale.taxAmount > 0 && (
            <div className="nota-total-row">
              <span className="nota-muted">Pajak</span>
              <span>{formatRp(sale.taxAmount)}</span>
            </div>
          )}
          <div className="nota-total-row nota-grand-total">
            <span>Total</span>
            <span>{formatRp(sale.grandTotal)}</span>
          </div>
          <div className="nota-total-row nota-muted">
            <span>Bayar ({METHOD_LABEL[sale.paymentMethod] ?? sale.paymentMethod})</span>
            <span>{formatRp(sale.paymentAmount)}</span>
          </div>
          {sale.changeAmount > 0 && (
            <div className="nota-total-row nota-change">
              <span>Kembalian</span>
              <span>{formatRp(sale.changeAmount)}</span>
            </div>
          )}
        </div>

        {/* Note */}
        <div className="nota-note">
          <span className="nota-muted">Catatan: </span>{sale.note ?? '-'}
        </div>

        {/* Footer */}
        {storeSettings?.receipt_footer && (
          <div className="nota-footer">{storeSettings.receipt_footer}</div>
        )}
      </div>

      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #fff; }

        .nota-root {
          font-family: 'Courier New', Courier, monospace;
          font-size: 13px;
          max-width: 360px;
          margin: 0 auto;
          padding: 20px 16px;
          color: #111;
        }

        .nota-header { text-align: center; margin-bottom: 12px; }
        .nota-store-name { font-size: 15px; font-weight: 700; }
        .nota-center { text-align: center; margin-bottom: 12px; }
        .nota-sale-number { font-size: 17px; font-weight: 700; letter-spacing: 0.5px; margin-bottom: 2px; }
        .nota-void {
          display: inline-block;
          margin-top: 4px;
          padding: 2px 10px;
          border-radius: 9999px;
          font-size: 11px;
          font-weight: 600;
          background: #fee2e2;
          color: #b91c1c;
        }

        .nota-divider { border: none; border-top: 1px dashed #ccc; margin: 8px 0; }
        .nota-small { font-size: 11px; }
        .nota-muted { color: #666; }
        .nota-label { font-size: 10px; color: #888; margin-bottom: 1px; text-transform: uppercase; letter-spacing: 0.3px; }
        .nota-value { font-weight: 600; font-size: 13px; }
        .nota-bold { font-weight: 700; }
        .nota-discount { color: #dc2626; }
        .nota-change { color: #16a34a; font-weight: 600; }

        .nota-meta {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          padding: 10px;
          margin-bottom: 14px;
          background: #fafafa;
        }

        .nota-section-label {
          font-size: 10px;
          font-weight: 700;
          color: #888;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          margin-bottom: 6px;
        }

        .nota-table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
        .nota-th { font-size: 12px; font-weight: 700; padding-bottom: 6px; border-bottom: 1px solid #ddd; }
        .nota-th-left { text-align: left; }
        .nota-th-right { text-align: right; }
        .nota-tr { border-bottom: 1px solid #f0f0f0; }
        .nota-td { padding: 6px 0; vertical-align: top; }
        .nota-td-right { text-align: right; padding-left: 8px; }

        .nota-totals { border-top: 1px solid #ddd; padding-top: 10px; margin-bottom: 12px; }
        .nota-total-row {
          display: flex;
          justify-content: space-between;
          font-size: 13px;
          margin-bottom: 4px;
        }
        .nota-grand-total {
          font-size: 15px;
          font-weight: 700;
          border-top: 1px solid #ddd;
          padding-top: 6px;
          margin-top: 4px;
          color: #2563eb;
        }

        .nota-note {
          border: 1px solid #e5e7eb;
          border-radius: 4px;
          padding: 8px 10px;
          font-size: 12px;
          background: #fafafa;
          margin-bottom: 12px;
        }

        .nota-footer {
          text-align: center;
          font-size: 11px;
          color: #888;
          border-top: 1px dashed #ccc;
          padding-top: 10px;
          white-space: pre-wrap;
        }

        @page {
          size: 80mm auto;
          margin: 0;
        }
        @media print {
          html, body { width: 80mm; margin: 0; }
          .nota-root { width: 72mm; padding: 4mm; max-width: 100%; }
        }
      `}</style>
    </>
  );
}
