import { useState, useMemo, useRef, useEffect } from 'react';
import { List as VirtualList } from 'react-window';
import { formatRp, METHOD_LABEL } from '@/lib/formats';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import { Search, Plus, Minus, Trash2, ShoppingCart, ReceiptText, LayoutGrid, List, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter, DialogClose,
} from '@/components/ui/dialog';
import { type CartItem } from '@/lib/db';
import { useOfflineCart } from '@/hooks/use-offline-cart';
import { useNetwork } from '@/hooks/use-network';
import { useSyncQueue } from '@/hooks/use-sync-queue';
import { useToast } from '@/components/ui/toast';
import { v4 as uuidv4 } from 'uuid';
import { DatePickerInput } from '@/components/DatePickerInput';

const breadcrumbs: BreadcrumbItem[] = [
  { title: 'Dashboard', href: '/dashboard' },
  { title: 'Kasir', href: '/pos/terminal' },
];

interface ItemVariantOption {
  id: number;
  name: string;
  priceModifier: number;
}

interface ItemOption {
  id: number;
  name: string;
  code: string;
  category: string | null;
  categoryId: number | null;
  stock: number;
  price: number;
  imageUrl?: string | null;
  tagIds: number[];
  variants?: ItemVariantOption[];
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
  id: string;
  name: string;
  code: string | null;
  isBlocked?: boolean;
  hasCredit?: boolean;
}

interface ScheduleRow {
  due_date: string;
  amount_due: number;
  interest_amount: number;
  is_first: boolean;
}

interface WarehouseOption {
  id: number;
  name: string;
  code: string;
  isDefault: boolean;
}

interface PageProps {
  items: ItemOption[];
  customers: CustomerOption[];
  warehouses: WarehouseOption[];
  promotions: Promotion[];
  autoWarehouseId: number | null;
  [key: string]: unknown;
}

const PAYMENT_METHODS = ['cash', 'transfer', 'qris', 'card', 'credit'];

function generateSchedule(
  grandTotal: number, dp: number, count: number,
  intervalMonths: number, interestRate: number
): ScheduleRow[] {
  if (grandTotal <= 0 || count < 2) return [];
  const safeDp    = Math.min(dp, grandTotal);
  const remaining = grandTotal - safeDp;
  const rows: ScheduleRow[] = [];

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  // First row: DP paid today
  rows.push({ due_date: todayStr, amount_due: safeDp, interest_amount: 0, is_first: true });

  const installments = count - 1;
  const baseAmount   = installments > 0 ? Math.floor(remaining / installments) : remaining;
  let runningRemainder = remaining;

  for (let i = 1; i < count; i++) {
    const d = new Date(today);
    d.setMonth(d.getMonth() + i * intervalMonths);
    const isLast    = i === count - 1;
    const rowAmount = isLast ? runningRemainder : baseAmount;
    runningRemainder -= rowAmount;
    const interest  = Math.round(rowAmount * interestRate / 100);
    rows.push({
      due_date:        d.toISOString().split('T')[0],
      amount_due:      rowAmount,
      interest_amount: interest,
      is_first:        false,
    });
  }
  return rows;
}


// ─── Virtualized compact-list row ────────────────────────────────────────────
const COMPACT_ROW_H = 48;

type CompactRowData = { items: ItemOption[]; onAdd: (item: ItemOption) => void };

