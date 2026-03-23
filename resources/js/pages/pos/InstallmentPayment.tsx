import AppLayout from '@/layouts/app-layout';
import { formatRp, fmtDate } from '@/lib/formats';
import { type BreadcrumbItem } from '@/types';
import { router, usePage } from '@inertiajs/react';
import { useRef, useState } from 'react';
import { Search, AlertCircle, FileText, Info, ChevronDown, ChevronRight } from 'lucide-react';

interface CustomerOption {
    id: number; name: string; code: string; isBlocked: boolean; hasCredit: boolean;
    remainingTotal: number; activePlans: number; totalPayments: number; paidPayments: number;
    saleNumbers: string[];
}
interface PaymentRow {
    id: number; dueDate: string; amountDue: number; interestAmount: number;
    lateFeeApplied: number; totalDue: number; alreadyPaid: number; remainingDue: number;
    isPaid: boolean; status: string; paymentNumber: number; remainingAfter: number;
    paymentMethod: string | null; paidAt: string | null;
}
interface PlanOption {
    id: number; saleNumber: string | null; occurredAt: string | null; createdAt: string | null;
    totalAmount: number; paidAmount: number; remainingAmount: number;
    interestRate: number; lateFeeAmount: number;
    status: string; totalPayments: number; note: string | null; canPayExtra: boolean;
    payments: PaymentRow[];
}

interface PageProps {
    customers: CustomerOption[];
    [key: string]: unknown;
}

const METHOD_LABEL: Record<string, string> = {
    cash: 'Tunai', transfer: 'Transfer', qris: 'QRIS', card: 'Kartu',
};

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Daftar Kredit', href: '/pos/installments' },
];

