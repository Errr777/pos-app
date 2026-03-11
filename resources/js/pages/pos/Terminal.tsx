import { useState, useMemo, useRef } from 'react';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import { Search, Plus, Minus, Trash2, ShoppingCart, ReceiptText, ChevronDown, LayoutGrid, List } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter, DialogClose,
} from '@/components/ui/dialog';

const breadcrumbs: BreadcrumbItem[] = [
  { title: 'Dashboard', href: '/dashboard' },
  { title: 'Kasir', href: '/pos/terminal' },
];

interface ItemOption {
  id: number;
  name: string;
  code: string;
  category: string | null;
  categoryId: number | null;
  stock: number;
  price: number;
  tagIds: number[];
}

interface Promotion {
  id: number;
  name: string;
  type: 'percentage' | 'fixed';
  value: number;
  appliesTo: 'all' | 'category' | 'item' | 'tag';
  appliesId: number | null;
  minPurchase: number;
  maxDiscount: number;
}

interface CustomerOption {
  id: number;
  name: string;
  code: string | null;
}

interface WarehouseOption {
  id: number;
  name: string;
  code: string;
  isDefault: boolean;
}

interface CartItem {
  itemId: number;
  name: string;
  code: string;
  unitPrice: number;
  quantity: number;
  discountAmount: number;
  availableStock: number;
  promoName: string | null;
}

interface PageProps {
  items: ItemOption[];
  customers: CustomerOption[];
  warehouses: WarehouseOption[];
  promotions: Promotion[];
  [key: string]: unknown;
}

const PAYMENT_METHODS = ['cash', 'transfer', 'qris', 'card'];
const METHOD_LABEL: Record<string, string> = {
  cash: 'Tunai', transfer: 'Transfer Bank', qris: 'QRIS', card: 'Kartu',
};

function formatRp(n: number) {
  return 'Rp ' + n.toLocaleString('id-ID');
}

