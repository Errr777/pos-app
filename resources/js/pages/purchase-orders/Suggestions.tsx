import { useState } from 'react';
import AppLayout from '@/layouts/app-layout';
import { Head, router } from '@inertiajs/react';
import { type BreadcrumbItem } from '@/types';
import { ShoppingCart, AlertTriangle, Truck } from 'lucide-react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Purchase Order', href: '/purchase-orders' },
    { title: 'Saran Reorder', href: '/purchase-orders/suggestions' },
];

interface Suggestion {
    itemId: string;
    itemName: string;
    unitPrice: number;
    supplierId: string | null;
    supplierName: string | null;
    warehouseId: string;
    warehouseName: string;
    currentStock: number;
    stockMin: number;
    deficit: number;
    suggestedQty: number;
}

interface Supplier { id: string; name: string }
interface Warehouse { id: string; name: string }

interface PageProps {
    suggestions: Suggestion[];
    suppliers: Supplier[];
    warehouses: Warehouse[];
}

function fmt(n: number) {
    return `Rp ${n.toLocaleString('id-ID')}`;
}

// key to uniquely identify a row
function rowKey(s: Suggestion) {
    return `${s.itemId}_${s.warehouseId}`;
}

export default function Suggestions({ suggestions, suppliers }: PageProps) {
    // qty overrides: key = itemId_warehouseId
    const [qtys, setQtys] = useState<Record<string, number>>(() =>
        Object.fromEntries(suggestions.map(s => [rowKey(s), s.suggestedQty]))
    );
    // supplier overrides for items with no preferred supplier
    const [supplierOverrides, setSupplierOverrides] = useState<Record<string, string | null>>(() =>
        Object.fromEntries(suggestions.map(s => [rowKey(s), s.supplierId]))
    );
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [submitting, setSubmitting] = useState(false);

    const toggleAll = () => {
        if (selected.size === suggestions.length && suggestions.length > 0) {
            setSelected(new Set());
        } else {
            setSelected(new Set(suggestions.map(rowKey)));
        }
    };

    const toggle = (key: string) => {
        setSelected(prev => {
            const next = new Set(prev);
            next.has(key) ? next.delete(key) : next.add(key);
            return next;
        });
    };

    const selectedRows = suggestions.filter(s => selected.has(rowKey(s)));

    // Group selected by warehouse for preview
    const byWarehouse = selectedRows.reduce<Record<string, Suggestion[]>>((acc, s) => {
        const k = s.warehouseName;
        acc[k] = acc[k] ?? [];
        acc[k].push(s);
        return acc;
    }, {});

    const hasUnassigned = selectedRows.some(s => !supplierOverrides[rowKey(s)]);

    const handleCreate = () => {
        if (selected.size === 0 || hasUnassigned) return;
        setSubmitting(true);

        const items = selectedRows.map(s => ({
            item_id:      s.itemId,
            warehouse_id: s.warehouseId,
            supplier_id:  supplierOverrides[rowKey(s)]!,
            qty:          qtys[rowKey(s)] ?? s.suggestedQty,
        }));

        router.post(route('po.suggestions.create'), { items }, {
            onFinish: () => setSubmitting(false),
        });
    };

    // Group suggestions by warehouse for display
    const groupedByWarehouse = suggestions.reduce<Record<string, Suggestion[]>>((acc, s) => {
        acc[s.warehouseName] = acc[s.warehouseName] ?? [];
        acc[s.warehouseName].push(s);
        return acc;
    }, {});

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Saran Reorder" />
            <div className="p-6 space-y-6 max-w-5xl">

                {/* Header */}
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold">Saran Reorder</h1>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            Item di bawah stok minimal. Pilih item lalu buat draft PO.
                        </p>
                    </div>
                    {selected.size > 0 && (
                        <div className="flex items-center gap-3 shrink-0">
                            {hasUnassigned && (
                                <span className="flex items-center gap-1 text-xs text-amber-600">
                                    <AlertTriangle className="h-3.5 w-3.5" />
                                    Pilih supplier untuk semua item
                                </span>
                            )}
                            <button
                                onClick={handleCreate}
                                disabled={hasUnassigned || submitting}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:pointer-events-none transition-colors"
                            >
                                <ShoppingCart className="h-4 w-4" />
                                Buat {Object.keys(byWarehouse).length > 0
                                    ? `${Object.keys(byWarehouse).length} Draft PO`
                                    : 'Draft PO'}
                            </button>
                        </div>
                    )}
                </div>

                {suggestions.length === 0 ? (
                    <div className="rounded-xl border bg-card flex items-center justify-center h-40 text-sm text-muted-foreground">
                        Semua stok dalam kondisi aman.
                    </div>
                ) : (
                    Object.entries(groupedByWarehouse).map(([warehouseName, rows]) => (
                        <div key={warehouseName} className="rounded-xl border bg-card shadow-sm overflow-hidden">
                            <div className="px-4 py-3 border-b bg-muted/40 flex items-center gap-2">
                                <Truck className="h-4 w-4 text-muted-foreground" />
                                <h2 className="font-semibold text-sm">{warehouseName}</h2>
                                <span className="ml-auto text-xs text-muted-foreground">{rows.length} item</span>
                            </div>
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b bg-muted/20">
                                        <th className="px-4 py-2.5 w-8">
                                            <input
                                                type="checkbox"
                                                className="rounded"
                                                checked={rows.every(r => selected.has(rowKey(r)))}
                                                onChange={toggleAll}
                                            />
                                        </th>
                                        <th className="text-left px-4 py-2.5 font-medium">Item</th>
                                        <th className="text-right px-4 py-2.5 font-medium">Stok</th>
                                        <th className="text-right px-4 py-2.5 font-medium">Min</th>
                                        <th className="text-right px-4 py-2.5 font-medium">Defisit</th>
                                        <th className="text-right px-4 py-2.5 font-medium w-24">Pesan Qty</th>
                                        <th className="text-left px-4 py-2.5 font-medium">Supplier</th>
                                        <th className="text-right px-4 py-2.5 font-medium">Est. Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map(s => {
                                        const key = rowKey(s);
                                        const qty = qtys[key] ?? s.suggestedQty;
                                        const suppId = supplierOverrides[key];
                                        const isSelected = selected.has(key);
                                        return (
                                            <tr key={key} className={`border-b last:border-0 transition-colors ${isSelected ? 'bg-primary/5' : 'hover:bg-muted/30'}`}>
                                                <td className="px-4 py-2.5">
                                                    <input
                                                        type="checkbox"
                                                        className="rounded"
                                                        checked={isSelected}
                                                        onChange={() => toggle(key)}
                                                    />
                                                </td>
                                                <td className="px-4 py-2.5 font-medium">{s.itemName}</td>
                                                <td className="px-4 py-2.5 text-right tabular-nums text-rose-600 font-medium">{s.currentStock}</td>
                                                <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{s.stockMin}</td>
                                                <td className="px-4 py-2.5 text-right tabular-nums">
                                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300">
                                                        -{s.deficit}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-2.5 text-right">
                                                    <input
                                                        type="number"
                                                        min={1}
                                                        value={qty}
                                                        onChange={e => setQtys(prev => ({ ...prev, [key]: Math.max(1, parseInt(e.target.value) || 1) }))}
                                                        className="w-20 border rounded px-2 py-1 text-right tabular-nums text-sm bg-background"
                                                    />
                                                </td>
                                                <td className="px-4 py-2.5">
                                                    {s.supplierId ? (
                                                        <span className="text-sm">{s.supplierName}</span>
                                                    ) : (
                                                        <select
                                                            value={suppId ?? ''}
                                                            onChange={e => setSupplierOverrides(prev => ({ ...prev, [key]: e.target.value || null }))}
                                                            className="border rounded px-2 py-1 text-sm bg-background w-36"
                                                        >
                                                            <option value="">-- Pilih --</option>
                                                            {suppliers.map(sup => (
                                                                <option key={sup.id} value={sup.id}>{sup.name}</option>
                                                            ))}
                                                        </select>
                                                    )}
                                                </td>
                                                <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground text-xs">
                                                    {s.unitPrice > 0 ? fmt(s.unitPrice * qty) : '—'}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    ))
                )}

                {/* Summary bar */}
                {selected.size > 0 && (
                    <div className="rounded-xl border bg-card px-4 py-3 flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{selected.size} item dipilih dari {Object.keys(byWarehouse).length} outlet</span>
                        <span className="font-semibold tabular-nums">
                            Est. Total:{' '}
                            {fmt(selectedRows.reduce((sum, s) => {
                                const qty = qtys[rowKey(s)] ?? s.suggestedQty;
                                return sum + s.unitPrice * qty;
                            }, 0))}
                        </span>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
