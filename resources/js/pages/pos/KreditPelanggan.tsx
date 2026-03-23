import AppLayout from '@/layouts/app-layout';
import { formatRp, fmtDate, METHOD_LABEL, STATUS_LABEL } from '@/lib/formats';
import { type BreadcrumbItem } from '@/types';
import { router, usePage } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
import { AlertCircle, FileText, Search, X } from 'lucide-react';

/* ─── Types ──────────────────────────────────────────────────── */

interface PaymentRow {
    id: number; dueDate: string; amountDue: number; interestAmount: number;
    lateFeeApplied: number; totalDue: number; alreadyPaid: number; remainingDue: number;
    isPaid: boolean; status: string; paymentNumber: number; remainingAfter: number;
    paymentMethod: string | null; paidAt: string | null; note: string | null;
}
interface PlanRow {
    id: number; customerId: number; customerName: string; customerCode: string;
    saleNumber: string | null; occurredAt: string | null; createdAt: string;
    totalAmount: number; paidAmount: number; remainingAmount: number;
    installmentCount: number; paidCount: number;
    interestRate: number; lateFeeAmount: number;
    status: string; note: string | null; canPayExtra: boolean;
    payments: PaymentRow[];
}
interface PaginatedPlans {
    data: PlanRow[]; current_page: number; last_page: number; per_page: number;
    total: number; from: number | null; to: number | null;
    links: { url: string | null; label: string; active: boolean }[];
}
interface PageProps {
    plans: PaginatedPlans;
    filters: { search?: string; status?: string; per_page?: string; sort_by?: string; sort_dir?: string };
    [key: string]: unknown;
}

/* ─── Constants ──────────────────────────────────────────────── */

const PLAN_BADGE: Record<string, string> = {
    active:    'bg-blue-100 text-blue-700',
    overdue:   'bg-red-100 text-red-700',
    completed: 'bg-emerald-100 text-emerald-700',
    cancelled: 'bg-gray-100 text-gray-500',
};
const PMT_BADGE: Record<string, string> = {
    paid:    'bg-emerald-100 text-emerald-700',
    pending: 'bg-yellow-100 text-yellow-700',
    overdue: 'bg-red-100 text-red-700',
    partial: 'bg-orange-100 text-orange-700',
};
const STATUS_TABS = [
    { key: 'all',         label: 'Semua' },
    { key: 'belum_lunas', label: 'Belum Lunas' },
    { key: 'overdue',     label: 'Tertunggak' },
    { key: 'active',      label: 'Aktif' },
    { key: 'lunas',       label: 'Lunas' },
];
const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Kredit Pelanggan', href: '/pos/kredit' },
];

/* ─── Component ──────────────────────────────────────────────── */

