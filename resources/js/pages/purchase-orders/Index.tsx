import { useEffect, useState } from 'react';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import { Search, Plus, Eye, Trash2, CheckCircle, XCircle, PackageCheck, ClipboardList } from 'lucide-react';
import { DatePickerInput } from '@/components/DatePickerInput';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter, DialogClose,
} from '@/components/ui/dialog';
import Pagination, { type PaginationMeta } from '@/components/Pagination';

const breadcrumbs: BreadcrumbItem[] = [
  { title: 'Dashboard', href: '/dashboard' },
  { title: 'Purchase Order', href: '/purchase-orders' },
];

interface PoRow {
  id: string;
  poNumber: string;
  supplierName: string;
  warehouseName: string;
  orderedBy: string;
  status: string;
  orderedAt: string | null;
  expectedAt: string | null;
  receivedAt: string | null;
  grandTotal: number;
  itemCount: number;
  note: string | null;
}

interface ItemOption { id: string; name: string; code: string; costPrice: number; }
interface SupplierOption { id: string; name: string; }
interface WarehouseOption { id: string; name: string; }

interface PaginatedPos {
  data: PoRow[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from: number | null;
  to: number | null;
}

interface Filters {
  search?: string;
  status?: string;
  date_from?: string;
  date_to?: string;
  sort_by?: string;
  sort_dir?: string;
  per_page?: string | number;
}

interface PageProps {
  pos: PaginatedPos;
  suppliers: SupplierOption[];
  warehouses: WarehouseOption[];
  items: ItemOption[];
  filters: Filters;
  [key: string]: unknown;
}

interface CartLine { itemId: string; name: string; orderedQty: number; unitPrice: number; }

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
  return new Date(iso).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function PurchaseOrdersIndex() {
  const { pos, suppliers, warehouses, items, filters } = usePage<PageProps>().props;

  const [search, setSearch]     = useState(filters.search ?? '');
  const [status, setStatus]     = useState(filters.status ?? '');
  const [dateFrom, setDateFrom] = useState(filters.date_from ?? '');
  const [dateTo, setDateTo]     = useState(filters.date_to ?? '');
  const [sortBy, setSortBy]     = useState(filters.sort_by ?? 'date');
  const [sortDir, setSortDir]   = useState(filters.sort_dir ?? 'desc');
  const [perPage, setPerPage]   = useState(String(filters.per_page ?? '20'));

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm]             = useState({ supplier_id: '', warehouse_id: '', expected_at: '', note: '' });
  const [lines, setLines]           = useState<CartLine[]>([]);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<PoRow | null>(null);
  const [deleting, setDeleting]         = useState(false);

  useEffect(() => {
    setSearch(filters.search ?? '');
    setStatus(filters.status ?? '');
    setSortBy(filters.sort_by ?? 'date');
    setSortDir(filters.sort_dir ?? 'desc');
    setPerPage(String(filters.per_page ?? '20'));
  }, [filters]);

