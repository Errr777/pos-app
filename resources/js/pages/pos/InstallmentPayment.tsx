import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { router, usePage } from '@inertiajs/react';
import { useRef, useState } from 'react';
import { Search } from 'lucide-react';

interface CustomerOption {
    id: number; name: string; code: string; isBlocked: boolean; hasCredit: boolean;
}
interface PaymentRow {
    id: number; dueDate: string; amountDue: number; interestAmount: number;
    lateFeeApplied: number; totalDue: number; status: string;
}
interface PlanOption {
    id: number; saleNumber: string | null; remainingAmount: number; status: string;
    payments: PaymentRow[];
}

interface PageProps {
    customers: CustomerOption[];
    [key: string]: unknown;
}

const fmt = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Kasir', href: '/pos/terminal' },
    { title: 'Bayar Cicilan', href: '#' },
];

export default function InstallmentPaymentPage() {
    const { customers } = usePage<PageProps>().props;

    const [search, setSearch]                   = useState('');
    const [dropOpen, setDropOpen]               = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState<CustomerOption | null>(null);
    const [plans, setPlans]                     = useState<PlanOption[]>([]);
    const [loadingPlans, setLoadingPlans]       = useState(false);

    const [selectedPaymentId, setSelectedPaymentId] = useState<number | null>(null);
    const [selectedTotalDue, setSelectedTotalDue]   = useState(0);
    const [amountPaid, setAmountPaid]           = useState(0);
    const [paymentMethod, setPaymentMethod]     = useState('cash');
    const [note, setNote]                       = useState('');
    const [processing, setProcessing]           = useState(false);
    const [errors, setErrors]                   = useState<Record<string, string>>({});
    const [successMsg, setSuccessMsg]           = useState('');

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

    function selectCustomer(c: CustomerOption) {
        setSelectedCustomer(c);
        setSearch(c.name);
        setDropOpen(false);
        setSuccessMsg('');
        fetchPlans(c);
    }

    function selectPayment(p: PaymentRow) {
        setSelectedPaymentId(p.id);
        setSelectedTotalDue(p.totalDue);
        setAmountPaid(p.totalDue);
        setErrors({});
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
            note,
        }, {
            onError: (errs) => setErrors(errs as Record<string, string>),
            onSuccess: () => {
                setSuccessMsg('Pembayaran berhasil dicatat!');
                setSelectedPaymentId(null);
                setNote('');
                if (selectedCustomer) fetchPlans(selectedCustomer);
            },
            onFinish: () => setProcessing(false),
        });
    }

    const allPayments = plans.flatMap(plan =>
        plan.payments.map(p => ({ ...p, planId: plan.id, saleNumber: plan.saleNumber }))
    );

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
                <div className="flex items-center justify-between">
                    <h1 className="text-xl font-bold">Bayar Cicilan</h1>
                    <a href={route('pos.terminal')}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border bg-background hover:bg-muted transition-colors font-medium">
                        ← Terminal
                    </a>
                </div>

                {successMsg && (
                    <div className="rounded-lg border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-700">
                        {successMsg}
                    </div>
                )}

                {/* Customer search */}
                <div>
                    <label className="block text-sm font-medium mb-1">Pelanggan</label>
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
                                    <button
                                        key={c.id}
                                        type="button"
                                        onMouseDown={() => selectCustomer(c)}
                                        className="w-full text-left px-3 py-2 hover:bg-muted/60 flex items-center justify-between text-sm"
                                    >
                                        <span>
                                            {c.name}{' '}
                                            <span className="text-muted-foreground text-xs">({c.code})</span>
                                        </span>
                                        {c.isBlocked && (
                                            <span className="text-xs text-red-600 font-medium">Tertunggak</span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {loadingPlans && (
                    <p className="text-sm text-muted-foreground">Memuat cicilan…</p>
                )}

                {!loadingPlans && selectedCustomer && plans.length === 0 && (
                    <div className="rounded-xl border p-8 text-center text-sm text-muted-foreground">
                        Tidak ada cicilan aktif untuk pelanggan ini.
                    </div>
                )}

                {/* Payment list */}
                {allPayments.length > 0 && (
                    <div className="space-y-2">
                        <h2 className="text-sm font-medium">Pilih cicilan yang akan dibayar:</h2>
                        {allPayments.map(p => (
                            <div
                                key={p.id}
                                onClick={() => selectPayment(p)}
                                className={`rounded-lg border p-3 cursor-pointer transition-colors
                                    ${selectedPaymentId === p.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/30'}
                                    ${p.status === 'overdue' ? 'border-red-300' : ''}`}
                            >
                                <div className="flex justify-between text-sm">
                                    <div>
                                        <span className="font-medium">{p.saleNumber ?? '—'}</span>
                                        <span className="text-muted-foreground ml-2 text-xs">
                                            Jatuh tempo {new Date(p.dueDate).toLocaleDateString('id-ID')}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-semibold">{fmt(p.totalDue)}</span>
                                        {p.status === 'overdue' && (
                                            <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">
                                                Terlambat
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Payment form */}
                {selectedPaymentId && (
                    <form onSubmit={submitPayment}
                        className="rounded-xl border p-4 space-y-4 bg-muted/20">
                        <h2 className="font-semibold text-sm">Detail Pembayaran</h2>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-medium mb-1">Jumlah Bayar</label>
                                <input
                                    type="number" min={1}
                                    value={amountPaid}
                                    onChange={e => setAmountPaid(parseInt(e.target.value) || 0)}
                                    className="w-full border rounded-lg px-3 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-ring"
                                />
                                {errors.amount_paid && (
                                    <p className="text-red-500 text-xs mt-0.5">{errors.amount_paid}</p>
                                )}
                            </div>
                            <div>
                                <label className="block text-xs font-medium mb-1">Metode</label>
                                <select
                                    value={paymentMethod}
                                    onChange={e => setPaymentMethod(e.target.value)}
                                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                >
                                    <option value="cash">Cash</option>
                                    <option value="transfer">Transfer</option>
                                    <option value="qris">QRIS</option>
                                    <option value="card">Card</option>
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-medium mb-1">Catatan (opsional)</label>
                            <input
                                type="text" value={note}
                                onChange={e => setNote(e.target.value)}
                                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                placeholder="Catatan pembayaran…"
                            />
                        </div>
                        {errors.general && (
                            <p className="text-red-500 text-sm">{errors.general}</p>
                        )}
                        <div className="flex gap-2">
                            <button
                                type="submit" disabled={processing}
                                className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
                            >
                                {processing ? 'Menyimpan…' : 'Catat Pembayaran'}
                            </button>
                            <button
                                type="button"
                                onClick={() => setSelectedPaymentId(null)}
                                className="px-4 py-2 rounded-lg border text-sm"
                            >
                                Batal
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </AppLayout>
    );
}