export default function KreditPelangganPage() {
    const { plans, filters } = usePage<PageProps>().props;

    /* Filter state */
    const [search, setSearch]     = useState(filters.search ?? '');
    const activeStatus            = filters.status ?? 'all';

    /* Modal state */
    const [detailPlan, setDetailPlan] = useState<PlanRow | null>(null);
    const [payPlan, setPayPlan]       = useState<PlanRow | null>(null);

    /* Installment payment form */
    const [selectedPaymentId, setSelectedPaymentId] = useState<number | null>(null);
    const [selectedPayment, setSelectedPayment]     = useState<PaymentRow | null>(null);
    const [amountPaid, setAmountPaid]               = useState(0);
    const [paymentMethod, setPaymentMethod]         = useState('cash');
    const [lateFee, setLateFee]                     = useState(0);
    const [note, setNote]                           = useState('');
    const [processing, setProcessing]               = useState(false);
    const [errors, setErrors]                       = useState<Record<string, string>>({});

    /* Extra pay form (all scheduled rows paid but balance remains) */
    const [extraPayPlanId, setExtraPayPlanId]    = useState<number | null>(null);
    const [extraPayAmount, setExtraPayAmount]    = useState(0);
    const [extraPayMethod, setExtraPayMethod]    = useState('cash');
    const [extraPayNote, setExtraPayNote]        = useState('');
    const [extraProcessing, setExtraProcessing] = useState(false);
    const [extraErrors, setExtraErrors]         = useState<Record<string, string>>({});

    /* After successful payment, auto-advance to next unpaid in the same plan */
    const advanceToPlanRef = useRef<number | null>(null);

    useEffect(() => {
        const planId = advanceToPlanRef.current;
        if (!planId) return;
        const fresh = plans.data.find(p => p.id === planId);
        if (!fresh) return;
        advanceToPlanRef.current = null;
        setPayPlan(fresh);
        const nextUnpaid = fresh.payments.find(p => !p.isPaid);
        if (nextUnpaid) {
            setSelectedPaymentId(nextUnpaid.id);
            setSelectedPayment(nextUnpaid);
            setAmountPaid(nextUnpaid.remainingDue);
            setLateFee(0);
            setErrors({});
            setExtraPayPlanId(null);
        } else if (fresh.canPayExtra) {
            setSelectedPaymentId(null);
            setSelectedPayment(null);
            setExtraPayPlanId(fresh.id);
            setExtraPayAmount(fresh.remainingAmount);
        } else {
            setPayPlan(null);
        }
    }, [plans.data]);

    /* ── Helpers ─────────────────────────────────────────────── */

    function applyFilter(params: Record<string, string>) {
        router.get(route('installments.history'), { ...filters, ...params, page: '1' },
            { preserveState: true, replace: true });
    }
    function handleSearch(e: React.FormEvent) { e.preventDefault(); applyFilter({ search }); }
    function handleSort(col: string) {
        const sameCol = (filters.sort_by ?? 'created') === col;
        applyFilter({ sort_by: col, sort_dir: sameCol && (filters.sort_dir ?? 'desc') === 'desc' ? 'asc' : 'desc' });
    }
    function goToPage(url: string | null) {
        if (url) router.visit(url, { preserveState: true });
    }
    function openInvoice(planId: number) {
        const w = window.open(route('installments.invoice', { plan: planId }), 'invoice',
            'width=900,height=700,toolbar=no,location=no,menubar=no,scrollbars=yes,resizable=yes');
        if (!w) alert('Popup diblokir oleh browser. Izinkan popup untuk membuka invoice.');
    }
    function openDetailModal(plan: PlanRow) {
        setDetailPlan(plan);
        setPayPlan(null);
    }
    function closeDetailModal() { setDetailPlan(null); }
    function openPayModal(plan: PlanRow) {
        setDetailPlan(null);
        setPayPlan(plan);
        clearPayForm();
        autoSelectFirstUnpaid(plan);
    }
    function closePayModal() { setPayPlan(null); clearPayForm(); }
    function clearPayForm() {
        setSelectedPaymentId(null);
        setSelectedPayment(null);
        setAmountPaid(0);
        setLateFee(0);
        setNote('');
        setErrors({});
        setExtraPayPlanId(null);
        setExtraPayAmount(0);
        setExtraPayNote('');
        setExtraErrors({});
    }
    function autoSelectFirstUnpaid(plan: PlanRow) {
        if (plan.canPayExtra) {
            setExtraPayPlanId(plan.id);
            setExtraPayAmount(plan.remainingAmount);
            return;
        }
        const first = plan.payments.find(p => !p.isPaid);
        if (first && plan.remainingAmount > 0) {
            setSelectedPaymentId(first.id);
            setSelectedPayment(first);
            setAmountPaid(first.remainingDue);
        }
    }
    function selectPayment(p: PaymentRow) {
        if (p.isPaid) return;
        setSelectedPaymentId(p.id);
        setSelectedPayment(p);
        setAmountPaid(p.remainingDue);
        setLateFee(0);
        setErrors({});
        setExtraPayPlanId(null);
    }

    /* ── Payment submit ──────────────────────────────────────── */

    function submitPayment(e: React.FormEvent) {
        e.preventDefault();
        if (!selectedPaymentId || !payPlan) return;
        setProcessing(true);
        setErrors({});
        router.post(route('installments.pay_terminal'), {
            installment_payment_id: selectedPaymentId,
            amount_paid: amountPaid,
            payment_method: paymentMethod,
            late_fee: lateFee,
            note,
        }, {
            onSuccess: () => {
                advanceToPlanRef.current = payPlan.id;
                setSelectedPaymentId(null);
                setSelectedPayment(null);
                setAmountPaid(0);
                setLateFee(0);
                setNote('');
                setErrors({});
                router.reload({ only: ['plans'] });
            },
            onError: (errs) => setErrors(errs as Record<string, string>),
            onFinish: () => setProcessing(false),
        });
    }

    function submitExtraPayment(e: React.FormEvent) {
        e.preventDefault();
        if (!extraPayPlanId) return;
        setExtraProcessing(true);
        setExtraErrors({});
        router.post(route('installments.pay_extra', { plan: extraPayPlanId }), {
            amount_paid: extraPayAmount,
            payment_method: extraPayMethod,
            note: extraPayNote,
        }, {
            onSuccess: () => {
                setExtraPayPlanId(null);
                router.reload({ only: ['plans'] });
            },
            onError: (errs) => setExtraErrors(errs as Record<string, string>),
            onFinish: () => setExtraProcessing(false),
        });
    }

    /* ── Derived stats ───────────────────────────────────────── */
    const overdueCount = plans.data.filter(p => p.status === 'overdue').length;
    const activeCount  = plans.data.filter(p => p.status === 'active').length;

    /* ── Render ──────────────────────────────────────────────── */
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <div className="max-w-7xl mx-auto px-4 py-6 space-y-4">

                {/* Header */}
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <h1 className="text-xl font-bold">Kredit Pelanggan</h1>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            {plans.total} rencana cicilan
                            {activeCount > 0 && <span className="ml-2 text-blue-600">· {activeCount} aktif</span>}
                            {overdueCount > 0 && <span className="ml-2 text-red-600 font-medium">· {overdueCount} tertunggak</span>}
                        </p>
                    </div>
                    <a href={route('pos.terminal')}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border bg-background hover:bg-muted transition-colors font-medium shrink-0">
                        ← Terminal
                    </a>
                </div>

                {/* Search + Status Tabs */}
                <div className="flex flex-col sm:flex-row gap-3 items-start">
                    <form onSubmit={handleSearch} className="relative flex-1 max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                            placeholder="Cari nama, kode pelanggan, atau no. transaksi…"
                            className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
                    </form>
                    <div className="flex gap-1 p-1 bg-muted/50 rounded-lg border">
                        {STATUS_TABS.map(tab => (
                            <button key={tab.key} type="button" onClick={() => applyFilter({ status: tab.key })}
                                className={[
                                    'px-3 py-1.5 text-xs rounded-md font-medium transition-colors whitespace-nowrap',
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
                    <div className="rounded-xl border p-12 text-center text-muted-foreground text-sm">
                        Tidak ada data kredit ditemukan.
                    </div>
                ) : (
                    <div className="rounded-lg border overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/50 border-b">
                                <tr>
                                    <th className="text-left px-4 py-2.5 font-medium">
                                        <button onClick={() => handleSort('customer')} className="hover:text-foreground">Pelanggan</button>
                                    </th>
                                    <th className="text-left px-4 py-2.5 font-medium">Transaksi</th>
                                    <th className="text-right px-4 py-2.5 font-medium">Total Kredit</th>
                                    <th className="text-center px-4 py-2.5 font-medium">Progress</th>
                                    <th className="text-right px-4 py-2.5 font-medium">
                                        <button onClick={() => handleSort('remaining')} className="hover:text-foreground ml-auto flex items-center gap-1">Sisa</button>
                                    </th>
                                    <th className="text-center px-4 py-2.5 font-medium">Status</th>
                                    <th className="text-right px-4 py-2.5 font-medium">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {plans.data.map(plan => {
                                    const progressPct = plan.installmentCount > 0
                                        ? Math.round((plan.paidCount / plan.installmentCount) * 100) : 0;
                                    return (
                                        <tr key={plan.id} className="hover:bg-muted/30 transition-colors">
                                            <td className="px-4 py-3">
                                                <a href={route('customers.show', { customer: plan.customerId })}
                                                    className="font-medium hover:underline">{plan.customerName}</a>
                                                <div className="text-xs text-muted-foreground">{plan.customerCode}</div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="font-mono text-xs font-semibold">{plan.saleNumber ?? '—'}</div>
                                                <div className="text-xs text-muted-foreground">
                                                    {plan.occurredAt ? fmtDate(plan.occurredAt) : fmtDate(plan.createdAt)}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-right font-medium">{formatRp(plan.totalAmount)}</td>
                                            <td className="px-4 py-3 text-center">
                                                <div className="text-xs font-medium">{plan.paidCount}/{plan.installmentCount}</div>
                                                <div className="mt-1 h-1.5 w-16 mx-auto bg-muted rounded-full overflow-hidden">
                                                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${progressPct}%` }} />
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <span className={plan.remainingAmount > 0 ? 'font-semibold text-amber-600' : 'text-emerald-600 font-medium'}>
                                                    {formatRp(plan.remainingAmount)}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${PLAN_BADGE[plan.status] ?? 'bg-muted text-muted-foreground'}`}>
                                                    {plan.status === 'overdue' && <AlertCircle size={10} />}
                                                    {STATUS_LABEL[plan.status] ?? plan.status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <button type="button" onClick={() => openInvoice(plan.id)}
                                                        title="Cetak Invoice"
                                                        className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded border hover:bg-muted transition-colors">
                                                        <FileText size={11} /> Invoice
                                                    </button>
                                                    <button type="button" onClick={() => openDetailModal(plan)}
                                                        className="inline-flex items-center px-2.5 py-1 text-xs rounded border hover:bg-muted transition-colors font-medium">
                                                        Detail
                                                    </button>
                                                    {plan.remainingAmount > 0 && (
                                                        <button type="button" onClick={() => openPayModal(plan)}
                                                            className="inline-flex items-center px-2.5 py-1 text-xs rounded border border-primary text-primary hover:bg-primary/10 transition-colors font-medium">
                                                            Bayar
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
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
                                <button key={i} type="button" onClick={() => goToPage(link.url)}
                                    disabled={!link.url}
                                    dangerouslySetInnerHTML={{ __html: link.label }}
                                    className={[
                                        'px-2.5 py-1 rounded text-xs border transition-colors',
                                        link.active ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted',
                                        !link.url ? 'opacity-40 cursor-default' : '',
                                    ].join(' ')} />
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* ══ Modal Detail ══════════════════════════════════════════ */}
            {detailPlan && (() => {
                const plan = detailPlan;
                const totalLateFee   = plan.payments.reduce((s, p) => s + p.lateFeeApplied, 0);
                const totalInterest  = plan.payments.reduce((s, p) => s + p.interestAmount, 0);
                const nextDue        = plan.payments.find(p => !p.isPaid);
                return (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto"
                        onClick={e => { if (e.target === e.currentTarget) closeDetailModal(); }}>
                        <div className="bg-background rounded-xl shadow-xl w-full max-w-3xl my-8 flex flex-col">

                            {/* Header */}
                            <div className="flex items-start justify-between border-b px-6 py-4">
                                <div>
                                    <h2 className="font-semibold text-base">Detail Kredit</h2>
                                    <p className="text-sm text-muted-foreground mt-0.5">
                                        {plan.customerName}
                                        <span className="mx-1.5 text-muted-foreground/50">·</span>
                                        <span className="font-mono">{plan.saleNumber ?? '—'}</span>
                                        <span className="mx-1.5 text-muted-foreground/50">·</span>
                                        {plan.occurredAt ? fmtDate(plan.occurredAt) : fmtDate(plan.createdAt)}
                                    </p>
                                </div>
                                <button type="button" onClick={closeDetailModal}
                                    className="text-muted-foreground hover:text-foreground transition-colors mt-0.5">
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Body */}
                            <div className="px-6 py-5 space-y-5 overflow-y-auto max-h-[70vh]">

                                {/* Financial summary */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                                    <div className="rounded-lg border bg-muted/30 px-3 py-2.5">
                                        <p className="text-muted-foreground mb-0.5">Total Kredit</p>
                                        <p className="font-semibold text-sm">{formatRp(plan.totalAmount)}</p>
                                    </div>
                                    <div className="rounded-lg border bg-muted/30 px-3 py-2.5">
                                        <p className="text-muted-foreground mb-0.5">Sudah Dibayar</p>
                                        <p className="font-semibold text-sm text-emerald-600">{formatRp(plan.paidAmount)}</p>
                                    </div>
                                    <div className="rounded-lg border bg-muted/30 px-3 py-2.5">
                                        <p className="text-muted-foreground mb-0.5">Sisa Hutang</p>
                                        <p className={`font-semibold text-sm ${plan.remainingAmount > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                                            {formatRp(plan.remainingAmount)}
                                        </p>
                                    </div>
                                    <div className="rounded-lg border bg-muted/30 px-3 py-2.5">
                                        <p className="text-muted-foreground mb-0.5">Progress Cicilan</p>
                                        <p className="font-semibold text-sm">{plan.paidCount} / {plan.installmentCount}×</p>
                                        <div className="mt-1.5 h-1.5 w-full bg-muted rounded-full overflow-hidden">
                                            <div className="h-full bg-emerald-500 rounded-full"
                                                style={{ width: `${plan.installmentCount > 0 ? Math.round((plan.paidCount / plan.installmentCount) * 100) : 0}%` }} />
                                        </div>
                                    </div>
                                </div>

                                {/* Status + info row */}
                                <div className="flex flex-wrap items-center gap-3">
                                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${PLAN_BADGE[plan.status] ?? 'bg-muted text-muted-foreground'}`}>
                                        {plan.status === 'overdue' && <AlertCircle size={10} />}
                                        {STATUS_LABEL[plan.status] ?? plan.status}
                                    </span>
                                    {plan.interestRate > 0 && (
                                        <span className="text-xs text-muted-foreground">
                                            Bunga: <span className="text-foreground font-medium">{plan.interestRate}% · {formatRp(totalInterest)}</span>
                                        </span>
                                    )}
                                    {totalLateFee > 0 && (
                                        <span className="text-xs text-muted-foreground">
                                            Total Denda: <span className="text-red-600 font-medium">{formatRp(totalLateFee)}</span>
                                        </span>
                                    )}
                                    {nextDue && (
                                        <span className="text-xs text-muted-foreground">
                                            Jatuh Tempo: <span className={`font-medium ${nextDue.status === 'overdue' ? 'text-red-600' : 'text-foreground'}`}>
                                                {new Date(nextDue.dueDate).toLocaleDateString('id-ID')} · {formatRp(nextDue.remainingDue)}
                                            </span>
                                        </span>
                                    )}
                                    {plan.note && (
                                        <span className="text-xs text-muted-foreground">
                                            Catatan: <span className="text-foreground font-medium">{plan.note}</span>
                                        </span>
                                    )}
                                </div>

                                {/* Jadwal cicilan */}
                                <div>
                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Jadwal Cicilan</p>
                                    <div className="rounded-lg border overflow-auto">
                                        <table className="w-full text-xs">
                                            <thead className="bg-muted/50 border-b">
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
                                                {plan.payments.map(p => (
                                                    <tr key={p.id} className={p.status === 'overdue' && !p.isPaid ? 'bg-red-50/50' : ''}>
                                                        <td className="px-3 py-2 text-muted-foreground">{p.paymentNumber}</td>
                                                        <td className="px-3 py-2">{new Date(p.dueDate).toLocaleDateString('id-ID')}</td>
                                                        <td className="px-3 py-2 text-right">{formatRp(p.amountDue)}</td>
                                                        <td className="px-3 py-2 text-right">{p.interestAmount > 0 ? formatRp(p.interestAmount) : '—'}</td>
                                                        <td className="px-3 py-2 text-right">
                                                            {p.lateFeeApplied > 0 ? <span className="text-red-600">{formatRp(p.lateFeeApplied)}</span> : '—'}
                                                        </td>
                                                        <td className="px-3 py-2 text-right font-medium">{formatRp(p.totalDue)}</td>
                                                        <td className="px-3 py-2 text-right">
                                                            {p.alreadyPaid > 0 ? <span className="text-emerald-600">{formatRp(p.alreadyPaid)}</span> : '—'}
                                                        </td>
                                                        <td className="px-3 py-2">{p.paidAt ? fmtDate(p.paidAt) : '—'}</td>
                                                        <td className="px-3 py-2">
                                                            {p.paymentMethod ? (METHOD_LABEL[p.paymentMethod] ?? p.paymentMethod) : '—'}
                                                        </td>
                                                        <td className="px-3 py-2 text-center">
                                                            <span className={`px-1.5 py-0.5 rounded-full font-medium ${PMT_BADGE[p.status] ?? 'bg-muted'}`}>
                                                                {STATUS_LABEL[p.status] ?? p.status}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="border-t px-6 py-4 flex items-center justify-end gap-2">
                                <button type="button" onClick={() => openInvoice(plan.id)}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border hover:bg-muted transition-colors">
                                    <FileText size={14} /> Invoice
                                </button>
                                {plan.remainingAmount > 0 && (
                                    <button type="button" onClick={() => openPayModal(plan)}
                                        className="px-4 py-1.5 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium">
                                        Bayar Cicilan
                                    </button>
                                )}
                                <button type="button" onClick={closeDetailModal}
                                    className="px-4 py-1.5 text-sm rounded-lg border hover:bg-muted transition-colors">
                                    Tutup
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* ══ Modal Bayar ═══════════════════════════════════════════ */}
            {payPlan && (() => {
                const plan      = payPlan;
                const obligation = plan.payments.reduce((s, p) => s + p.totalDue, 0);
                const maxAllowed = Math.max(0, obligation - plan.paidAmount);
                return (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto"
                        onClick={e => { if (e.target === e.currentTarget) closePayModal(); }}>
                        <div className="bg-background rounded-xl shadow-xl w-full max-w-lg my-8 flex flex-col">

                            {/* Header */}
                            <div className="flex items-start justify-between border-b px-6 py-4">
                                <div>
                                    <h2 className="font-semibold text-base">Bayar Cicilan</h2>
                                    <p className="text-sm text-muted-foreground mt-0.5">
                                        {plan.customerName}
                                        <span className="mx-1.5 text-muted-foreground/50">·</span>
                                        Sisa: <span className="font-medium text-amber-600">{formatRp(plan.remainingAmount)}</span>
                                    </p>
                                </div>
                                <button type="button" onClick={closePayModal}
                                    className="text-muted-foreground hover:text-foreground transition-colors mt-0.5">
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Body */}
                            <div className="px-6 py-5 space-y-4">

                                {/* ── Extra pay form (canPayExtra) ── */}
                                {plan.canPayExtra && extraPayPlanId === plan.id ? (
                                    <form onSubmit={submitExtraPayment} className="space-y-4">
                                        <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900">
                                            <p className="font-semibold">Bayar Sisa Hutang</p>
                                            <p className="text-xs mt-0.5 text-amber-700">Semua cicilan terjadwal sudah lunas · sisa {formatRp(plan.remainingAmount)}</p>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-xs font-medium mb-1">Jumlah Bayar</label>
                                                <input type="number" min={1} max={plan.remainingAmount}
                                                    value={extraPayAmount}
                                                    onChange={e => setExtraPayAmount(parseInt(e.target.value) || 0)}
                                                    className="w-full border rounded-lg px-3 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-ring" />
                                                {extraErrors.amount_paid && <p className="text-red-500 text-xs mt-0.5">{extraErrors.amount_paid}</p>}
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium mb-1">Metode</label>
                                                <select value={extraPayMethod} onChange={e => setExtraPayMethod(e.target.value)}
                                                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                                                    <option value="cash">Cash</option>
                                                    <option value="transfer">Transfer</option>
                                                    <option value="qris">QRIS</option>
                                                    <option value="card">Kartu</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium mb-1">Catatan (opsional)</label>
                                            <input type="text" value={extraPayNote} onChange={e => setExtraPayNote(e.target.value)}
                                                placeholder="Catatan pembayaran sisa…"
                                                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                                        </div>
                                        {extraErrors.general && <p className="text-red-500 text-xs">{extraErrors.general}</p>}
                                        <div className="flex gap-2 pt-1">
                                            <button type="submit" disabled={extraProcessing}
                                                className="flex-1 py-2 rounded-lg bg-amber-600 text-white text-sm font-medium disabled:opacity-50 hover:bg-amber-700 transition-colors">
                                                {extraProcessing ? 'Menyimpan…' : 'Catat Pembayaran Sisa'}
                                            </button>
                                            <button type="button" onClick={closePayModal}
                                                className="px-4 py-2 rounded-lg border text-sm hover:bg-muted transition-colors">
                                                Batal
                                            </button>
                                        </div>
                                    </form>
                                ) : (
                                    /* ── Regular installment payment ── */
                                    <form onSubmit={submitPayment} className="space-y-4">

                                        {/* Payment rows selector */}
                                        <div>
                                            <p className="text-xs font-medium text-muted-foreground mb-1.5">Pilih cicilan yang dibayar</p>
                                            <div className="rounded-lg border overflow-hidden">
                                                {plan.payments.map(p => {
                                                    const isSel = selectedPaymentId === p.id;
                                                    return (
                                                        <button key={p.id} type="button"
                                                            disabled={p.isPaid}
                                                            onClick={() => selectPayment(p)}
                                                            className={[
                                                                'w-full flex items-center justify-between px-4 py-2.5 text-sm border-b last:border-b-0 transition-colors text-left',
                                                                p.isPaid
                                                                    ? 'opacity-50 cursor-default bg-muted/20'
                                                                    : isSel
                                                                        ? 'bg-primary/5 border-l-2 border-l-primary'
                                                                        : p.status === 'overdue'
                                                                            ? 'hover:bg-red-50/60 bg-red-50/30'
                                                                            : 'hover:bg-muted/40',
                                                            ].join(' ')}>
                                                            <span className="flex items-center gap-2">
                                                                <span className="text-muted-foreground text-xs w-5">#{p.paymentNumber}</span>
                                                                <span className={p.isPaid ? '' : 'font-medium'}>{formatRp(p.totalDue)}</span>
                                                                <span className="text-xs text-muted-foreground">
                                                                    · {new Date(p.dueDate).toLocaleDateString('id-ID')}
                                                                </span>
                                                            </span>
                                                            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${PMT_BADGE[p.status] ?? 'bg-muted'}`}>
                                                                {STATUS_LABEL[p.status] ?? p.status}
                                                            </span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {/* Form fields — shown when a payment is selected */}
                                        {selectedPaymentId && selectedPayment && (
                                            <>
                                                {/* Info banner */}
                                                {selectedPayment.remainingAfter === 0 ? (
                                                    <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
                                                        Cicilan terakhir · nominal <span className="font-semibold">{formatRp(selectedPayment.remainingDue)}</span>.
                                                        Jika dibayar kurang, sisa otomatis dijadwalkan ke cicilan berikutnya.
                                                    </div>
                                                ) : (
                                                    <div className="rounded-md bg-muted/50 border px-3 py-2 text-xs text-muted-foreground">
                                                        Nominal cicilan: <span className="font-semibold text-foreground">{formatRp(selectedPayment.remainingDue)}</span>.
                                                        Pembayaran kurang akan dilanjutkan ke cicilan berikutnya.
                                                    </div>
                                                )}

                                                {/* Overpayment warning */}
                                                {amountPaid > maxAllowed && (
                                                    <div className="rounded-md bg-red-50 border border-red-300 px-3 py-2 text-xs text-red-800 font-medium">
                                                        Pembayaran melebihi total hutang. Maksimum: <span className="font-bold">{formatRp(maxAllowed)}</span>.
                                                    </div>
                                                )}

                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="block text-xs font-medium mb-1">Jumlah Bayar</label>
                                                        <input type="number" min={1} max={selectedPayment.remainingDue + lateFee}
                                                            value={amountPaid}
                                                            onChange={e => setAmountPaid(parseInt(e.target.value) || 0)}
                                                            className="w-full border rounded-lg px-3 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-ring" />
                                                        {errors.amount_paid && <p className="text-red-500 text-xs mt-0.5">{errors.amount_paid}</p>}
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-medium mb-1">Metode</label>
                                                        <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}
                                                            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                                                            <option value="cash">Cash</option>
                                                            <option value="transfer">Transfer</option>
                                                            <option value="qris">QRIS</option>
                                                            <option value="card">Kartu</option>
                                                        </select>
                                                    </div>
                                                </div>

                                                {(selectedPayment.status === 'overdue' || selectedPayment.remainingAfter === 0) && (
                                                    <div>
                                                        <label className="block text-xs font-medium mb-1">
                                                            Denda Keterlambatan
                                                            <span className="ml-1 font-normal text-muted-foreground">(default 0)</span>
                                                        </label>
                                                        <input type="number" min={0} value={lateFee}
                                                            onChange={e => {
                                                                const fee = parseInt(e.target.value) || 0;
                                                                setLateFee(fee);
                                                                setAmountPaid(selectedPayment.remainingDue + fee);
                                                            }}
                                                            className="w-full border border-red-200 rounded-lg px-3 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-ring" />
                                                    </div>
                                                )}

                                                <div>
                                                    <label className="block text-xs font-medium mb-1">Catatan (opsional)</label>
                                                    <input type="text" value={note} onChange={e => setNote(e.target.value)}
                                                        placeholder="Catatan pembayaran…"
                                                        className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                                                </div>

                                                {errors.general && <p className="text-red-500 text-xs">{errors.general}</p>}

                                                <div className="flex gap-2 pt-1">
                                                    <button type="submit" disabled={processing || amountPaid > maxAllowed}
                                                        className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 hover:bg-primary/90 transition-colors">
                                                        {processing ? 'Menyimpan…' : `Catat Pembayaran Ke-${selectedPayment.paymentNumber}`}
                                                    </button>
                                                    <button type="button"
                                                        onClick={() => { setSelectedPaymentId(null); setLateFee(0); setErrors({}); }}
                                                        className="px-4 py-2 rounded-lg border text-sm hover:bg-muted transition-colors">
                                                        Batal
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </form>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })()}
        </AppLayout>
    );
}