function CompactListRow({
  ariaAttributes,
  index,
  style,
  items,
  onAdd,
}: {
  ariaAttributes: { 'aria-posinset': number; 'aria-setsize': number; role: 'listitem' };
  index: number;
  style: React.CSSProperties;
} & CompactRowData) {
  const item = items[index];
  if (!item) return null;
  return (
    <button
      {...ariaAttributes}
      style={style}
      onClick={() => onAdd(item)}
      disabled={item.stock <= 0 || item.price <= 0}
      className={`text-left px-3 py-2 flex items-center justify-between transition hover:bg-primary/5 w-full border-b ${
        item.stock <= 0 || item.price <= 0 ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
      }`}
    >
      <div className="flex items-center gap-2 min-w-0">
        {item.imageUrl
          ? <img src={item.imageUrl} alt="" className="w-8 h-8 rounded object-cover shrink-0" />
          : <div className="w-8 h-8 rounded bg-muted shrink-0" />
        }
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-medium leading-tight truncate">{item.name}</span>
          <span className="text-xs text-muted-foreground">{item.code}</span>
        </div>
      </div>
      <div className="flex items-center gap-4 shrink-0 ml-3">
        <span className={`text-xs ${item.stock <= 5 ? 'text-amber-600' : 'text-muted-foreground'}`}>Stok: {item.stock}</span>
        <span className="text-sm font-bold text-primary">{formatRp(item.price)}</span>
      </div>
    </button>
  );
}

