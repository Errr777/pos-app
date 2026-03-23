import AppLayout from '@/layouts/app-layout';
import { formatRp, fmtDate, STATUS_LABEL, METHOD_LABEL } from '@/lib/formats';
import { type BreadcrumbItem } from '@/types';
import { router, usePage } from '@inertiajs/react';
import { useState } from 'react';
import { Search, ChevronDown, ChevronRight, AlertCircle, FileText } from 'lucide-react';

interface PaymentRow {
    id: number; dueDate: string; amountDue: number; interestAmount: number;
    lateFeeApplied: number; totalDue: number; amountPaid: number;
    paidAt: string | null; status: string; paymentMethod: string | null; note: string | null;
}
interface PlanRow {
    id: number; customerId: number; customerName: string; customerCode: string;
    saleNumber: string | null; occurredAt: string | null;
    totalAmount: number; paidAmount: number; remainingAmount: number;
    installmentCount: number; paidCount: number; interestRate: number;
    status: string; note: string | null; createdAt: string;
    payments: PaymentRow[];
}
interface PaginatedPlans {
    data: PlanRow[];
    current_page: number; last_page: number; per_page: number;
    total: number; from: number | null; to: number | null;
    links: { url: string | null; label: string; active: boolean }[];
}
interface PageProps {
    plans: PaginatedPlans;
    filters: { search?: string; status?: string; per_page?: string; sort_by?: string; sort_dir?: string };
    [key: string]: unknown;
}

const STATUS_BADGE: Record<string, string> = {
    active:    'bg-blue-100 text-blue-700',
    overdue:   'bg-red-100 text-red-700',
    completed: 'bg-emerald-100 text-emerald-700',
    cancelled: 'bg-gray-100 text-gray-500',
};

const PAYMENT_STATUS_BADGE: Record<string, string> = {
    paid:    'bg-emerald-100 text-emerald-700',
    pending: 'bg-yellow-100 text-yellow-700',
    overdue: 'bg-red-100 text-red-700',
    partial: 'bg-orange-100 text-orange-700',
};

const STATUS_TABS = [
    { key: 'all',       label: 'Semua' },
    { key: 'active',    label: 'Aktif' },
    { key: 'overdue',   label: 'Tertunggak' },
    { key: 'completed', label: 'Lunas' },
];

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Riwayat Kredit', href: '/pos/kredit' },
];