  const navigate = (overrides: Partial<Filters & { page?: number }> = {}) => {
    router.get(route('po.index'), {
      search, status, date_from: dateFrom, date_to: dateTo,
      sort_by: sortBy, sort_dir: sortDir, per_page: perPage, ...overrides,
    }, { preserveState: true, replace: true });
  };

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); navigate({ page: 1 }); };
  const handlePage   = (page: number) => navigate({ page });

  const handleSort = (col: string) => {
    const newDir = col === sortBy && sortDir === 'asc' ? 'desc' : 'asc';
    setSortBy(col); setSortDir(newDir);
    navigate({ sort_by: col, sort_dir: newDir, page: 1 });
  };

  const SortIcon = ({ col }: { col: string }) =>
    col !== sortBy ? <span className="opacity-30 ml-1">↕</span> : <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>;

  const addLine = () => {
    setLines(l => [...l, { itemId: '', name: '', orderedQty: 1, unitPrice: 0 }]);
  };

  const updateLine = (idx: number, field: keyof CartLine, value: string | number) => {
    setLines(l => l.map((line, i) => {
      if (i !== idx) return line;
      if (field === 'itemId') {
        const item = items.find(it => it.id === value);
        return { ...line, itemId: String(value), name: item?.name ?? '', unitPrice: item?.costPrice ?? 0 };
      }
      return { ...line, [field]: value };
    }));
  };

  const removeLine = (idx: number) => setLines(l => l.filter((_, i) => i !== idx));

  const poSubtotal = lines.reduce((sum, l) => sum + l.orderedQty * l.unitPrice, 0);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormErrors({});
    router.post(route('po.store'), {
      supplier_id:  form.supplier_id || null,
      warehouse_id: form.warehouse_id,
      expected_at:  form.expected_at || null,
      note:         form.note,
      items: lines.map(l => ({ item_id: l.itemId, ordered_qty: l.orderedQty, unit_price: l.unitPrice })),
    }, {
      onSuccess: () => { setShowCreate(false); setLines([]); setForm({ supplier_id:'', warehouse_id:'', expected_at:'', note:'' }); setSubmitting(false); },
      onError:   (errs) => { setFormErrors(errs); setSubmitting(false); },
    });
  };

  const handleStatusChange = (po: PoRow, newStatus: string) => {
    router.post(route('po.status', { purchaseOrder: po.id }), { status: newStatus });
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    setDeleting(true);
    router.delete(route('po.destroy', { purchaseOrder: deleteTarget.id }), {
      onSuccess: () => { setDeleteTarget(null); setDeleting(false); },
      onError:   () => setDeleting(false),
    });
  };

  const meta: PaginationMeta = {
    current_page: pos.current_page, last_page: pos.last_page,
    per_page: pos.per_page, total: pos.total, from: pos.from, to: pos.to,
  };

  const inputCls = (field: string) =>
    `w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary ${formErrors[field] ? 'border-red-400' : 'border-border'}`;

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title="Purchase Order" />
      <div className="p-4 md:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Purchase Order</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Kelola pesanan pembelian ke supplier</p>
          </div>
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus size={15} className="mr-1" /> Buat PO Baru
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-2 flex-wrap">
          <form onSubmit={handleSearch} className="flex gap-2 flex-1 min-w-[200px]">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input type="text" placeholder="Cari no. PO, supplier…"
                className="pl-8 pr-3 py-2 text-sm border border-border rounded w-full focus:outline-none focus:ring-2 focus:ring-primary"
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Button type="submit" size="sm" variant="outline">Cari</Button>
          </form>
          <select className="text-sm border border-border rounded px-2 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
            value={status} onChange={e => { setStatus(e.target.value); navigate({ status: e.target.value, page: 1 }); }}>
            <option value="">Semua Status</option>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select className="text-sm border border-border rounded px-2 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
            value={perPage} onChange={e => { setPerPage(e.target.value); navigate({ per_page: e.target.value, page: 1 }); }}>
            {['10','20','50','100'].map(n => <option key={n} value={n}>{n} / hal</option>)}
          </select>
        </div>

        {/* Table */}
        <div className="rounded-lg border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium cursor-pointer select-none" onClick={() => handleSort('poNumber')}>
                  No. PO <SortIcon col="poNumber" />
                </th>
                <th className="text-left px-4 py-3 font-medium cursor-pointer select-none" onClick={() => handleSort('supplierName')}>
                  Supplier <SortIcon col="supplierName" />
                </th>
                <th className="text-left px-4 py-3 font-medium">Outlet</th>
                <th className="text-left px-4 py-3 font-medium cursor-pointer select-none" onClick={() => handleSort('date')}>
                  Dibuat <SortIcon col="date" />
                </th>
                <th className="text-left px-4 py-3 font-medium">Exp. Terima</th>
                <th className="text-right px-4 py-3 font-medium cursor-pointer select-none" onClick={() => handleSort('grandTotal')}>
                  Total <SortIcon col="grandTotal" />
                </th>
                <th className="text-left px-4 py-3 font-medium cursor-pointer select-none" onClick={() => handleSort('status')}>
                  Status <SortIcon col="status" />
                </th>
                <th className="text-right px-4 py-3 font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {pos.data.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3 text-muted-foreground">
                      <ClipboardList className="h-10 w-10 opacity-40" />
                      <div>
                        <p className="font-medium text-foreground">Belum ada Purchase Order</p>
                        <p className="text-sm mt-1">Buat PO untuk memesan barang ke supplier.</p>
                      </div>
                      <button
                        onClick={() => setShowCreate(true)}
                        className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition"
                      >
                        <Plus size={15} /> Buat PO Baru
                      </button>
                    </div>
                  </td>
                </tr>
              ) : pos.data.map(po => {
                const sc = STATUS_CONFIG[po.status] ?? { label: po.status, cls: 'bg-slate-100 text-slate-600' };
                return (
                  <tr key={po.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3"><span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{po.poNumber}</span></td>
                    <td className="px-4 py-3">{po.supplierName}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{po.warehouseName}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(po.orderedAt)}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(po.expectedAt)}</td>
                    <td className="px-4 py-3 text-right font-medium">{formatRp(po.grandTotal)}</td>
                    <td className="px-4 py-3"><span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${sc.cls}`}>{sc.label}</span></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button className="p-1.5 rounded hover:bg-sky-100 text-sky-600" title="Detail"
                          onClick={() => router.visit(route('po.show', { purchaseOrder: po.id }))}><Eye size={15} /></button>
                        {po.status === 'draft' && (
                          <button className="p-1.5 rounded hover:bg-blue-100 text-blue-600" title="Tandai Dipesan"
                            onClick={() => handleStatusChange(po, 'ordered')}><CheckCircle size={15} /></button>
                        )}
                        {(po.status === 'ordered' || po.status === 'partial') && (
                          <button className="p-1.5 rounded hover:bg-emerald-100 text-emerald-600" title="Terima Barang"
                            onClick={() => router.visit(route('po.show', { purchaseOrder: po.id }))}><PackageCheck size={15} /></button>
                        )}
                        {(po.status === 'draft') && (
                          <button className="p-1.5 rounded hover:bg-red-100 text-red-600" title="Hapus"
                            onClick={() => setDeleteTarget(po)}><Trash2 size={15} /></button>
                        )}
                        {(po.status === 'draft' || po.status === 'ordered') && (
                          <button className="p-1.5 rounded hover:bg-slate-100 text-slate-600" title="Batalkan"
                            onClick={() => handleStatusChange(po, 'cancelled')}><XCircle size={15} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <Pagination meta={meta} onPageChange={handlePage}
          summary={<span>Total: <span className="font-medium text-foreground">{pos.total}</span> PO</span>} />
      </div>

      {/* Create PO Dialog */}
      <Dialog open={showCreate} onOpenChange={open => { if (!open) setShowCreate(false); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Buat Purchase Order Baru</DialogTitle>
            <DialogDescription>Buat pesanan pembelian ke supplier</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Supplier</label>
                <select className={inputCls('supplier_id')} value={form.supplier_id}
                  onChange={e => setForm(f => ({ ...f, supplier_id: e.target.value }))}>
                  <option value="">— Pilih Supplier —</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Outlet Tujuan <span className="text-red-500">*</span></label>
                <select className={inputCls('warehouse_id')} value={form.warehouse_id}
                  onChange={e => setForm(f => ({ ...f, warehouse_id: e.target.value }))}>
                  <option value="">— Pilih Outlet —</option>
                  {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
                {formErrors.warehouse_id && <p className="text-red-500 text-xs mt-1">{formErrors.warehouse_id}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Exp. Tanggal Terima</label>
                <DatePickerInput value={form.expected_at} onChange={v => setForm(f => ({ ...f, expected_at: v }))} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Catatan</label>
                <input type="text" className={inputCls('note')} value={form.note}
                  onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder="Opsional…" />
              </div>
            </div>

            {/* Line items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">Item <span className="text-red-500">*</span></label>
                <Button type="button" size="sm" variant="outline" onClick={addLine}><Plus size={13} className="mr-1" /> Tambah Item</Button>
              </div>
              {formErrors.items && <p className="text-red-500 text-xs mb-2">{formErrors.items}</p>}
              <div className="space-y-2">
                {lines.map((line, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-5">
                      <select className="w-full border border-border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        value={line.itemId} onChange={e => updateLine(idx, 'itemId', e.target.value)}>
                        <option value="">— Pilih Item —</option>
                        {items.map(it => <option key={it.id} value={it.id}>{it.name}</option>)}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <input type="number" min={1} placeholder="Qty"
                        className="w-full border border-border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        value={line.orderedQty} onChange={e => updateLine(idx, 'orderedQty', parseInt(e.target.value) || 1)} />
                    </div>
                    <div className="col-span-4">
                      <input type="number" min={0} placeholder="Harga Satuan"
                        className="w-full border border-border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        value={line.unitPrice} onChange={e => updateLine(idx, 'unitPrice', parseInt(e.target.value) || 0)} />
                    </div>
                    <div className="col-span-1 flex justify-center">
                      <button type="button" className="text-muted-foreground hover:text-destructive" onClick={() => removeLine(idx)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
                {lines.length === 0 && (
                  <div className="text-center py-4 text-sm text-muted-foreground border border-dashed rounded-lg">
                    Klik "Tambah Item" untuk menambah item
                  </div>
                )}
              </div>
              {lines.length > 0 && (
                <div className="mt-3 text-right text-sm font-semibold">
                  Total: {formatRp(poSubtotal)}
                </div>
              )}
            </div>

            <DialogFooter className="pt-2">
              <DialogClose asChild><Button type="button" variant="outline" disabled={submitting}>Batal</Button></DialogClose>
              <Button type="submit" disabled={submitting || lines.length === 0}>
                {submitting ? 'Menyimpan…' : 'Buat PO'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Hapus PO</DialogTitle>
            <DialogDescription>Yakin hapus PO <span className="font-semibold text-foreground">{deleteTarget?.poNumber}</span>?</DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-2">
            <DialogClose asChild><Button variant="outline" disabled={deleting}>Batal</Button></DialogClose>
            <Button variant="destructive" disabled={deleting} onClick={handleDelete}>{deleting ? 'Menghapus…' : 'Ya, Hapus'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
