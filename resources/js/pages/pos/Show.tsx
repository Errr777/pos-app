import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import { ArrowLeft, Ban, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';

const breadcrumbs: BreadcrumbItem[] = [
  { title: 'Dashboard', href: '/dashboard' },
  { title: 'Riwayat Penjualan', href: '/pos' },
  { title: 'Detail Transaksi', href: '#' },
];

interface SaleItemRow {
  id: number;
  itemId: number | null;
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
  store_name: string;
  store_address: string | null;
  store_phone: string | null;
  store_logo: string | null;
  receipt_footer: string | null;
}

interface PageProps {
  sale: SaleDetail;
  warehouseCity: string | null;
  warehousePhone: string | null;
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
  return new Date(iso).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function PosShow() {
  const { sale, warehouseCity, warehousePhone, storeSettings } = usePage<PageProps>().props;

  const handleVoid = () => {
    if (!confirm(`Void transaksi ${sale.saleNumber}? Stok akan dikembalikan.`)) return;
    router.post(route('pos.void', { saleHeader: sale.id }));
  };

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title={`Transaksi ${sale.saleNumber}`} />
      <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-4">
        {/* Toolbar */}
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={() => router.visit(route('pos.index'))}>
            <ArrowLeft size={15} className="mr-1" /> Kembali
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => window.open(
              route('pos.print', { saleHeader: sale.id }),
              'nota',
              'width=480,height=700,toolbar=no,location=no,menubar=no,status=no,scrollbars=yes,resizable=yes'
            )}>
              <Printer size={15} className="mr-1" /> Cetak
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.open(
              route('pos.invoice', { saleHeader: sale.id }),
              'invoice',
              'width=900,height=700,toolbar=no,location=no,menubar=no,scrollbars=yes,resizable=yes'
            )}>
              <Printer size={15} className="mr-1" /> Invoice
            </Button>
            {sale.status === 'completed' && (
              <Button variant="destructive" size="sm" onClick={handleVoid}>
                <Ban size={15} className="mr-1" /> Void
              </Button>
            )}
          </div>
        </div>

        {/* Receipt card */}
        <div className="border rounded-xl p-6 space-y-5 bg-background print:border-none print:shadow-none">
          {/* Header */}
          <div className="text-center space-y-1">
            <div className="font-mono text-xl font-bold">{sale.saleNumber}</div>
            <div className="text-sm text-muted-foreground">{formatDate(sale.date)}</div>
            {sale.status === 'void' && (
              <span className="inline-flex px-3 py-1 rounded-full text-xs font-medium bg-rose-100 text-rose-700">VOID</span>
            )}
          </div>

          {/* Meta */}
          <div className="grid grid-cols-2 gap-3 text-sm border rounded-lg p-3 bg-muted/30">
            <div>
              <div className="text-xs text-muted-foreground mb-0.5">Pelanggan</div>
              <div className="font-medium">{sale.customerName}</div>
              {sale.customerPhone && <div className="text-xs text-muted-foreground">{sale.customerPhone}</div>}
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-0.5">Kasir</div>
              <div className="font-medium">{sale.cashier}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-0.5">Outlet</div>
              <div className="font-medium">{sale.warehouseName}</div>
              {warehouseCity && <div className="text-sm text-muted-foreground">{warehouseCity}</div>}
              {warehousePhone && <div className="text-sm text-muted-foreground">{warehousePhone}</div>}
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-0.5">Metode Bayar</div>
              <div className="font-medium">{METHOD_LABEL[sale.paymentMethod] ?? sale.paymentMethod}</div>
            </div>
          </div>

          {/* Items */}
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Item</div>
            <table className="w-full text-sm">
              <thead className="border-b">
                <tr>
                  <th className="text-left pb-2">Produk</th>
                  <th className="text-right pb-2">Harga</th>
                  <th className="text-right pb-2">Qty</th>
                  <th className="text-right pb-2">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {sale.items.map(si => (
                  <tr key={si.id}>
                    <td className="py-2">
                      <div>{si.itemName}</div>
                      {si.itemCode && <div className="text-xs text-muted-foreground">{si.itemCode}</div>}
                      {si.discountAmount > 0 && <div className="text-xs text-rose-500">Diskon: -{formatRp(si.discountAmount)}</div>}
                    </td>
                    <td className="py-2 text-right">{formatRp(si.unitPrice)}</td>
                    <td className="py-2 text-right">{si.quantity}</td>
                    <td className="py-2 text-right font-medium">{formatRp(si.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="border-t pt-3 space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatRp(sale.subtotal)}</span></div>
            {sale.discountAmount > 0 && (
              <div className="flex justify-between text-rose-500"><span>Diskon</span><span>-{formatRp(sale.discountAmount)}</span></div>
            )}
            {sale.taxAmount > 0 && (
              <div className="flex justify-between"><span className="text-muted-foreground">Pajak</span><span>{formatRp(sale.taxAmount)}</span></div>
            )}
            <div className="flex justify-between font-semibold text-base border-t pt-2">
              <span>Total</span><span className="text-primary">{formatRp(sale.grandTotal)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Bayar ({METHOD_LABEL[sale.paymentMethod] ?? sale.paymentMethod})</span>
              <span>{formatRp(sale.paymentAmount)}</span>
            </div>
            {sale.changeAmount > 0 && (
              <div className="flex justify-between font-medium text-emerald-600">
                <span>Kembalian</span><span>{formatRp(sale.changeAmount)}</span>
              </div>
            )}
          </div>

          <div className="border rounded p-3 bg-muted/30 text-sm">
            <span className="text-muted-foreground">Catatan: </span>{sale.note ?? '-'}
          </div>

          {storeSettings?.receipt_footer && (
            <div className="text-center text-xs text-muted-foreground border-t pt-3">
              {storeSettings.receipt_footer}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
