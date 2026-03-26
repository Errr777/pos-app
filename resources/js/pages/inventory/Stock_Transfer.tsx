import { useEffect, useRef, useState } from 'react';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import { Search, Plus, Eye, Trash, Download, ArrowRightLeft, ArrowLeftRight, Package, Wrench, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter, DialogClose,
} from '@/components/ui/dialog';
import { DatePickerFilter } from '@/components/DatePickerInput';
import Pagination from '@/components/Pagination';

const breadcrumbs: BreadcrumbItem[] = [
  { title: 'Dashboard', href: '/dashboard' },
  { title: 'Transfer Stok', href: '/inventory/transfers' },
];

interface TransferRow {
  id: number;
  txnId: string;
  date: string;
  itemId: number;
  itemName: string;
  fromId: number;
  fromName: string;
  toId: number;
  toName: string;
  quantity: number;
  reference?: string | null;
  actor?: string | null;
  note?: string | null;
  status: string;
}

interface WarehouseOption {
  id: number;
  code: string;
  name: string;
  is_default: boolean;
}

interface ItemOption {
  id: number;
  name: string;
  category: string | null;
  stock: number;
}

interface PaginatedTransfers {
  data: TransferRow[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from: number | null;
  to: number | null;
}

interface Filters {
  search?: string;
  date_from?: string;
  date_to?: string;
  sort_by?: string;
  sort_dir?: string;
  per_page?: string | number;
}

interface JasaOption {
  id: number;
  name: string;
  code: string;
  category: string | null;
  global_price: number;
}

interface JasaCartItem {
  item_id: number;
  name: string;
  code: string;
  global_price: number;
  outlet_price: number;
}

interface OutletOption { id: number; name: string; code: string; }

interface PageProps {
  transfers: PaginatedTransfers;
  warehouses: WarehouseOption[];
  items: ItemOption[];
  jasaItems: JasaOption[];
  outlets: OutletOption[];
  filters: Filters;
  flash?: { success?: string };
  errors?: Record<string, string>;
  [key: string]: unknown;
}

function pad(n: number) { return String(n).padStart(2, '0'); }
function formatDateISO(d: string | Date | null | undefined): string {
  if (!d) return '';
  const dt = d instanceof Date ? d : new Date(d);
  if (isNaN(dt.getTime())) return '';
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

export default function Stock_Transfer() {
  const { props } = usePage<PageProps>();
  const { transfers, warehouses, items: itemOptions, jasaItems, outlets, filters, flash, errors: pageErrors } = props;

  // Only show Jasa transfer if user has access to the default warehouse
  const hasDefaultWarehouse = warehouses.some(w => w.is_default);

  const [query, setQuery]     = useState(filters.search ?? '');
  const [sortBy, setSortBy]   = useState(filters.sort_by ?? 'date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(filters.sort_dir === 'asc' ? 'asc' : 'desc');
  const [dateFrom, setDateFrom] = useState<string>(filters.date_from ?? '');
  const [dateTo, setDateTo]     = useState<string>(filters.date_to ?? '');

  useEffect(() => {
    setQuery(filters.search ?? '');
    setSortBy(filters.sort_by ?? 'date');
    setSortDir(filters.sort_dir === 'asc' ? 'asc' : 'desc');
    setDateFrom(filters.date_from ?? '');
    setDateTo(filters.date_to ?? '');
  }, [filters]);

  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selected, setSelected]         = useState<TransferRow | null>(null);

  // Navigate helper
  const navigate = (overrides: Record<string, unknown> = {}) => {
    router.get(route('stock_transfer.index'), {
      search:    query,
      date_from: dateFrom || undefined,
      date_to:   dateTo || undefined,
      sort_by:   sortBy,
      sort_dir:  sortDir,
      per_page:  filters.per_page ?? 20,
      ...overrides,
    }, { preserveState: true, replace: true });
  };

  const handleSort = (col: string) => {
    const newDir: 'asc' | 'desc' = sortBy === col ? (sortDir === 'asc' ? 'desc' : 'asc') : 'desc';
    setSortBy(col); setSortDir(newDir);
    navigate({ sort_by: col, sort_dir: newDir });
  };

  const sortIcon = (col: string) => sortBy === col ? (sortDir === 'asc' ? '▲' : '▼') : '⇅';

  const handleDateFromChange = (v: string) => {
    setDateFrom(v);
    navigate({ date_from: v || undefined, page: 1 });
  };
  const handleDateToChange = (v: string) => {
    setDateTo(v);
    navigate({ date_to: v || undefined, page: 1 });
  };
  const clearDates = () => {
    setDateFrom('');
    setDateTo('');
    navigate({ date_from: undefined, date_to: undefined, page: 1 });
  };

  const handlePage = (page: number) => navigate({ page });

  const goToCreateSJ = () => router.visit(route('delivery_orders.create'));

  // ── Transfer-type choice + Jasa form ──────────────────────────────────────
  const [showChoice, setShowChoice]       = useState(false);
  const [showJasaForm, setShowJasaForm]   = useState(false);
  const [jasaOutlet, setJasaOutlet]       = useState('');
  const [jasaCart, setJasaCart]           = useState<JasaCartItem[]>([]);
  const [jasaSearch, setJasaSearch]       = useState('');
  const [jasaDropOpen, setJasaDropOpen]   = useState(false);
  const [jasaProcessing, setJasaProcessing] = useState(false);
  const [jasaErrors, setJasaErrors]       = useState<Record<string, string>>({});
  const jasaSearchRef = useRef<HTMLInputElement>(null);

  const filteredJasa = jasaItems.filter(it => {
    const q = jasaSearch.toLowerCase();
    return !q || it.name.toLowerCase().includes(q) || it.code.toLowerCase().includes(q);
  }).filter(it => !jasaCart.some(c => c.item_id === it.id)).slice(0, 20);

  function addJasa(it: JasaOption) {
    setJasaCart(prev => [...prev, { item_id: it.id, name: it.name, code: it.code, global_price: it.global_price, outlet_price: it.global_price }]);
    setJasaSearch('');
    setJasaDropOpen(false);
  }
  function removeJasa(id: number) { setJasaCart(prev => prev.filter(c => c.item_id !== id)); }
  function setJasaPrice(id: number, val: number) {
    setJasaCart(prev => prev.map(c => c.item_id === id ? { ...c, outlet_price: Math.max(0, val) } : c));
  }

  function submitJasa(e: React.FormEvent) {
    e.preventDefault();
    setJasaErrors({});
    setJasaProcessing(true);
    router.post(route('inventory.jasa_prices'), {
      warehouse_id: jasaOutlet,
      services: jasaCart.map(c => ({ item_id: c.item_id, outlet_price: c.outlet_price })),
    }, {
      onError: (errs) => setJasaErrors(errs as Record<string, string>),
      onFinish: () => setJasaProcessing(false),
      onSuccess: () => { setShowJasaForm(false); setShowChoice(false); setJasaCart([]); setJasaOutlet(''); },
    });
  }

  function openJasaFlow() {
    setShowChoice(false);
    setJasaCart([]);
    setJasaOutlet(outlets[0] ? String(outlets[0].id) : '');
    setJasaSearch('');
    setJasaErrors({});
    setShowJasaForm(true);
  }

  const handleDelete = (row: TransferRow) => {
    if (!confirm(`Batalkan transfer "${row.txnId}"?\nIni akan mengembalikan ${row.quantity} unit "${row.itemName}" dari ${row.toName} ke ${row.fromName}.`)) return;
    router.delete(route('stock_transfer.destroy', { stockTransfer: row.id }));
  };

  const exportCSV = () => {
    const header = ['Tanggal', 'Item', 'Dari', 'Ke', 'Qty', 'Ref', 'Actor', 'Catatan'];
    const lines  = transfers.data.map(r => [
      formatDateISO(r.date), r.itemName, r.fromName, r.toName,
      r.quantity, r.reference ?? '', r.actor ?? '', (r.note ?? '').replace(/\r?\n/g, ' '),
    ]);
    const csv = [header, ...lines].map(row => row.map(c => {
      const s = String(c); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: `transfer_${formatDateISO(new Date())}.csv` });
    a.click();
    URL.revokeObjectURL(url);
  };


  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title="Transfer Stok" />
      <div className="relative min-h-[100vh] flex-1 overflow-hidden rounded-xl border border-sidebar-border/70 md:min-h-min dark:border-sidebar-border bg-white dark:bg-background p-4">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-4">
          <form className="flex-1" onSubmit={(e) => { e.preventDefault(); navigate({ search: query, page: 1 }); }}>
            <div className="relative w-full max-w-md">
              <span className="absolute inset-y-0 left-3 flex items-center text-muted-foreground pointer-events-none">
                <Search size={18} />
              </span>
              <input
                type="text"
                placeholder="Cari item / gudang / referensi..."
                className="w-full px-10 py-2 border rounded-lg bg-muted pl-12"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onBlur={() => navigate({ search: query, page: 1 })}
                style={{ minWidth: 240 }}
              />
            </div>
          </form>

          <div className="flex items-center gap-2">
            <DatePickerFilter value={dateFrom} onChange={handleDateFromChange} placeholder="Dari tanggal" />
            <DatePickerFilter value={dateTo} onChange={handleDateToChange} placeholder="Sampai tanggal" />
            <Button variant="outline" onClick={clearDates}>Clear</Button>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" className="gap-2" onClick={exportCSV} disabled={transfers.data.length === 0}>
              <Download size={16} /> Export CSV
            </Button>
            <div className="relative">
              <Button onClick={() => { setShowChoice(c => !c); setShowJasaForm(false); }} className="gap-2">
                <Plus size={16} /> Transfer
              </Button>
              {showChoice && (
                <div className="absolute right-0 top-full mt-2 z-20 w-56 rounded-xl border bg-popover shadow-lg p-2 space-y-1">
                  <button
                    onClick={() => { setShowChoice(false); goToCreateSJ(); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted text-left transition-colors"
                  >
                    <Package size={18} className="text-indigo-500 shrink-0" />
                    <div>
                      <div className="text-sm font-medium">Barang</div>
                      <div className="text-xs text-muted-foreground">Buat Surat Jalan</div>
                    </div>
                  </button>
                  {hasDefaultWarehouse && outlets.length > 0 && (
                    <button
                      onClick={openJasaFlow}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted text-left transition-colors"
                    >
                      <Wrench size={18} className="text-amber-500 shrink-0" />
                      <div>
                        <div className="text-sm font-medium">Jasa</div>
                        <div className="text-xs text-muted-foreground">Atur harga jasa di outlet</div>
                      </div>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Flash */}
        {flash?.success && (
          <div className="mb-3 rounded-md border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-800">{flash.success}</div>
        )}
        {pageErrors?.general && (
          <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">{pageErrors.general}</div>
        )}

        {/* Jasa price form */}
        {showJasaForm && (
          <div className="mb-4 rounded-xl border bg-card p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold flex items-center gap-2">
                  <Wrench size={16} className="text-amber-500" /> Atur Harga Jasa di Outlet
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">Tetapkan harga jual jasa untuk outlet tertentu. Bisa lebih dari 1 jenis jasa.</p>
              </div>
              <button onClick={() => setShowJasaForm(false)} className="text-muted-foreground hover:text-foreground">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={submitJasa} className="space-y-4">
              {/* Outlet selector */}
              <div>
                <label className="block text-sm font-medium mb-1">Outlet Tujuan <span className="text-red-500">*</span></label>
                <select
                  value={jasaOutlet}
                  onChange={e => setJasaOutlet(e.target.value)}
                  className="w-full max-w-xs px-3 py-2 border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-amber-500"
                  required
                >
                  <option value="">— Pilih Outlet —</option>
                  {outlets.map(o => <option key={o.id} value={o.id}>{o.name} ({o.code})</option>)}
                </select>
                {jasaErrors.warehouse_id && <p className="text-xs text-red-500 mt-1">{jasaErrors.warehouse_id}</p>}
              </div>

              {/* Jasa search */}
              <div>
                <label className="block text-sm font-medium mb-1">Tambah Jasa</label>
                <div className="relative max-w-md">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    ref={jasaSearchRef}
                    type="text"
                    value={jasaSearch}
                    onChange={e => { setJasaSearch(e.target.value); setJasaDropOpen(true); }}
                    onFocus={() => setJasaDropOpen(true)}
                    onBlur={() => setTimeout(() => setJasaDropOpen(false), 150)}
                    placeholder="Cari nama jasa…"
                    className="w-full pl-9 pr-4 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  {jasaDropOpen && filteredJasa.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-popover border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {filteredJasa.map(it => (
                        <button key={it.id} type="button" onMouseDown={() => addJasa(it)}
                          className="w-full text-left px-3 py-2 hover:bg-muted/60 flex items-center justify-between gap-2 text-sm">
                          <div>
                            <div className="font-medium">{it.name}</div>
                            <div className="text-xs text-muted-foreground">{it.code}{it.category ? ` · ${it.category}` : ''}</div>
                          </div>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(it.global_price)}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {jasaErrors.services && <p className="text-xs text-red-500 mt-1">{jasaErrors.services}</p>}
              </div>

              {/* Cart */}
              {jasaCart.length > 0 && (
                <div className="rounded-lg border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40">
                        <th className="text-left px-3 py-2 font-medium">Jasa</th>
                        <th className="text-right px-3 py-2 font-medium w-36">Harga Global</th>
                        <th className="text-right px-3 py-2 font-medium w-40">Harga Outlet</th>
                        <th className="w-8 px-2 py-2" />
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {jasaCart.map(c => (
                        <tr key={c.item_id} className="hover:bg-muted/10">
                          <td className="px-3 py-2">
                            <div className="font-medium">{c.name}</div>
                            <div className="text-xs text-muted-foreground">{c.code}</div>
                          </td>
                          <td className="px-3 py-2 text-right text-muted-foreground">
                            {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(c.global_price)}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <input
                              type="number" min={0}
                              value={c.outlet_price}
                              onChange={e => setJasaPrice(c.item_id, parseInt(e.target.value) || 0)}
                              className="w-full text-right border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
                            />
                          </td>
                          <td className="px-2 py-2 text-center">
                            <button type="button" onClick={() => removeJasa(c.item_id)}
                              className="text-muted-foreground hover:text-red-500 transition-colors">
                              <X size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="flex gap-2">
                <Button type="submit" disabled={jasaProcessing || !jasaOutlet || jasaCart.length === 0}
                  className="gap-2 bg-amber-600 hover:bg-amber-700">
                  <Wrench size={15} /> {jasaProcessing ? 'Menyimpan…' : 'Simpan Harga Jasa'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowJasaForm(false)}>Batal</Button>
              </div>
            </form>
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full border rounded-xl">
            <thead>
              <tr className="bg-muted">
                <th className="px-4 py-2 text-left cursor-pointer select-none" onClick={() => handleSort('date')}>Tanggal {sortIcon('date')}</th>
                <th className="px-4 py-2 text-left cursor-pointer select-none" onClick={() => handleSort('itemName')}>Item {sortIcon('itemName')}</th>
                <th className="px-4 py-2 text-left cursor-pointer select-none" onClick={() => handleSort('from')}>Dari {sortIcon('from')}</th>
                <th className="px-4 py-2 text-center">→</th>
                <th className="px-4 py-2 text-left cursor-pointer select-none" onClick={() => handleSort('to')}>Ke {sortIcon('to')}</th>
                <th className="px-4 py-2 text-left cursor-pointer select-none" onClick={() => handleSort('quantity')}>Qty {sortIcon('quantity')}</th>
                <th className="px-4 py-2 text-left cursor-pointer select-none" onClick={() => handleSort('reference')}>Ref/No {sortIcon('reference')}</th>
                <th className="px-4 py-2 text-left">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {transfers.data.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3 text-muted-foreground">
                      <ArrowLeftRight className="h-10 w-10 opacity-40" />
                      <div>
                        <p className="font-medium text-foreground">Belum ada transfer stok</p>
                        <p className="text-sm mt-1">Transfer stok untuk memindahkan barang antar gudang.</p>
                      </div>
                      <button
                        onClick={() => { setShowChoice(c => !c); setShowJasaForm(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                        className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition"
                      >
                        <Plus size={15} /> Transfer
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                transfers.data.map((row) => (
                  <tr key={row.id} className="border-b last:border-b-0">
                    <td className="px-4 py-2 text-sm">{formatDateISO(row.date)}</td>
                    <td className="px-4 py-2">{row.itemName}</td>
                    <td className="px-4 py-2 text-sm">{row.fromName}</td>
                    <td className="px-4 py-2 text-center text-muted-foreground"><ArrowRightLeft size={14} /></td>
                    <td className="px-4 py-2 text-sm">{row.toName}</td>
                    <td className="px-4 py-2 font-medium">{row.quantity}</td>
                    <td className="px-4 py-2 text-sm text-muted-foreground">{row.reference || '-'}</td>
                    <td className="px-4 py-2 flex gap-2">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button onClick={() => { setSelected(row); setIsDetailOpen(true); }} className="text-primary border border-white hover:bg-primary hover:text-slate-600 hover:border-0 p-2 rounded-full transition" aria-label="Lihat">
                              <Eye size={18} />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>Lihat Detail</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button onClick={() => handleDelete(row)} className="text-destructive bg-amber-50 hover:bg-destructive hover:text-amber-50 p-2 rounded-full transition" aria-label="Batalkan">
                              <Trash size={18} />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>Batalkan Transfer</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <Pagination meta={transfers} onPageChange={handlePage} />
      </div>

      {/* Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detail Transfer Stok</DialogTitle>
            <DialogDescription>Informasi perpindahan stok antar gudang.</DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-2 text-sm">
              <p><strong>ID Transfer:</strong> {selected.txnId}</p>
              <p><strong>Tanggal:</strong> {formatDateISO(selected.date)}</p>
              <p><strong>Item:</strong> {selected.itemName}</p>
              <div className="flex items-center gap-2">
                <span className="rounded bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-700">{selected.fromName}</span>
                <ArrowRightLeft size={14} className="text-muted-foreground" />
                <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">{selected.toName}</span>
              </div>
              <p><strong>Jumlah:</strong> {selected.quantity} unit</p>
              <p><strong>Referensi:</strong> {selected.reference || '-'}</p>
              <p><strong>Oleh:</strong> {selected.actor || '-'}</p>
              <p><strong>Catatan:</strong> {selected.note || '-'}</p>
              <p><strong>Status:</strong> <span className="rounded bg-muted px-2 py-0.5 text-xs">{selected.status}</span></p>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setIsDetailOpen(false)}>Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </AppLayout>
  );
}