export default function PosTerminal() {
  const { items, customers, warehouses, promotions = [], autoWarehouseId } = usePage<PageProps>().props;

  // Network + offline sync
  const isOnline = useNetwork();
  const { addToQueue } = useSyncQueue(isOnline);

  // Warehouse selection (local — initialized from props)
  const [warehouseId, setWarehouseId] = useState<number | null>(
    autoWarehouseId
    ?? warehouses.find(w => w.isDefault)?.id
    ?? warehouses[0]?.id
    ?? null
  );

  // Persistent cart (IndexedDB-backed)
  const {
    items: cart,           setItems: setCart,
    customerId: savedCustomerId, setCustomerId,
    payMethod,             setPayMethod,
    discount,              setDiscount,
    note,                  setNote,
    setWarehouseId:        setCartWarehouseId,
    clearCart,
    isRestored,
  } = useOfflineCart();

  // selectedCustomer: controls the <select> display value (string hashid)
  // checkoutCustomerId: the actual hash string to send at checkout
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [checkoutCustomerId, setCheckoutCustomerId] = useState<string | null>(null);
  const customerTouched = useRef(false);

  // Seed from IndexedDB restore only if user hasn't already picked a customer
  useEffect(() => {
    if (!isRestored || customerTouched.current) return;
    if (savedCustomerId != null && savedCustomerId !== '') {
      setSelectedCustomer(savedCustomerId);
      setCheckoutCustomerId(savedCustomerId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRestored]);

  // customerId alias — used for UI (credit panel blocked check, button disabled)
  const customerId = checkoutCustomerId;

  // Keep cart's warehouseId in sync with local selection
  useEffect(() => {
    setCartWarehouseId(warehouseId);
  }, [warehouseId, setCartWarehouseId]);

  // Credit / installment state
  const [dpAmount, setDpAmount]                 = useState(0);
  const [installmentCount, setInstallmentCount] = useState(2);
  const [intervalMonths, setIntervalMonths]     = useState(1);
  const [creditInterestRate, setCreditInterestRate] = useState(0);
  const [creditLateFee, setCreditLateFee]       = useState(0);
  const [creditSchedule, setCreditSchedule]     = useState<ScheduleRow[]>([]);

  // Outlet-resolved prices: itemId → price override
  const [outletPrices, setOutletPrices] = useState<Record<number, number>>({});

  useEffect(() => {
    if (!warehouseId) { setOutletPrices({}); return; }
    fetch(`/pos/items?warehouse_id=${warehouseId}`, {
      headers: { 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
    })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then((data: Record<string, number>) => {
        const parsed: Record<number, number> = {};
        for (const [k, v] of Object.entries(data)) parsed[Number(k)] = v;
        setOutletPrices(parsed);
      })
      .catch(() => setOutletPrices({}));
  }, [warehouseId]);

  // Resolve item price: outlet override if available, else global price
  const resolvePrice = (item: ItemOption) =>
    outletPrices[item.id] !== undefined ? outletPrices[item.id] : item.price;

  // Items with resolved prices
  const resolvedItems = useMemo(
    () => items.map(i => ({ ...i, price: resolvePrice(i) })),
    [items, outletPrices]
  );

  const { toast } = useToast();

  // Local-only state (not worth persisting)
  const [search, setSearch]     = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [date, setDate]         = useState(() => new Date().toISOString().slice(0, 10));
  const [submitting, setSubmitting] = useState(false);
  const [receiptModal, setReceiptModal] = useState<{ saleNumber: string; grandTotal: number; changeAmount: number } | null>(null);
  const [density, setDensity] = useState<'grid' | 'compact'>('grid');
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<{ code: string; name: string; type: 'percentage' | 'fixed'; value: number; minPurchase: number; maxDiscount: number } | null>(null);
  const [promoLoading, setPromoLoading] = useState(false);
  const [variantPickerItem, setVariantPickerItem] = useState<ItemOption | null>(null);

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
    if (!q) return resolvedItems;
    return resolvedItems.filter(i =>
      i.name.toLowerCase().includes(q) || i.code.toLowerCase().includes(q)
    );
  }, [resolvedItems, search]);

  const addToCartWithVariant = (item: ItemOption, variant?: ItemVariantOption) => {
    const unitPrice = variant ? item.price + variant.priceModifier : item.price;
    const displayName = variant ? `${item.name} — ${variant.name}` : item.name;

    const next = (() => {
      const existing = cart.find(c =>
        c.itemId === item.id && (variant ? c.variantId === variant.id : !c.variantId)
      );
      if (existing) {
        if (existing.quantity >= item.stock) return cart;
        const newQty = existing.quantity + 1;
        const itemData = resolvedItems.find(i => i.id === item.id) ?? item;
        const best = getBestPromo(itemData, newQty, promotions);
        return cart.map(c =>
          c.itemId === item.id && (variant ? c.variantId === variant.id : !c.variantId)
            ? { ...c, quantity: newQty, discountAmount: best?.discount ?? c.discountAmount, promoName: best?.promo.name ?? c.promoName }
            : c
        );
      }
      if (item.stock <= 0) return cart;
      const best = getBestPromo(item, 1, promotions);
      return [...cart, {
        itemId: item.id, name: displayName, code: item.code,
        variantId: variant?.id ?? null,
        variantName: variant?.name ?? null,
        unitPrice, quantity: 1,
        discountAmount: best?.discount ?? 0,
        promoName: best?.promo.name ?? null,
        availableStock: item.stock,
      } satisfies CartItem];
    })();
    setCart(next);
  };

  const addToCart = (item: ItemOption) => {
    if (item.variants && item.variants.length > 0) {
      setVariantPickerItem(item);
      return;
    }
    addToCartWithVariant(item);
  };

  const updateQty = (itemId: number, delta: number) => {
    setCart(cart.map(c => {
      if (c.itemId !== itemId) return c;
      const newQty = Math.max(1, Math.min(c.availableStock, c.quantity + delta));
      const item = items.find(i => i.id === itemId);
      const best = item ? getBestPromo(item, newQty, promotions) : null;
      return { ...c, quantity: newQty, discountAmount: best?.discount ?? 0, promoName: best?.promo.name ?? null };
    }));
  };

  const updateDiscount = (itemId: number, val: string) => {
    setCart(cart.map(c => c.itemId === itemId ? { ...c, discountAmount: parseInt(val) || 0 } : c));
  };

  const removeFromCart = (itemId: number) => {
    setCart(cart.filter(c => c.itemId !== itemId));
  };

  const subtotal = cart.reduce((sum, c) => sum + c.unitPrice * c.quantity - c.discountAmount, 0);
  const discountTotal = parseInt(discount) || 0;
  const grandTotal = Math.max(0, subtotal - discountTotal);
  const paid = parseInt(payAmount) || 0;
  const change = Math.max(0, paid - grandTotal);

  // Regenerate credit schedule when grand total or credit params change
  useEffect(() => {
    if (payMethod === 'credit' && grandTotal > 0) {
      setCreditSchedule(generateSchedule(grandTotal, dpAmount, installmentCount, intervalMonths, creditInterestRate));
    }
  }, [grandTotal, payMethod, dpAmount, installmentCount, intervalMonths, creditInterestRate]);

  const applyPromo = async () => {
    const code = promoCodeInput.trim();
    if (!code) return;
    setPromoLoading(true);
    try {
      const res = await fetch(`/pos/promo/validate?code=${encodeURIComponent(code)}`);
      const data = await res.json();
      if (!res.ok) {
        toast({ variant: 'destructive', title: 'Kode Promo Tidak Valid', description: data.error ?? 'Kode tidak ditemukan.' });
        return;
      }
      // Calculate discount from promo
      const base = subtotal;
      if (data.minPurchase > 0 && base < data.minPurchase) {
        toast({ variant: 'warning', title: 'Minimum Pembelian', description: `Promo ini berlaku untuk pembelian minimal ${formatRp(data.minPurchase)}.` });
        return;
      }
      let disc = data.type === 'percentage' ? Math.floor(base * data.value / 100) : data.value;
      if (data.maxDiscount > 0) disc = Math.min(disc, data.maxDiscount);
      disc = Math.min(disc, base);
      setAppliedPromo(data);
      setDiscount(String(disc));
      toast({ variant: 'success', title: 'Promo Diterapkan', description: `${data.name}: -${formatRp(disc)}` });
    } catch {
      toast({ variant: 'destructive', title: 'Gagal', description: 'Tidak dapat memvalidasi kode promo.' });
    } finally {
      setPromoLoading(false);
    }
  };

  const removePromo = () => {
    setAppliedPromo(null);
    setPromoCodeInput('');
    setDiscount('0');
  };

  const handleCheckout = () => {
    if (cart.length === 0) return;
    console.log('[Checkout] checkoutCustomerId=', checkoutCustomerId, 'selectedCustomer=', selectedCustomer);
    setSubmitting(true);

    const isCreditSale = payMethod === 'credit';
    const basePayload = {
      warehouse_id:    warehouseId!,
      customer_id:     checkoutCustomerId,
      occurred_at:     date + ' ' + new Date().toTimeString().slice(0, 8),
      payment_method:  payMethod,
      payment_amount:  isCreditSale ? dpAmount : (paid || grandTotal),
      discount_amount: discountTotal,
      promo_code:      appliedPromo?.code ?? null,
      note,
      items: cart.map(c => ({
        item_id:         c.itemId,
        variant_id:      c.variantId ?? null,
        variant_name:    c.variantName ?? null,
        quantity:        c.quantity,
        unit_price:      c.unitPrice,
        discount_amount: c.discountAmount,
      })),
    };

    // Recompute schedule at submit time to avoid stale-state mismatch with backend grandTotal.
    const liveSchedule = isCreditSale
      ? generateSchedule(grandTotal, dpAmount, installmentCount, intervalMonths, creditInterestRate)
      : [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payload: any = isCreditSale
      ? { ...basePayload, credit_schedule: liveSchedule, credit_interest_rate: creditInterestRate, credit_late_fee: creditLateFee }
      : basePayload;

    // ── OFFLINE PATH ─────────────────────────────────────────
    if (!isOnline) {
      const key = uuidv4();
      addToQueue(payload, key).then(() => {
        const offlineRef = 'OFFLINE-' + key.slice(0, 8).toUpperCase();
        setReceiptModal({ saleNumber: offlineRef, grandTotal, changeAmount: Math.max(0, (paid || grandTotal) - grandTotal) });
        clearCart();
        setPayAmount('');
        setSubmitting(false);
      });
      return;
    }

    // ── ONLINE PATH ──────────────────────────────────────────
    router.post(route('pos.store'), {
      ...payload,
      idempotency_key: uuidv4(),
    }, {
      onSuccess: (page) => {
        const flash = (page.props as Record<string, unknown>).flash as Record<string, string> | undefined;
        setReceiptModal({ saleNumber: flash?.sale_number ?? '', grandTotal, changeAmount: change });
        clearCart();
        setPayAmount('');
        setSubmitting(false);
      },
      onError: (errs) => {
        const msg = Object.values(errs).join(' ');
        toast({ variant: 'destructive', title: 'Transaksi Gagal', description: msg || 'Terjadi kesalahan.' });
        setSubmitting(false);
      },
    });
  };

  const resetCart = () => {
    clearCart();
    customerTouched.current = false;
    setSelectedCustomer('');
    setCheckoutCustomerId(null);
    setPayAmount('');
    setReceiptModal(null);
    setAppliedPromo(null);
    setPromoCodeInput('');
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
                value={search} onChange={e => setSearch(e.target.value)} autoFocus
                onKeyDown={e => {
                  if (e.key === 'Enter' && filteredItems.length === 1) {
                    addToCart(filteredItems[0]);
                    setSearch('');
                  }
                }} />
            </div>
            {warehouses.length > 1 ? (
              <select className="text-sm border border-border rounded px-2 focus:outline-none focus:ring-2 focus:ring-primary"
                value={warehouseId ?? ''} onChange={e => setWarehouseId(parseInt(e.target.value))}>
                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            ) : (
              <div className="px-3 py-2 text-sm font-medium rounded-lg bg-muted border">
                {warehouses[0]?.name ?? 'Outlet'}
              </div>
            )}
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
            <a href={route('installments.history')}
              className="px-3 py-1.5 text-xs rounded-lg border bg-background hover:bg-muted transition-colors font-medium whitespace-nowrap">
              Kredit Pelanggan
            </a>
          </div>

          {/* Item compact list (virtualized) */}
          {density === 'compact' && (
            <div className="flex-1 overflow-hidden">
              {filteredItems.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">Tidak ada item ditemukan</div>
              ) : (
                <VirtualList
                  rowComponent={CompactListRow}
                  rowCount={filteredItems.length}
                  rowHeight={COMPACT_ROW_H}
                  rowProps={{ items: filteredItems, onAdd: addToCart }}
                  style={{ height: '100%' }}
                />
              )}
            </div>
          )}

          {/* Item grid */}
          {density !== 'compact' && (
            <div className="flex-1 overflow-y-auto p-3">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-2">
                {filteredItems.map(item => (
                  <button key={item.id}
                    onClick={() => addToCart(item)}
                    disabled={item.stock <= 0 || item.price <= 0}
                    className={`text-left border rounded-lg p-3.5 transition-all hover:shadow-md hover:border-primary ${
                      item.stock <= 0 || item.price <= 0 ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:bg-primary/5'
                    }`}
                  >
                    {item.imageUrl
                      ? <img src={item.imageUrl} alt="" className="w-full h-24 rounded-md object-cover mb-2" />
                      : <div className="w-full h-24 rounded-md bg-muted mb-2" />
                    }
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
            </div>
          )}
        </div>

        {/* ── Right: Cart & Payment ─────────────────────────── */}
        <div className="w-72 flex flex-col border-r overflow-hidden bg-background">
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
        </div>

        {/* ── Payment ─────────────────────────────────── */}
        <div className="w-80 flex flex-col overflow-hidden bg-background">
          <div className="p-3 border-b font-semibold text-sm flex items-center gap-2 shrink-0">
            <ReceiptText size={16} />
            Pembayaran
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {/* Customer */}
            <div>
              <label htmlFor="customer-select" className="text-xs text-muted-foreground mb-1 block">Pelanggan (opsional)</label>
              <select
                id="customer-select"
                name="customer_id"
                className="w-full text-sm border border-border rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary"
                value={selectedCustomer}
                onChange={e => {
                  customerTouched.current = true;
                  const v = e.target.value;
                  const id = v !== '' ? v : null;
                  console.log('[Customer select] v=', v, 'id=', id);
                  setSelectedCustomer(v);
                  setCheckoutCustomerId(id);
                  setCustomerId(id);
                }}>
                <option value="">Walk-in / Umum</option>
                {customers.map(c => <option key={c.id} value={String(c.id)}>{c.name}{c.code ? ` (${c.code})` : ''}</option>)}
              </select>
            </div>

            {/* Promo Code */}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Kode Promo</label>
              {appliedPromo ? (
                <div className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-700 rounded px-3 py-2">
                  <div>
                    <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">{appliedPromo.code}</span>
                    <span className="text-xs text-emerald-600 dark:text-emerald-500 ml-2">{appliedPromo.name}</span>
                  </div>
                  <button onClick={removePromo} className="text-xs text-muted-foreground hover:text-destructive ml-2">Hapus</button>
                </div>
              ) : (
                <div className="flex gap-1">
                  <input
                    type="text"
                    placeholder="Masukkan kode promo"
                    className="flex-1 border border-border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    value={promoCodeInput}
                    onChange={e => setPromoCodeInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') applyPromo(); }}
                  />
                  <button
                    onClick={applyPromo}
                    disabled={promoLoading || !promoCodeInput.trim()}
                    className="px-3 py-1.5 text-sm rounded border bg-primary text-primary-foreground disabled:opacity-50 hover:bg-primary/90 transition-colors"
                  >
                    {promoLoading ? '…' : 'Pakai'}
                  </button>
                </div>
              )}
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
            <div className="grid grid-cols-5 gap-1">
              {PAYMENT_METHODS.map(m => (
                <button key={m} onClick={() => setPayMethod(m)}
                  className={`text-xs py-1.5 rounded border transition-colors ${payMethod === m ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'}`}>
                  {METHOD_LABEL[m]}
                </button>
              ))}
            </div>

            {/* Credit panel */}
            {payMethod === 'credit' && (() => {
              const selectedCust = customers.find(c => c.id === customerId);
              return (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-3 text-xs">
                  {selectedCust?.isBlocked && (
                    <p className="text-red-600 font-medium">⚠ Pelanggan ini memiliki cicilan jatuh tempo. Kredit diblokir.</p>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="font-medium block mb-0.5">Uang Muka (DP)</label>
                      <input type="number" min={0} max={grandTotal} value={dpAmount}
                        onChange={e => setDpAmount(parseInt(e.target.value) || 0)}
                        className="w-full border rounded px-2 py-1 text-right bg-background focus:outline-none" />
                    </div>
                    <div>
                      <label className="font-medium block mb-0.5">Jumlah Cicilan</label>
                      <input type="number" min={2} max={24} value={installmentCount}
                        onChange={e => setInstallmentCount(parseInt(e.target.value) || 2)}
                        className="w-full border rounded px-2 py-1 text-right bg-background focus:outline-none" />
                    </div>
                    <div>
                      <label className="font-medium block mb-0.5">Interval (bulan)</label>
                      <input type="number" min={1} max={12} value={intervalMonths}
                        onChange={e => setIntervalMonths(parseInt(e.target.value) || 1)}
                        className="w-full border rounded px-2 py-1 text-right bg-background focus:outline-none" />
                    </div>
                    <div>
                      <label className="font-medium block mb-0.5">Bunga % / cicilan</label>
                      <input type="number" min={0} max={100} step={0.1} value={creditInterestRate}
                        onChange={e => setCreditInterestRate(parseFloat(e.target.value) || 0)}
                        className="w-full border rounded px-2 py-1 text-right bg-background focus:outline-none" />
                    </div>
                    <div className="col-span-2">
                      <label className="font-medium block mb-0.5">Denda Keterlambatan (Rp)</label>
                      <input type="number" min={0} value={creditLateFee}
                        onChange={e => setCreditLateFee(parseInt(e.target.value) || 0)}
                        className="w-full border rounded px-2 py-1 text-right bg-background focus:outline-none" />
                    </div>
                  </div>
                  {creditSchedule.length > 0 && (
                    <div>
                      <div className="font-medium mb-1">Preview Jadwal:</div>
                      <div className="space-y-0.5">
                        {creditSchedule.map((row, i) => (
                          <div key={i} className="flex justify-between bg-background rounded px-2 py-1 border">
                            <span>{row.is_first ? 'Sekarang (DP)' : new Date(row.due_date).toLocaleDateString('id-ID')}</span>
                            <span className="font-medium">
                              {formatRp(row.amount_due + row.interest_amount)}
                              {row.interest_amount > 0 && <span className="text-muted-foreground"> (+bunga)</span>}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Payment amount (hidden for credit) */}
            {payMethod !== 'credit' && (
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Bayar</label>
              <input type="number" min={0} placeholder={String(grandTotal)}
                className="w-full border border-border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                value={payAmount} onChange={e => setPayAmount(e.target.value)} />
              {payMethod === 'cash' && paid > 0 && (
                <div className="mt-1 text-sm font-medium text-emerald-600">Kembalian: {formatRp(change)}</div>
              )}
            </div>
            )}

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
              <DatePickerInput value={date} onChange={(v) => setDate(v)} className="h-9 text-sm" />
            </div>

            {/* Offline status */}
            {!isOnline && (
              <div className="flex items-center gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
                <WifiOff className="h-3.5 w-3.5 shrink-0" />
                Mode offline — transaksi disimpan lokal &amp; disinkron saat online
              </div>
            )}

            {cart.some(c => c.unitPrice <= 0) && (
              <p className="text-xs text-red-500 text-center">Keranjang memiliki item dengan harga Rp 0. Hapus sebelum melanjutkan.</p>
            )}
            <Button
              className="w-full"
              size="lg"
              disabled={
                cart.length === 0 || submitting || cart.some(c => c.unitPrice <= 0) ||
                (payMethod === 'credit'
                  ? (!selectedCustomer || customers.find(c => c.id === customerId)?.isBlocked || creditSchedule.length < 2)
                  : (!isOnline ? false : paid < grandTotal))
              }
              onClick={handleCheckout}
            >
              {submitting
                ? 'Memproses…'
                : isOnline
                  ? `Proses Transaksi • ${formatRp(grandTotal)}`
                  : `Simpan Offline • ${formatRp(grandTotal)}`}
            </Button>
            {isOnline && paid > 0 && paid < grandTotal && (
              <p className="text-xs text-red-500 text-center">Pembayaran kurang {formatRp(grandTotal - paid)}</p>
            )}
          </div>
        </div>
      </div>

      {/* Variant Picker Modal */}
      <Dialog open={!!variantPickerItem} onOpenChange={open => { if (!open) setVariantPickerItem(null); }}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>Pilih Varian</DialogTitle>
            <DialogDescription>{variantPickerItem?.name}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            {variantPickerItem?.variants?.map(v => (
              <button
                key={v.id}
                className="flex items-center justify-between px-4 py-3 rounded-lg border hover:border-primary hover:bg-primary/5 transition-all text-left"
                onClick={() => {
                  addToCartWithVariant(variantPickerItem, v);
                  setVariantPickerItem(null);
                }}
              >
                <span className="font-medium text-sm">{v.name}</span>
                <span className="text-sm font-bold text-primary">{formatRp(variantPickerItem.price + v.priceModifier)}</span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Receipt / Success Modal */}
      <Dialog open={!!receiptModal} onOpenChange={open => { if (!open) resetCart(); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-600">
              <ReceiptText size={20} /> Transaksi Berhasil!
            </DialogTitle>
            <DialogDescription>
              {receiptModal?.saleNumber.startsWith('OFFLINE-')
                ? 'Transaksi disimpan lokal dan akan disinkron saat koneksi tersedia.'
                : 'Transaksi telah diproses dan dicatat di sistem.'}
            </DialogDescription>
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
              router.visit(route('pos.index'));
            }}>Lihat Riwayat</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
