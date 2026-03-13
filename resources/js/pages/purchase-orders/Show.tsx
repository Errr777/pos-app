import { useState } from 'react';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import { ArrowLeft, XCircle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

const breadcrumbs: BreadcrumbItem[] = [
  { title: 'Dashboard', href: '/dashboard' },
  { title: 'Purchase Order', href: '/purchase-orders' },
  { title: 'Detail PO', href: '#' },
];

interface PoItemRow {
  id: number;
  itemId: number | null;
  itemName: string;
  orderedQty: number;
  receivedQty: number;
  pendingQty: number;
  unitPrice: number;
  lineTotal: number;
}

interface PoDetail {
  id: number;
  poNumber: string;
  supplierName: string;
  warehouseName: string;
  orderedBy: string;
  receivedBy: string | null;
  status: string;
  orderedAt: string | null;
  expectedAt: string | null;
  receivedAt: string | null;
  subtotal: number;
  grandTotal: number;
  note: string | null;
  items: PoItemRow[];
}

interface PageProps {
  po: PoDetail;
  [key: string]: unknown;
}

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  draft:     { label: 'Draft',      cls: 'bg-slate-100 text-slate-600' },
  ordered:   { label: 'Dipesan',    cls: 'bg-indigo-100 text-indigo-700' },
  partial:   { label: 'Sebagian',   cls: 'bg-amber-100 text-amber-700' },
  received:  { label: 'Diterima',   cls: 'bg-emerald-100 text-emerald-700' },
  cancelled: { label: 'Dibatalkan', cls: 'bg-rose-100 text-rose-700' },
};

function formatRp(n: number) { return 'Rp ' + n.toLocaleString('id-ID'); }
function formatDate(iso: string | null) {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
}

export default function PurchaseOrderShow() {
  const { po } = usePage<PageProps>().props;
  const sc = STATUS_CONFIG[po.status] ?? { label: po.status, cls: 'bg-slate-100 text-slate-600' };

  const canReceive = po.status === 'ordered' || po.status === 'partial';
  const canCancel  = po.status === 'draft'   || po.status === 'ordered';
  const canOrder   = po.status === 'draft';

  // Receive form state — one receive_qty per PO item
  const [receiveQtys, setReceiveQtys] = useState<Record<number, number>>(
    Object.fromEntries(po.items.map(i => [i.id, i.pendingQty]))
  );
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors]         = useState<Record<string, string>>({});

  const handleReceive = () => {
    setSubmitting(true);
    setErrors({});
    const receivePayload = po.items
      .filter(i => i.pendingQty > 0)
      .map(i => ({ purchase_order_item_id: i.id, received_qty: receiveQtys[i.id] ?? 0 }));

    router.post(route('po.receive', { purchaseOrder: po.id }), { items: receivePayload }, {
      onSuccess: () => setSubmitting(false),
      onError:   (errs) => { setErrors(errs); setSubmitting(false); },
    });
  };

  const handleStatusChange = (newStatus: string) => {
    router.post(route('po.status', { purchaseOrder: po.id }), { status: newStatus });
  };

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title={`PO ${po.poNumber}`} />
      <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-4">
        {/* Toolbar */}
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={() => router.visit(route('po.index'))}>
            <ArrowLeft size={15} className="mr-1" /> Kembali
          </Button>
          <div className="flex gap-2">
            {canOrder && (
              <Button size="sm" variant="outline" onClick={() => handleStatusChange('ordered')}>
                <CheckCircle size={15} className="mr-1" /> Tandai Dipesan
              </Button>
            )}
            {canCancel && (
              <Button size="sm" variant="outline" onClick={() => { if (confirm('Batalkan PO ini?')) handleStatusChange('cancelled'); }}>
                <XCircle size={15} className="mr-1" /> Batalkan
              </Button>
            )}
          </div>
        </div>

        {/* PO Header */}
        <div className="border rounded-xl p-5 space-y-4 bg-background">
          <div className="flex items-start justify-between">
            <div>
              <div className="font-mono text-lg font-bold">{po.poNumber}</div>
              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium mt-1 ${sc.cls}`}>{sc.label}</span>
            </div>
            <div className="text-right text-sm">
              <div className="text-muted-foreground">Total</div>
              <div className="font-bold text-xl text-primary">{formatRp(po.grandTotal)}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
            {[
              { label: 'Supplier',     value: po.supplierName },
              { label: 'Outlet',       value: po.warehouseName },
              { label: 'Dibuat oleh',  value: po.orderedBy },
              { label: 'Tgl. Pesan',   value: formatDate(po.orderedAt) },
              { label: 'Exp. Terima',  value: formatDate(po.expectedAt) },
              { label: 'Tgl. Terima',  value: formatDate(po.receivedAt) },
            ].map(({ label, value }) => (
              <div key={label}>
                <div className="text-xs text-muted-foreground mb-0.5">{label}</div>
                <div className="font-medium">{value}</div>
              </div>
            ))}
          </div>
          {po.note && (
            <div className="bg-muted/40 rounded p-2 text-sm">
              <span className="text-muted-foreground">Catatan: </span>{po.note}
            </div>
          )}
        </div>

        {/* Items Table */}
        <div className="border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Item</th>
                <th className="text-right px-4 py-3 font-medium">Harga</th>
                <th className="text-right px-4 py-3 font-medium">Dipesan</th>
                <th className="text-right px-4 py-3 font-medium">Diterima</th>
                <th className="text-right px-4 py-3 font-medium">Sisa</th>
                <th className="text-right px-4 py-3 font-medium">Subtotal</th>
                {canReceive && <th className="text-right px-4 py-3 font-medium">Terima</th>}
              </tr>
            </thead>
            <tbody className="divide-y">
              {po.items.map(pi => (
                <tr key={pi.id}>
                  <td className="px-4 py-3 font-medium">{pi.itemName}</td>
                  <td className="px-4 py-3 text-right">{formatRp(pi.unitPrice)}</td>
                  <td className="px-4 py-3 text-right">{pi.orderedQty}</td>
                  <td className="px-4 py-3 text-right text-emerald-600">{pi.receivedQty}</td>
                  <td className="px-4 py-3 text-right">{pi.pendingQty > 0 ? <span className="text-amber-600">{pi.pendingQty}</span> : <span className="text-muted-foreground">0</span>}</td>
                  <td className="px-4 py-3 text-right">{formatRp(pi.lineTotal)}</td>
                  {canReceive && (
                    <td className="px-4 py-3 text-right">
                      {pi.pendingQty > 0 ? (
                        <input type="number" min={0} max={pi.pendingQty}
                          className="w-20 border border-border rounded px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-primary"
                          value={receiveQtys[pi.id] ?? pi.pendingQty}
                          onChange={e => setReceiveQtys(q => ({ ...q, [pi.id]: Math.min(pi.pendingQty, parseInt(e.target.value) || 0) }))} />
                      ) : <span className="text-muted-foreground text-xs">Selesai</span>}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Receive Button */}
        {canReceive && (
          <div className="flex justify-end gap-3">
            {Object.keys(errors).length > 0 && (
              <p className="text-sm text-red-500 mr-auto">{Object.values(errors)[0]}</p>
            )}
            <Button disabled={submitting} onClick={handleReceive}>
              {submitting ? 'Memproses…' : 'Terima Barang'}
            </Button>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