export default function InstallmentPaymentPage() {
    const { customers } = usePage<PageProps>().props;

    const [search, setSearch]                     = useState('');
    const [dropOpen, setDropOpen]                 = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState<CustomerOption | null>(null);
    const [plans, setPlans]                       = useState<PlanOption[]>([]);
    const [loadingPlans, setLoadingPlans]         = useState(false);
    const [modalOpen, setModalOpen]               = useState(false);
    const [detailModalOpen, setDetailModalOpen]   = useState(false);
    const [detailExpandedPlan, setDetailExpandedPlan] = useState<number | null>(null);
    const [successMsg, setSuccessMsg]             = useState('');

    // Extra-pay state (when all scheduled payments done but balance remains)
    const [extraPayPlan, setExtraPayPlan]               = useState<PlanOption | null>(null);
    const [extraPayAmount, setExtraPayAmount]           = useState(0);
    const [extraPayMethod, setExtraPayMethod]           = useState('cash');
    const [extraPayNote, setExtraPayNote]               = useState('');
    const [extraPayProcessing, setExtraPayProcessing]   = useState(false);
    const [extraPayErrors, setExtraPayErrors]           = useState<Record<string, string>>({});

    // Normal payment form state
    const [selectedPaymentId, setSelectedPaymentId] = useState<number | null>(null);
    const [selectedPayment, setSelectedPayment]     = useState<PaymentRow | null>(null);
    const [selectedPlan, setSelectedPlan]           = useState<PlanOption | null>(null);
    const [viewingPaidPayment, setViewingPaidPayment] = useState<PaymentRow | null>(null);
    const [amountPaid, setAmountPaid]               = useState(0);
    const [paymentMethod, setPaymentMethod]         = useState('cash');
    const [lateFee, setLateFee]                     = useState(0);
    const [note, setNote]                           = useState('');
    const [processing, setProcessing]               = useState(false);
    const [errors, setErrors]                       = useState<Record<string, string>>({});

    const searchRef = useRef<HTMLInputElement>(null);

    const filteredCustomers = customers.filter(c => {
        const q = search.toLowerCase();
        return !q || c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q);
    }).slice(0, 15);

    function fetchPlans(c: CustomerOption) {
        setLoadingPlans(true);
        setPlans([]);
        setSelectedPaymentId(null);
        fetch(route('installments.customer_plans', { customer: c.id }), {
            headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        })
            .then(r => r.json())
            .then(data => setPlans(data.plans ?? []))
            .finally(() => setLoadingPlans(false));
    }

    function openDetail(c: CustomerOption) {
        setSelectedCustomer(c);
        setDetailModalOpen(true);
        setModalOpen(false);
        setDetailExpandedPlan(null);
        setSuccessMsg('');
        fetchPlans(c);
    }

    function closeDetail() {
        setDetailModalOpen(false);
        setPlans([]);
        setDetailExpandedPlan(null);
    }

    function openPaymentFromDetail() {
        setDetailModalOpen(false);
        setModalOpen(true);
        // plans already loaded, payment form will show on installment click
    }

    function selectCustomer(c: CustomerOption) {
        setSelectedCustomer(c);
        setSearch(c.name);
        setDropOpen(false);
        setSuccessMsg('');
        setSelectedPaymentId(null);
        setErrors({});
        setModalOpen(true);
        fetchPlans(c);
    }

    function closeModal() {
        setModalOpen(false);
        setSelectedPaymentId(null);
        setSelectedPayment(null);
        setSelectedPlan(null);
        setViewingPaidPayment(null);
        setAmountPaid(0);
        setLateFee(0);
        setNote('');
        setErrors({});
        setExtraPayPlan(null);
        setExtraPayAmount(0);
        setExtraPayNote('');
        setExtraPayErrors({});
    }

    function openExtraPay(plan: PlanOption) {
        setSelectedPaymentId(null);
        setSelectedPayment(null);
        setViewingPaidPayment(null);
        setExtraPayPlan(plan);
        setExtraPayAmount(plan.remainingAmount);
        setExtraPayErrors({});
    }

    function submitExtraPayment(e: React.FormEvent) {
        e.preventDefault();
        if (!extraPayPlan) return;
        setExtraPayProcessing(true);
        setExtraPayErrors({});
        router.post(route('installments.pay_extra', { plan: extraPayPlan.id }), {
            amount_paid: extraPayAmount,
            payment_method: extraPayMethod,
            note: extraPayNote,
        }, {
            onError: (errs) => setExtraPayErrors(errs as Record<string, string>),
            onSuccess: () => {
                setSuccessMsg('Pembayaran tambahan berhasil dicatat!');
                closeModal();
                if (selectedCustomer) fetchPlans(selectedCustomer);
            },
            onFinish: () => setExtraPayProcessing(false),
        });
    }

    function selectPayment(p: PaymentRow) {
        setViewingPaidPayment(null);
        setExtraPayPlan(null);
        setSelectedPaymentId(p.id);
        setSelectedPayment(p);
        setSelectedPlan(plans.find(pl => pl.payments.some(pm => pm.id === p.id)) ?? null);
        setAmountPaid(p.remainingDue);
        setLateFee(0);
        setErrors({});
    }

    function viewPaidPayment(p: PaymentRow) {
        setSelectedPaymentId(null);
        setSelectedPayment(null);
        setExtraPayPlan(null);
        setViewingPaidPayment(viewingPaidPayment?.id === p.id ? null : p);
    }

    function reloadAndAdvance(c: CustomerOption) {
        setLoadingPlans(true);
        fetch(route('installments.customer_plans', { customer: c.id }), {
            headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        })
            .then(r => r.json())
            .then(data => {
                const freshPlans: PlanOption[] = data.plans ?? [];
                setPlans(freshPlans);

                // Auto-select first unpaid payment across all plans
                const nextUnpaid = freshPlans.flatMap(p => p.payments).find(p => !p.isPaid);
                if (nextUnpaid) {
                    const nextPlan = freshPlans.find(pl => pl.payments.some(pm => pm.id === nextUnpaid.id)) ?? null;
                    setSelectedPaymentId(nextUnpaid.id);
                    setSelectedPayment(nextUnpaid);
                    setSelectedPlan(nextPlan);
                    setAmountPaid(nextUnpaid.remainingDue);
                    setLateFee(0);
                    setErrors({});
                    setViewingPaidPayment(null);
                    setExtraPayPlan(null);
                } else {
                    // All paid — close modal after brief delay
                    setTimeout(closeModal, 800);
                }
            })
            .finally(() => setLoadingPlans(false));
    }

    function submitPayment(e: React.FormEvent) {
        e.preventDefault();
        if (!selectedPaymentId) return;
        setProcessing(true);
        setErrors({});
        router.post(route('installments.pay_terminal'), {
            installment_payment_id: selectedPaymentId,
            amount_paid: amountPaid,
            payment_method: paymentMethod,
            late_fee: lateFee,
            note,
        }, {
            onError: (errs) => setErrors(errs as Record<string, string>),
            onSuccess: () => {
                setSuccessMsg('Pembayaran berhasil dicatat!');
                setAmountPaid(0);
                setLateFee(0);
                setNote('');
                if (selectedCustomer) reloadAndAdvance(selectedCustomer);
            },
            onFinish: () => setProcessing(false),
        });
    }

    const creditCustomers = customers.filter(c => c.hasCredit);
    const overdueCustomers = creditCustomers.filter(c => c.isBlocked);

    return (
        <>
        <AppLayout breadcrumbs={breadcrumbs}>
            <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold">Daftar Kredit</h1>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            {creditCustomers.length} pelanggan aktif
                            {overdueCustomers.length > 0 && (
                                <span className="ml-2 text-red-600 font-medium">· {overdueCustomers.length} tertunggak</span>
                            )}
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <a href={route('pos.terminal')}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border bg-background hover:bg-muted transition-colors font-medium">
                            ← Terminal
                        </a>
                        <a href={route('installments.history')}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border bg-background hover:bg-muted transition-colors font-medium">
                            Riwayat →
                        </a>
                    </div>
                </div>

                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                        ref={searchRef}
                        type="text"
                        value={search}
                        onChange={e => {
                            setSearch(e.target.value);
                            setDropOpen(true);
                            setSelectedCustomer(null);
                            setPlans([]);
                        }}
                        onFocus={() => setDropOpen(true)}
                        onBlur={() => setTimeout(() => setDropOpen(false), 150)}
                        placeholder="Cari nama atau kode pelanggan…"
                        className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    {dropOpen && filteredCustomers.length > 0 && (
                        <div className="absolute left-0 right-0 top-full mt-1 z-20 bg-popover border rounded-lg shadow-lg max-h-52 overflow-y-auto">
                            {filteredCustomers.map(c => (
                                <button key={c.id} type="button" onMouseDown={() => selectCustomer(c)}
                                    className="w-full text-left px-3 py-2 hover:bg-muted/60 flex items-center justify-between text-sm">
                                    <span>
                                        {c.name} <span className="text-muted-foreground text-xs">({c.code})</span>
                                    </span>
                                    {c.isBlocked && <span className="text-xs text-red-600 font-medium">Tertunggak</span>}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {successMsg && (
                    <div className="rounded-lg border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-700">
                        {successMsg}
                    </div>
                )}

                {/* Credit customer list */}
                {creditCustomers.length > 0 && (
                    <div className="rounded-lg border overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/50 border-b">
                                <tr>
                                    <th className="text-left px-4 py-2.5 font-medium">Pelanggan</th>
                                    <th className="text-center px-4 py-2.5 font-medium">Cicilan</th>
                                    <th className="text-right px-4 py-2.5 font-medium">Total Sisa</th>
                                    <th className="text-center px-4 py-2.5 font-medium">Status</th>
                                    <th className="px-4 py-2.5" />
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {creditCustomers.map(c => (
                                    <tr key={c.id} className={`hover:bg-muted/30 transition-colors ${selectedCustomer?.id === c.id ? 'bg-primary/5' : ''}`}>
                                        <td className="px-4 py-3">
                                            <div className="font-medium">{c.name}</div>
                                            <div className="text-xs text-muted-foreground">{c.code}</div>
                                            {c.saleNumbers.length > 0 && (
                                                <div className="flex flex-wrap gap-1 mt-1">
                                                    {c.saleNumbers.map(sn => (
                                                        <span key={sn} className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{sn}</span>
                                                    ))}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className="font-medium">{c.paidPayments}/{c.totalPayments}</span>
                                            <span className="text-muted-foreground text-xs ml-1">kali</span>
                                        </td>
                                        <td className="px-4 py-3 text-right font-medium">{formatRp(c.remainingTotal)}</td>
                                        <td className="px-4 py-3 text-center">
                                            {c.isBlocked
                                                ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700"><AlertCircle size={11} />Tertunggak</span>
                                                : <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">Lancar</span>
                                            }
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <div className="flex items-center justify-end gap-1.5">
                                                <button onClick={() => openDetail(c)}
                                                    title="Detail Kredit"
                                                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg border hover:bg-muted transition-colors">
                                                    <Info size={11} /> Detail
                                                </button>
                                                <button onClick={() => selectCustomer(c)}
                                                    className="px-2.5 py-1 text-xs rounded-lg border border-primary text-primary hover:bg-primary/10 transition-colors font-medium">
                                                    Bayar
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {creditCustomers.length === 0 && (
                    <div className="rounded-xl border p-10 text-center text-muted-foreground">
                        Tidak ada pelanggan dengan cicilan aktif.
                    </div>
                )}
            </div>
        </AppLayout>

        {/* ── Payment Modal ── */}
        {modalOpen && selectedCustomer && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
                <div className="bg-background rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">

                    <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b">
                        <div>
                            <h2 className="font-semibold text-base">{selectedCustomer.name}</h2>
                            <p className="text-xs text-muted-foreground">{selectedCustomer.code}</p>
                        </div>
                        <button onClick={closeModal} className="text-muted-foreground hover:text-foreground text-xl leading-none px-1">×</button>
                    </div>

                    <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">

                        {loadingPlans && (
                            <p className="text-sm text-muted-foreground text-center py-6">Memuat cicilan…</p>
                        )}

                        {!loadingPlans && plans.length === 0 && (
                            <p className="text-sm text-muted-foreground text-center py-6">Tidak ada cicilan aktif.</p>
                        )}

                        {!loadingPlans && plans.map(plan => (
                            <div key={plan.id} className="rounded-lg border overflow-hidden">

                                {/* Plan summary header */}
                                <div className="bg-muted/40 px-4 py-3 border-b">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="font-mono text-xs font-semibold">{plan.saleNumber ?? '—'}</span>
                                        {plan.status === 'overdue' && (
                                            <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                                                <AlertCircle size={11} /> Tertunggak
                                            </span>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-3 gap-2 text-xs">
                                        <div>
                                            <p className="text-muted-foreground">Total Kredit</p>
                                            <p className="font-semibold mt-0.5">{formatRp(plan.totalAmount)}</p>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground">Sudah Dibayar</p>
                                            <p className="font-semibold mt-0.5 text-emerald-600">{formatRp(plan.paidAmount)}</p>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground">Sisa</p>
                                            <p className="font-semibold mt-0.5 text-amber-600">{formatRp(plan.remainingAmount)}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Installment rows */}
                                <div className="divide-y">
                                    {plan.payments.map(p => {
                                        const isSelected = selectedPaymentId === p.id;
                                        return (
                                            <div key={p.id}>
                                                {/* Row — paid rows fully disabled; selected row non-clickable */}
                                                <div
                                                    onClick={() => {
                                                        if (p.isPaid || isSelected) return;
                                                        selectPayment(p);
                                                    }}
                                                    className={[
                                                        'px-4 py-3 flex items-center justify-between transition-colors',
                                                        p.isPaid
                                                            ? 'opacity-50 cursor-default bg-muted/20'
                                                            : isSelected
                                                                ? 'bg-primary/5 border-l-2 border-primary cursor-default'
                                                                : 'cursor-pointer hover:bg-muted/30',
                                                        p.status === 'overdue' && !p.isPaid && !isSelected ? 'bg-red-50/50' : '',
                                                    ].join(' ')}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        {p.isPaid ? (
                                                            <span className="text-emerald-600 font-bold text-base">✓</span>
                                                        ) : isSelected ? (
                                                            <span className="w-3.5 h-3.5 rounded-full border-2 border-primary bg-primary/20 inline-block flex-shrink-0" />
                                                        ) : null}
                                                        <div>
                                                            <p className="text-sm font-medium">
                                                                Ke-{p.paymentNumber} · {new Date(p.dueDate).toLocaleDateString('id-ID')}
                                                            </p>
                                                            {p.interestAmount > 0 && (
                                                                <p className="text-xs text-muted-foreground">Bunga: {formatRp(p.interestAmount)}</p>
                                                            )}
                                                            {p.lateFeeApplied > 0 && (
                                                                <p className="text-xs text-red-500">Denda: {formatRp(p.lateFeeApplied)}</p>
                                                            )}
                                                            {isSelected && (
                                                                <p className="text-xs text-primary font-medium">Sedang diproses…</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        {p.isPaid ? (
                                                            <>
                                                                <p className="text-sm text-emerald-700 font-medium">{formatRp(p.alreadyPaid)}</p>
                                                                {p.paidAt && (
                                                                    <p className="text-xs text-muted-foreground">{fmtDate(p.paidAt)}</p>
                                                                )}
                                                            </>
                                                        ) : (
                                                            <>
                                                                <p className="font-semibold text-sm">{formatRp(p.remainingDue)}</p>
                                                                {p.alreadyPaid > 0 && (
                                                                    <p className="text-xs text-emerald-600">Dibayar: {formatRp(p.alreadyPaid)}</p>
                                                                )}
                                                                {p.status === 'overdue' && !isSelected && (
                                                                    <span className="text-xs text-red-600 font-medium">Terlambat</span>
                                                                )}
                                                            </>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Read-only detail for paid rows (toggled via viewingPaidPayment) */}
                                                {p.isPaid && viewingPaidPayment?.id === p.id && (
                                                    <div className="px-4 py-3 bg-emerald-50/60 border-t border-emerald-100 text-xs space-y-1">
                                                        <p className="font-medium text-emerald-800 mb-1.5">Detail Pembayaran</p>
                                                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-muted-foreground">
                                                            <span>Tanggal Bayar</span>
                                                            <span className="text-foreground font-medium">
                                                                {p.paidAt ? fmtDate(p.paidAt) : '—'}
                                                            </span>
                                                            <span>Jumlah Dibayar</span>
                                                            <span className="text-foreground font-medium">{formatRp(p.alreadyPaid)}</span>
                                                            <span>Pokok Cicilan</span>
                                                            <span className="text-foreground font-medium">{formatRp(p.amountDue)}</span>
                                                            {p.interestAmount > 0 && <>
                                                                <span>Bunga</span>
                                                                <span className="text-foreground font-medium">{formatRp(p.interestAmount)}</span>
                                                            </>}
                                                            {p.lateFeeApplied > 0 && <>
                                                                <span>Denda</span>
                                                                <span className="text-red-600 font-medium">{formatRp(p.lateFeeApplied)}</span>
                                                            </>}
                                                            <span>Metode</span>
                                                            <span className="text-foreground font-medium">
                                                                {p.paymentMethod ? (METHOD_LABEL[p.paymentMethod] ?? p.paymentMethod) : '—'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Extra payment — all scheduled paid but balance remains */}
                                {plan.canPayExtra && (
                                    <div className="px-4 py-3 border-t bg-amber-50/60">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-sm font-medium text-amber-800">Sisa Pembayaran</p>
                                                <p className="text-xs text-amber-600 mt-0.5">Di luar jadwal cicilan yang disepakati</p>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <p className="font-semibold text-sm text-amber-800">{formatRp(plan.remainingAmount)}</p>
                                                <button onClick={() => openExtraPay(plan)}
                                                    className="px-3 py-1.5 text-xs rounded-lg bg-amber-600 text-white font-medium hover:bg-amber-700 transition-colors">
                                                    Bayar Sisa
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}

                        {/* Payment form */}
                        {selectedPaymentId && selectedPayment && (
                            <form onSubmit={submitPayment} className="rounded-lg border p-4 space-y-3 bg-muted/20">
                                <div className="flex items-center justify-between">
                                    <h3 className="font-semibold text-sm">Catat Pembayaran</h3>
                                    <div className="text-right text-xs text-muted-foreground">
                                        <span className="font-medium text-foreground">Ke-{selectedPayment.paymentNumber}</span>
                                        {' · '}
                                        {selectedPayment.remainingAfter === 0
                                            ? <span className="text-emerald-600 font-medium">Cicilan terakhir</span>
                                            : <span>sisa <span className="font-medium text-foreground">{selectedPayment.remainingAfter}×</span> lagi</span>
                                        }
                                    </div>
                                </div>

                                {selectedPayment.remainingAfter === 0 ? (
                                    <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
                                        Cicilan terakhir · nominal{' '}
                                        <span className="font-semibold">{formatRp(selectedPayment.remainingDue)}</span>.
                                        Jika dibayar kurang, sisa otomatis dijadwalkan ke cicilan berikutnya.
                                    </div>
                                ) : (
                                    <div className="rounded-md bg-muted/60 border px-3 py-2 text-xs text-muted-foreground">
                                        Nominal cicilan:{' '}
                                        <span className="font-semibold text-foreground">{formatRp(selectedPayment.remainingDue)}</span>.
                                        Pembayaran kurang akan dicatat sebagai cicilan parsial.
                                    </div>
                                )}

                                {(() => {
                                    if (!selectedPlan) return null;
                                    const totalObligation = selectedPlan.payments.reduce((s, p) => s + p.totalDue, 0);
                                    const maxAllowed = Math.max(0, totalObligation - selectedPlan.paidAmount);
                                    if (amountPaid > maxAllowed) {
                                        return (
                                            <div className="rounded-md bg-red-50 border border-red-300 px-3 py-2 text-xs text-red-800 font-medium">
                                                Pembayaran melebihi total hutang. Maksimum yang bisa dibayar:{' '}
                                                <span className="font-bold">{formatRp(maxAllowed)}</span>.
                                            </div>
                                        );
                                    }
                                    return null;
                                })()}

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-medium mb-1">Jumlah Bayar</label>
                                        <input
                                            type="number" min={1} max={selectedPayment.remainingDue + lateFee}
                                            value={amountPaid}
                                            onChange={e => setAmountPaid(parseInt(e.target.value) || 0)}
                                            className="w-full border rounded-lg px-3 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-ring"
                                        />
                                        {errors.amount_paid && <p className="text-red-500 text-xs mt-0.5">{errors.amount_paid}</p>}
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium mb-1">Metode</label>
                                        <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}
                                            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                                            <option value="cash">Cash</option>
                                            <option value="transfer">Transfer</option>
                                            <option value="qris">QRIS</option>
                                            <option value="card">Card</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Denda — shown for overdue or last installment */}
                                {(selectedPayment.status === 'overdue' || selectedPayment.remainingAfter === 0) && (
                                    <div>
                                        <label className="block text-xs font-medium mb-1">
                                            Denda Keterlambatan
                                            <span className="ml-1 text-muted-foreground font-normal">(opsional, default 0)</span>
                                        </label>
                                        <input
                                            type="number" min={0}
                                            value={lateFee}
                                            onChange={e => {
                                                const fee = parseInt(e.target.value) || 0;
                                                setLateFee(fee);
                                                setAmountPaid(selectedPayment.remainingDue + fee);
                                            }}
                                            className="w-full border border-red-200 rounded-lg px-3 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-ring"
                                        />
                                        {errors.late_fee && <p className="text-red-500 text-xs mt-0.5">{errors.late_fee}</p>}
                                    </div>
                                )}

                                <div>
                                    <label className="block text-xs font-medium mb-1">Catatan (opsional)</label>
                                    <input type="text" value={note} onChange={e => setNote(e.target.value)}
                                        className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                        placeholder="Catatan pembayaran…" />
                                </div>
                                {errors.general && <p className="text-red-500 text-sm">{errors.general}</p>}
                                <div className="flex gap-2">
                                    <button type="submit" disabled={processing || (() => {
                                        if (!selectedPlan) return false;
                                        const totalObligation = selectedPlan.payments.reduce((s, p) => s + p.totalDue, 0);
                                        return amountPaid > Math.max(0, totalObligation - selectedPlan.paidAmount);
                                    })()}
                                        className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50">
                                        {processing ? 'Menyimpan…' : 'Catat Pembayaran'}
                                    </button>
                                    <button type="button" onClick={() => { setSelectedPaymentId(null); setLateFee(0); }}
                                        className="px-4 py-2 rounded-lg border text-sm">
                                        Batal
                                    </button>
                                </div>
                            </form>
                        )}

                        {/* Extra payment form */}
                        {extraPayPlan && (
                            <form onSubmit={submitExtraPayment} className="rounded-lg border border-amber-200 p-4 space-y-3 bg-amber-50/40">
                                <div className="flex items-center justify-between">
                                    <h3 className="font-semibold text-sm text-amber-900">Pembayaran Sisa</h3>
                                    <span className="text-xs text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">Di luar jadwal cicilan</span>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-medium mb-1">Jumlah Bayar</label>
                                        <input type="number" min={1} max={extraPayPlan.remainingAmount}
                                            value={extraPayAmount}
                                            onChange={e => setExtraPayAmount(parseInt(e.target.value) || 0)}
                                            className="w-full border rounded-lg px-3 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-ring" />
                                        {extraPayErrors.amount_paid && <p className="text-red-500 text-xs mt-0.5">{extraPayErrors.amount_paid}</p>}
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium mb-1">Metode</label>
                                        <select value={extraPayMethod} onChange={e => setExtraPayMethod(e.target.value)}
                                            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                                            <option value="cash">Cash</option>
                                            <option value="transfer">Transfer</option>
                                            <option value="qris">QRIS</option>
                                            <option value="card">Card</option>
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium mb-1">Catatan (opsional)</label>
                                    <input type="text" value={extraPayNote} onChange={e => setExtraPayNote(e.target.value)}
                                        className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                        placeholder="Catatan pembayaran tambahan…" />
                                </div>
                                {extraPayErrors.general && <p className="text-red-500 text-sm">{extraPayErrors.general}</p>}
                                <div className="flex gap-2">
                                    <button type="submit" disabled={extraPayProcessing}
                                        className="flex-1 py-2 rounded-lg bg-amber-600 text-white text-sm font-medium disabled:opacity-50 hover:bg-amber-700">
                                        {extraPayProcessing ? 'Menyimpan…' : 'Catat Pembayaran Sisa'}
                                    </button>
                                    <button type="button" onClick={() => setExtraPayPlan(null)}
                                        className="px-4 py-2 rounded-lg border text-sm">
                                        Batal
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>

                    <div className="px-5 py-3 border-t flex justify-end">
                        <button onClick={closeModal} className="px-4 py-2 text-sm rounded-lg border hover:bg-muted transition-colors">
                            Tutup
                        </button>
                    </div>
                </div>
            </div>
        )}
        {/* ── Detail Modal ── */}
        {detailModalOpen && selectedCustomer && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
                <div className="bg-background rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">

                    <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b">
                        <div>
                            <h2 className="font-semibold text-base">{selectedCustomer.name}</h2>
                            <p className="text-xs text-muted-foreground">{selectedCustomer.code}</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button onClick={openPaymentFromDetail}
                                className="px-3 py-1.5 text-xs rounded-lg border border-primary text-primary hover:bg-primary/10 transition-colors font-medium">
                                Bayar Cicilan
                            </button>
                            <button onClick={closeDetail} className="text-muted-foreground hover:text-foreground text-xl leading-none px-1">×</button>
                        </div>
                    </div>

                    <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">
                        {loadingPlans && (
                            <p className="text-sm text-muted-foreground text-center py-8">Memuat data kredit…</p>
                        )}
                        {!loadingPlans && plans.length === 0 && (
                            <p className="text-sm text-muted-foreground text-center py-8">Tidak ada data kredit.</p>
                        )}

                        {!loadingPlans && plans.map(plan => {
                            const paidCount   = plan.payments.filter(p => p.isPaid).length;
                            const totalLateFee = plan.payments.reduce((s, p) => s + p.lateFeeApplied, 0);
                            const totalInterest = plan.payments.reduce((s, p) => s + p.interestAmount, 0);
                            const nextDue = plan.payments.find(p => !p.isPaid);
                            const isExpanded = detailExpandedPlan === plan.id;
                            const progressPct = plan.totalPayments > 0
                                ? Math.round((paidCount / plan.totalPayments) * 100) : 0;

                            const statusCls: Record<string, string> = {
                                active:    'bg-blue-100 text-blue-700',
                                overdue:   'bg-red-100 text-red-700',
                                completed: 'bg-emerald-100 text-emerald-700',
                                cancelled: 'bg-gray-100 text-gray-500',
                            };
                            const statusLabel: Record<string, string> = {
                                active: 'Aktif', overdue: 'Tertunggak', completed: 'Lunas', cancelled: 'Dibatalkan',
                            };

                            return (
                                <div key={plan.id} className="rounded-lg border overflow-hidden">
                                    {/* Plan header */}
                                    <div className="bg-muted/40 px-4 py-3 border-b flex items-center justify-between gap-3">
                                        <div>
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-mono text-xs font-semibold">{plan.saleNumber ?? '—'}</span>
                                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusCls[plan.status] ?? 'bg-muted'}`}>
                                                    {statusLabel[plan.status] ?? plan.status}
                                                </span>
                                            </div>
                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                {plan.occurredAt ? fmtDate(plan.occurredAt) : plan.createdAt ? fmtDate(plan.createdAt) : '—'}
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const w = window.open(
                                                    route('installments.invoice', { plan: plan.id }),
                                                    'invoice',
                                                    'width=900,height=700,toolbar=no,location=no,menubar=no,scrollbars=yes,resizable=yes'
                                                );
                                                if (!w) alert('Popup diblokir. Izinkan popup untuk membuka invoice.');
                                            }}
                                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg border hover:bg-muted transition-colors shrink-0">
                                            <FileText size={11} /> Invoice
                                        </button>
                                    </div>

                                    {/* Financial summary */}
                                    <div className="px-4 py-3 grid grid-cols-3 gap-3 text-xs border-b">
                                        <div>
                                            <p className="text-muted-foreground">Total Kredit</p>
                                            <p className="font-semibold mt-0.5">{formatRp(plan.totalAmount)}</p>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground">Sudah Dibayar</p>
                                            <p className="font-semibold mt-0.5 text-emerald-600">{formatRp(plan.paidAmount)}</p>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground">Sisa Hutang</p>
                                            <p className={`font-semibold mt-0.5 ${plan.remainingAmount > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                                                {formatRp(plan.remainingAmount)}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Progress + details */}
                                    <div className="px-4 py-3 space-y-3 text-xs border-b">
                                        {/* Cicilan progress */}
                                        <div>
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-muted-foreground">Progress Cicilan</span>
                                                <span className="font-medium">{paidCount} / {plan.totalPayments} lunas</span>
                                            </div>
                                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                                                <div className="h-full bg-emerald-500 rounded-full transition-all"
                                                    style={{ width: `${progressPct}%` }} />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                                            {plan.interestRate > 0 && (
                                                <>
                                                    <span className="text-muted-foreground">Bunga / Cicilan</span>
                                                    <span className="font-medium">{plan.interestRate}% · {formatRp(totalInterest)} total</span>
                                                </>
                                            )}
                                            {totalLateFee > 0 && (
                                                <>
                                                    <span className="text-muted-foreground">Total Denda</span>
                                                    <span className="font-medium text-red-600">{formatRp(totalLateFee)}</span>
                                                </>
                                            )}
                                            {nextDue && (
                                                <>
                                                    <span className="text-muted-foreground">Jatuh Tempo Berikutnya</span>
                                                    <span className={`font-medium ${nextDue.status === 'overdue' ? 'text-red-600' : ''}`}>
                                                        {new Date(nextDue.dueDate).toLocaleDateString('id-ID')}
                                                        {' · '}{formatRp(nextDue.remainingDue)}
                                                    </span>
                                                </>
                                            )}
                                            {plan.note && (
                                                <>
                                                    <span className="text-muted-foreground">Catatan</span>
                                                    <span className="font-medium">{plan.note}</span>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* Jadwal cicilan (expandable) */}
                                    <button type="button"
                                        onClick={() => setDetailExpandedPlan(isExpanded ? null : plan.id)}
                                        className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-medium hover:bg-muted/30 transition-colors">
                                        <span>Jadwal Cicilan</span>
                                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                    </button>

                                    {isExpanded && (
                                        <div className="overflow-x-auto border-t">
                                            <table className="w-full text-xs">
                                                <thead className="bg-muted/40 border-b">
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
                                                <tbody className="divide-y">
                                                    {plan.payments.map((p, idx) => (
                                                        <tr key={p.id} className={p.isPaid ? 'opacity-60 bg-muted/10' : p.status === 'overdue' ? 'bg-red-50/40' : ''}>
                                                            <td className="px-3 py-2 text-muted-foreground">{idx + 1}</td>
                                                            <td className="px-3 py-2">{new Date(p.dueDate).toLocaleDateString('id-ID')}</td>
                                                            <td className="px-3 py-2 text-right">{formatRp(p.amountDue)}</td>
                                                            <td className="px-3 py-2 text-right">{p.interestAmount > 0 ? formatRp(p.interestAmount) : '—'}</td>
                                                            <td className="px-3 py-2 text-right">
                                                                {p.lateFeeApplied > 0
                                                                    ? <span className="text-red-600">{formatRp(p.lateFeeApplied)}</span>
                                                                    : '—'}
                                                            </td>
                                                            <td className="px-3 py-2 text-right font-medium">{formatRp(p.totalDue)}</td>
                                                            <td className="px-3 py-2 text-right">
                                                                {p.alreadyPaid > 0
                                                                    ? <span className="text-emerald-600">{formatRp(p.alreadyPaid)}</span>
                                                                    : '—'}
                                                            </td>
                                                            <td className="px-3 py-2">{p.paidAt ? fmtDate(p.paidAt) : '—'}</td>
                                                            <td className="px-3 py-2">
                                                                {p.paymentMethod ? (METHOD_LABEL[p.paymentMethod] ?? p.paymentMethod) : '—'}
                                                            </td>
                                                            <td className="px-3 py-2 text-center">
                                                                {p.isPaid
                                                                    ? <span className="px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">Lunas</span>
                                                                    : p.status === 'overdue'
                                                                        ? <span className="px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">Terlambat</span>
                                                                        : <span className="px-1.5 py-0.5 rounded-full bg-yellow-100 text-yellow-700 font-medium">Pending</span>
                                                                }
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    <div className="px-5 py-3 border-t flex justify-end">
                        <button onClick={closeDetail} className="px-4 py-2 text-sm rounded-lg border hover:bg-muted transition-colors">
                            Tutup
                        </button>
                    </div>
                </div>
            </div>
        )}
        </>
    );
}