export default function PosTerminal() {
  const { items, customers, warehouses, promotions = [] } = usePage<PageProps>().props;

  const defaultWarehouse = warehouses.find(w => w.isDefault) ?? warehouses[0];
  const [warehouseId, setWarehouseId] = useState(defaultWarehouse?.id ?? null);

  const [search, setSearch]     = useState('');
  const [cart, setCart]         = useState<CartItem[]>([]);
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [payMethod, setPayMethod] = useState('cash');
  const [payAmount, setPayAmount] = useState('');
  const [discount, setDiscount] = useState('');
  const [note, setNote]         = useState('');
  const [date, setDate]         = useState(() => new Date().toISOString().slice(0, 10));
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors]     = useState<Record<string, string>>({});

  const [receiptModal, setReceiptModal] = useState<{ saleNumber: string; grandTotal: number; changeAmount: number } | null>(null);
  const [density, setDensity] = useState<'grid' | 'compact'>('grid');

  const searchRef = useRef<HTMLInputElement>(null);

  function getBestPromo(item: ItemOption, quantity: number, promos: Promotion[]): { promo: Promotion; discount: number } | null {
    const lineTotal = item.price * quantity;
    let best: { promo: Promotion; discount: number } | null = null;

    for (const p of promos) {
      if (p.appliesTo === 'item' && p.appliesId !== item.id) continue;
      if (p.appliesTo === 'category' && p.appliesId !== item.categoryId) continue;
      if (p.appliesTo === 'tag' && !item.tagIds.includes(p.appliesId!)) continue;
      if (p.minPurchase > 0 && lineTotal < p.minPurchase) continue;

      let discount = p.type === 'percentage'
        ? Math.round(lineTotal * p.value / 100)
        : p.value;

      if (p.maxDiscount > 0) discount = Math.min(discount, p.maxDiscount);
      discount = Math.min(discount, lineTotal);

      if (!best || discount > best.discount) {
        best = { promo: p, discount };
      }
    }
    return best;
  }

  const filteredItems = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return items;
    return items.filter(i =>
      i.name.toLowerCase().includes(q) || i.code.toLowerCase().includes(q)
    );
  }, [items, search]);

  const addToCart = (item: ItemOption) => {
    setCart(prev => {
      const existing = prev.find(c => c.itemId === item.id);
      if (existing) {
        if (existing.quantity >= item.stock) return prev;
        const newQty = existing.quantity + 1;
        const itemData = items.find(i => i.id === item.id) ?? item;
        const best = getBestPromo(itemData, newQty, promotions);
        return prev.map(c => c.itemId === item.id
          ? { ...c, quantity: newQty, discountAmount: best?.discount ?? c.discountAmount, promoName: best?.promo.name ?? c.promoName }
          : c);
      }
      if (item.stock <= 0) return prev;
      const best = getBestPromo(item, 1, promotions);
      return [...prev, {
        itemId: item.id, name: item.name, code: item.code,
        unitPrice: item.price, quantity: 1,
        discountAmount: best?.discount ?? 0,
        promoName: best?.promo.name ?? null,
        availableStock: item.stock,
      }];
    });
  };

  const updateQty = (itemId: number, delta: number) => {
    setCart(prev => prev.map(c => {
      if (c.itemId !== itemId) return c;
      const newQty = Math.max(1, Math.min(c.availableStock, c.quantity + delta));
      const item = items.find(i => i.id === itemId);
      const best = item ? getBestPromo(item, newQty, promotions) : null;
      return { ...c, quantity: newQty, discountAmount: best?.discount ?? 0, promoName: best?.promo.name ?? null };
    }));
  };

  const updateDiscount = (itemId: number, val: string) => {
    setCart(prev => prev.map(c => c.itemId === itemId ? { ...c, discountAmount: parseInt(val) || 0 } : c));
  };

  const removeFromCart = (itemId: number) => {
    setCart(prev => prev.filter(c => c.itemId !== itemId));
  };

  const subtotal = cart.reduce((sum, c) => sum + c.unitPrice * c.quantity - c.discountAmount, 0);
  const discountTotal = parseInt(discount) || 0;
  const grandTotal = Math.max(0, subtotal - discountTotal);
  const paid = parseInt(payAmount) || 0;
  const change = Math.max(0, paid - grandTotal);

  const handleCheckout = () => {
    if (cart.length === 0) return;
    setSubmitting(true);
    setErrors({});

    router.post(route('pos.store'), {
      warehouse_id:    warehouseId,
      customer_id:     customerId,
      occurred_at:     date + ' ' + new Date().toTimeString().slice(0, 8),
      payment_method:  payMethod,
      payment_amount:  paid,
      discount_amount: discountTotal,
      note,
      items: cart.map(c => ({
        item_id:         c.itemId,
        quantity:        c.quantity,
        unit_price:      c.unitPrice,
        discount_amount: c.discountAmount,
      })),
    }, {
      onSuccess: (page) => {
        const flash = (page.props as Record<string, unknown>).flash as Record<string, string> | undefined;
        setReceiptModal({ saleNumber: flash?.sale_number ?? '', grandTotal, changeAmount: change });
        setCart([]);
        setPayAmount('');
        setDiscount('');
        setNote('');
        setSubmitting(false);
      },
      onError: (errs) => { setErrors(errs); setSubmitting(false); },
    });
  };

  const resetCart = () => {
    setCart([]);
    setPayAmount('');
    setDiscount('');
    setNote('');
    setErrors({});
    setReceiptModal(null);
    searchRef.current?.focus();
  };

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title="Terminal POS" />
      <div className="flex h-[calc(100vh-4rem)] overflow-hidden">

        {/* ── Left: Item Catalog ────────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden border-r">
          {/* Top bar */}
          <div className="p-3 border-b flex gap-2">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input ref={searchRef} type="text" placeholder="Cari nama atau kode item…"
                className="pl-8 pr-3 py-2 text-sm border border-border rounded w-full focus:outline-none focus:ring-2 focus:ring-primary"
                value={search} onChange={e => setSearch(e.target.value)} autoFocus />
            </div>
            <select className="text-sm border border-border rounded px-2 focus:outline-none focus:ring-2 focus:ring-primary"
              value={warehouseId ?? ''} onChange={e => setWarehouseId(parseInt(e.target.value))}>
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
            <div className="flex gap-1">
              <button
                onClick={() => setDensity('grid')}
                className={`p-1.5 rounded ${density === 'grid' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
                title="Tampilan grid"
              >
                <LayoutGrid size={15} />
              </button>
              <button
                onClick={() => setDensity('compact')}
                className={`p-1.5 rounded ${density === 'compact' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
                title="Tampilan list"
              >
                <List size={15} />
              </button>
            </div>
          </div>

          {/* Item grid / compact list */}
          <div className="flex-1 overflow-y-auto p-3">
            {density === 'compact' ? (
              <div className="flex flex-col divide-y">
                {filteredItems.map(item => (
                  <button key={item.id}
                    onClick={() => addToCart(item)}
                    disabled={item.stock <= 0}
                    className={`text-left px-3 py-2 flex items-center justify-between transition hover:bg-primary/5 ${
                      item.stock <= 0 ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
                    }`}
                  >
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-medium leading-tight truncate">{item.name}</span>
                      <span className="text-xs text-muted-foreground">{item.code}</span>
                    </div>
                    <div className="flex items-center gap-4 shrink-0 ml-3">
                      <span className={`text-xs ${item.stock <= 5 ? 'text-amber-600' : 'text-muted-foreground'}`}>Stok: {item.stock}</span>
                      <span className="text-sm font-bold text-primary">{formatRp(item.price)}</span>
                    </div>
                  </button>
                ))}
                {filteredItems.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">Tidak ada item ditemukan</div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-2">
                {filteredItems.map(item => (
                  <button key={item.id}
                    onClick={() => addToCart(item)}
                    disabled={item.stock <= 0}
                    className={`text-left border rounded-lg p-3.5 transition-all hover:shadow-md hover:border-primary ${
                      item.stock <= 0 ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:bg-primary/5'
                    }`}
                  >
                    <div className="font-medium text-base leading-tight line-clamp-2">{item.name}</div>
                    <div className="text-xs text-muted-foreground mt-1">{item.code}</div>
                    <div className="mt-2 flex items-end justify-between">
                      <span className="text-base font-bold text-primary">{formatRp(item.price)}</span>
                      <span className={`text-xs ${item.stock <= 5 ? 'text-amber-600' : 'text-muted-foreground'}`}>
                        Stok: {item.stock}
                      </span>
                    </div>
                    {(() => {
                      const best = getBestPromo(item, 1, promotions);
                      if (!best) return null;
                      return (
                        <div className="mt-1">
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300">
                            {best.promo.type === 'percentage' ? `-${best.promo.value}%` : `-Rp ${best.promo.value.toLocaleString('id-ID')}`}
                            {' '}{best.promo.name}
                          </span>
                        </div>
                      );
                    })()}
                  </button>
                ))}
                {filteredItems.length === 0 && (
                  <div className="col-span-full text-center py-12 text-muted-foreground">
                    Tidak ada item ditemukan
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Right: Cart & Payment ─────────────────────────── */}
        <div className="w-96 flex flex-col bg-background">
          {/* Cart header */}
          <div className="p-3 border-b flex items-center justify-between">
            <div className="flex items-center gap-2 font-semibold">
              <ShoppingCart size={18} />
              Keranjang
              {cart.length > 0 && (
                <span className="bg-primary text-primary-foreground rounded-full text-xs px-2 py-0.5">{cart.length}</span>
              )}
            </div>
            {cart.length > 0 && (
              <button className="text-xs text-muted-foreground hover:text-destructive" onClick={() => setCart([])}>
                Kosongkan
              </button>
            )}
          </div>

          {/* Cart items */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {cart.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">
                Klik item di sebelah kiri untuk menambahkan
              </div>
            ) : cart.map(c => (
              <div key={c.itemId} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{c.name}</div>
                    <div className="text-xs text-muted-foreground">{formatRp(c.unitPrice)} / pcs</div>
                    {c.promoName && (
                      <div className="text-xs text-rose-600 dark:text-rose-400">Promo: {c.promoName}</div>
                    )}
                    {c.discountAmount > 0 && (
                      <div className="text-xs text-rose-600 dark:text-rose-400">
                        Diskon: -{formatRp(c.discountAmount)}
                      </div>
                    )}
                  </div>
                  <button onClick={() => removeFromCart(c.itemId)} className="text-muted-foreground hover:text-destructive shrink-0">
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center border rounded overflow-hidden">
                    <button className="px-2 py-1 hover:bg-muted transition-colors" onClick={() => updateQty(c.itemId, -1)}><Minus size={13} /></button>
                    <span className="px-3 py-1 text-sm font-medium">{c.quantity}</span>
                    <button className="px-2 py-1 hover:bg-muted transition-colors" onClick={() => updateQty(c.itemId, +1)}><Plus size={13} /></button>
                  </div>
                  <div className="text-sm font-semibold">{formatRp(c.unitPrice * c.quantity - c.discountAmount)}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Payment panel */}
          <div className="border-t p-3 space-y-3">
            {/* Customer */}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Pelanggan (opsional)</label>
              <select className="w-full text-sm border border-border rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary"
                value={customerId ?? ''} onChange={e => setCustomerId(e.target.value ? parseInt(e.target.value) : null)}>
                <option value="">Walk-in / Umum</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}{c.code ? ` (${c.code})` : ''}</option>)}
              </select>
            </div>

            {/* Totals */}
            <div className="bg-muted/50 rounded-lg p-3 space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatRp(subtotal)}</span></div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground shrink-0">Diskon</span>
                <input type="number" min={0} placeholder="0"
                  className="ml-auto w-28 text-right border border-border rounded px-2 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  value={discount} onChange={e => setDiscount(e.target.value)} />
              </div>
              <div className="flex justify-between font-semibold text-base border-t pt-1.5">
                <span>Total</span><span className="text-primary">{formatRp(grandTotal)}</span>
              </div>
            </div>

            {/* Payment method */}
            <div className="grid grid-cols-4 gap-1">
              {PAYMENT_METHODS.map(m => (
                <button key={m} onClick={() => setPayMethod(m)}
                  className={`text-xs py-1.5 rounded border transition-colors ${payMethod === m ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'}`}>
                  {METHOD_LABEL[m]}
                </button>
              ))}
            </div>

            {/* Payment amount */}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Bayar</label>
              <input type="number" min={0} placeholder={String(grandTotal)}
                className={`w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary ${errors.payment_amount ? 'border-red-400' : 'border-border'}`}
                value={payAmount} onChange={e => setPayAmount(e.target.value)} />
              {payMethod === 'cash' && paid > 0 && (
                <div className="mt-1 text-sm font-medium text-emerald-600">Kembalian: {formatRp(change)}</div>
              )}
            </div>

            {/* Note */}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Catatan</label>
              <input type="text" placeholder="Opsional…"
                className="w-full border border-border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                value={note} onChange={e => setNote(e.target.value)} />
            </div>

            {/* Date */}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Tanggal</label>
              <input type="date" className="w-full border border-border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                value={date} onChange={e => setDate(e.target.value)} />
            </div>

            {/* Errors */}
            {Object.keys(errors).length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded p-2 text-xs text-red-600 space-y-0.5">
                {Object.values(errors).map((e, i) => <div key={i}>{e}</div>)}
              </div>
            )}

            <Button className="w-full" size="lg" disabled={cart.length === 0 || submitting || paid < grandTotal} onClick={handleCheckout}>
              {submitting ? 'Memproses…' : `Proses Transaksi • ${formatRp(grandTotal)}`}
            </Button>
            {paid > 0 && paid < grandTotal && (
              <p className="text-xs text-red-500 text-center">Pembayaran kurang {formatRp(grandTotal - paid)}</p>
            )}
          </div>
        </div>
      </div>

      {/* Receipt / Success Modal */}
      <Dialog open={!!receiptModal} onOpenChange={open => { if (!open) resetCart(); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-600">
              <ReceiptText size={20} /> Transaksi Berhasil!
            </DialogTitle>
          </DialogHeader>
          {receiptModal && (
            <div className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-center space-y-1">
                <div className="text-xs text-muted-foreground">Nomor Transaksi</div>
                <div className="font-mono font-semibold text-lg">{receiptModal.saleNumber}</div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Total Bayar</span><span className="font-semibold">{formatRp(receiptModal.grandTotal)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Kembalian</span><span className="font-semibold text-emerald-600">{formatRp(receiptModal.changeAmount)}</span></div>
              </div>
            </div>
          )}
          <DialogFooter className="flex-col gap-2">
            <Button className="w-full" onClick={resetCart}>Transaksi Baru</Button>
            <Button variant="outline" className="w-full" onClick={() => {
              const saleId = null; // navigate to last sale
              router.visit(route('pos.index'));
            }}>Lihat Riwayat</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