export default function CreditHistoryPage() {
    const { plans, filters } = usePage<PageProps>().props;

    const [search, setSearch]     = useState(filters.search ?? '');
    const [expanded, setExpanded] = useState<number | null>(null);
    const activeStatus            = filters.status ?? 'all';

    function applyFilter(params: Record<string, string>) {
        router.get(route('installments.history'), {
            ...filters,
            ...params,
            page: '1',
        }, { preserveState: true, replace: true });
    }

    function handleSearch(e: React.FormEvent) {
        e.preventDefault();
        applyFilter({ search });
    }

    function handleStatusTab(key: string) {
        applyFilter({ status: key });
    }

    function handleSort(col: string) {
        const sameCol = (filters.sort_by ?? 'created') === col;
        applyFilter({
            sort_by: col,
            sort_dir: sameCol && (filters.sort_dir ?? 'desc') === 'desc' ? 'asc' : 'desc',
        });
    }

    function openInvoice(planId: number) {
        window.open(
            route('installments.invoice', { plan: planId }),
            'invoice',
            'width=900,height=700,toolbar=no,location=no,menubar=no,scrollbars=yes,resizable=yes'
        );
    }

    function goToPage(url: string | null) {
        if (!url) return;
        router.visit(url, { preserveState: true });
    }

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">

                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold">Riwayat Kredit</h1>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            {plans.total} rencana cicilan
                        </p>
                    </div>
                    <a href={route('pos.installments')}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border bg-background hover:bg-muted transition-colors font-medium">
                        Bayar Cicilan →
                    </a>
                </div>

                {/* Search + Status Tabs */}
                <div className="flex flex-col sm:flex-row gap-3">
                    <form onSubmit={handleSearch} className="relative flex-1 max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Cari nama, kode pelanggan, atau no. transaksi…"
                            className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                    </form>

                    <div className="flex gap-1 p-1 bg-muted/50 rounded-lg border self-start">
                        {STATUS_TABS.map(tab => (
                            <button key={tab.key} type="button"
                                onClick={() => handleStatusTab(tab.key)}
                                className={[
                                    'px-3 py-1.5 text-xs rounded-md font-medium transition-colors',
                                    activeStatus === tab.key
                                        ? 'bg-background shadow-sm text-foreground'
                                        : 'text-muted-foreground hover:text-foreground',
                                ].join(' ')}>
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Table */}
                {plans.data.length === 0 ? (
                    <div className="rounded-xl border p-12 text-center text-muted-foreground">
                        Tidak ada data kredit ditemukan.
                    </div>
                ) : (
                    <div className="rounded-lg border overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/50 border-b">
                                <tr>
                                    <th className="w-6 px-3 py-2.5" />
                                    <th className="text-left px-4 py-2.5 font-medium">
                                        <button onClick={() => handleSort('customer')} className="flex items-center gap-1 hover:text-foreground">
                                            Pelanggan
                                        </button>
                                    </th>
                                    <th className="text-left px-4 py-2.5 font-medium">Transaksi</th>
                                    <th className="text-right px-4 py-2.5 font-medium">Total Kredit</th>
                                    <th className="text-center px-4 py-2.5 font-medium">Progress</th>
                                    <th className="text-right px-4 py-2.5 font-medium">
                                        <button onClick={() => handleSort('remaining')} className="flex items-center gap-1 ml-auto hover:text-foreground">
                                            Sisa
                                        </button>
                                    </th>
                                    <th className="text-center px-4 py-2.5 font-medium">Status</th>
                                    <th className="px-4 py-2.5 font-medium text-center">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {plans.data.map(plan => (
                                    <>
                                        <tr key={plan.id}
                                            className={`transition-colors ${expanded === plan.id ? 'bg-primary/5' : 'hover:bg-muted/30'}`}>
                                            <td className="px-3 py-3 text-center">
                                                <button type="button"
                                                    onClick={() => setExpanded(expanded === plan.id ? null : plan.id)}
                                                    className="text-muted-foreground hover:text-foreground transition-colors">
                                                    {expanded === plan.id
                                                        ? <ChevronDown className="w-4 h-4" />
                                                        : <ChevronRight className="w-4 h-4" />}
                                                </button>
                                            </td>
                                            <td className="px-4 py-3">
                                                <a href={route('customers.show', { customer: plan.customerId })}
                                                    className="font-medium hover:underline">{plan.customerName}</a>
                                                <div className="text-xs text-muted-foreground">{plan.customerCode}</div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="font-mono text-xs font-semibold">{plan.saleNumber ?? '—'}</div>
                                                <div className="text-xs text-muted-foreground">
                                                    {plan.occurredAt ? fmtDate(plan.occurredAt) : '—'}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-right font-medium">{formatRp(plan.totalAmount)}</td>
                                            <td className="px-4 py-3 text-center">
                                                <div className="text-xs font-medium">{plan.paidCount}/{plan.installmentCount}</div>
                                                <div className="mt-1 h-1.5 w-16 mx-auto bg-muted rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-emerald-500 rounded-full"
                                                        style={{ width: `${plan.installmentCount > 0 ? Math.round((plan.paidCount / plan.installmentCount) * 100) : 0}%` }}
                                                    />
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <span className={plan.remainingAmount > 0 ? 'font-semibold text-amber-600' : 'text-emerald-600 font-medium'}>
                                                    {formatRp(plan.remainingAmount)}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[plan.status] ?? 'bg-muted text-muted-foreground'}`}>
                                                    {plan.status === 'overdue' && <AlertCircle size={10} />}
                                                    {STATUS_LABEL[plan.status] ?? plan.status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => openInvoice(plan.id)}
                                                        title="Cetak Invoice"
                                                        className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded border hover:bg-muted transition-colors">
                                                        <FileText size={12} /> Invoice
                                                    </button>
                                                    {plan.status !== 'completed' && plan.status !== 'cancelled' && (
                                                        <a href={route('pos.installments')}
                                                            className="inline-flex items-center px-2 py-1 text-xs rounded border border-primary text-primary hover:bg-primary/10 transition-colors font-medium">
                                                            Bayar
                                                        </a>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>

                                        {/* Expanded payment schedule */}
                                        {expanded === plan.id && (
                                            <tr key={`${plan.id}-expand`}>
                                                <td colSpan={8} className="px-6 py-4 bg-muted/20 border-t">
                                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                                                        Jadwal Cicilan
                                                    </p>
                                                    <div className="overflow-x-auto">
                                                        <table className="w-full text-xs border rounded-lg overflow-hidden">
                                                            <thead className="bg-muted/60 border-b">
                                                                <tr>
                                                                    <th className="text-left px-3 py-2 font-medium">#</th>
                                                                    <th className="text-left px-3 py-2 font-medium">Jatuh Tempo</th>
                                                                    <th className="text-right px-3 py-2 font-medium">Pokok</th>
                                                                    <th className="text-right px-3 py-2 font-medium">Bunga</th>
                                                                    <th className="text-right px-3 py-2 font-medium">Denda</th>
                                                                    <th className="text-right px-3 py-2 font-medium">Total</th>
                                                                    <th className="text-right px-3 py-2 font-medium">Dibayar</th>
                                                                    <th className="text-left px-3 py-2 font-medium">Tgl Bayar</th>
                                                                    <th className="text-left px-3 py-2 font-medium">Metode</th>
                                                                    <th className="text-center px-3 py-2 font-medium">Status</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y bg-background">
                                                                {plan.payments.map((p, idx) => (
                                                                    <tr key={p.id} className={p.status === 'paid' ? 'opacity-70' : ''}>
                                                                        <td className="px-3 py-2 text-muted-foreground">{idx + 1}</td>
                                                                        <td className="px-3 py-2">{new Date(p.dueDate).toLocaleDateString('id-ID')}</td>
                                                                        <td className="px-3 py-2 text-right">{formatRp(p.amountDue)}</td>
                                                                        <td className="px-3 py-2 text-right">{p.interestAmount > 0 ? formatRp(p.interestAmount) : '—'}</td>
                                                                        <td className="px-3 py-2 text-right">{p.lateFeeApplied > 0 ? <span className="text-red-600">{formatRp(p.lateFeeApplied)}</span> : '—'}</td>
                                                                        <td className="px-3 py-2 text-right font-medium">{formatRp(p.totalDue)}</td>
                                                                        <td className="px-3 py-2 text-right">{p.amountPaid > 0 ? <span className="text-emerald-600">{formatRp(p.amountPaid)}</span> : '—'}</td>
                                                                        <td className="px-3 py-2">{p.paidAt ? fmtDate(p.paidAt) : '—'}</td>
                                                                        <td className="px-3 py-2">{p.paymentMethod ? (METHOD_LABEL[p.paymentMethod] ?? p.paymentMethod) : '—'}</td>
                                                                        <td className="px-3 py-2 text-center">
                                                                            <span className={`px-1.5 py-0.5 rounded-full font-medium ${PAYMENT_STATUS_BADGE[p.status] ?? 'bg-muted'}`}>
                                                                                {STATUS_LABEL[p.status] ?? p.status}
                                                                            </span>
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                    {plan.note && (
                                                        <p className="mt-2 text-xs text-muted-foreground">
                                                            <span className="font-medium">Catatan:</span> {plan.note}
                                                        </p>
                                                    )}
                                                </td>
                                            </tr>
                                        )}
                                    </>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination */}
                {plans.last_page > 1 && (
                    <div className="flex items-center justify-between text-sm">
                        <p className="text-muted-foreground text-xs">
                            {plans.from}–{plans.to} dari {plans.total}
                        </p>
                        <div className="flex gap-1">
                            {plans.links.map((link, i) => (
                                <button key={i} type="button"
                                    onClick={() => goToPage(link.url)}
                                    disabled={!link.url}
                                    dangerouslySetInnerHTML={{ __html: link.label }}
                                    className={[
                                        'px-2.5 py-1 rounded text-xs border transition-colors',
                                        link.active ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted',
                                        !link.url ? 'opacity-40 cursor-default' : '',
                                    ].join(' ')}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
