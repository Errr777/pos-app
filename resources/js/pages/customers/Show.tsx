import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { router, usePage, useForm } from '@inertiajs/react';
import { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';

interface CustomerInfo {
    id: number; name: string; code: string; phone: string | null;
    email: string | null; address: string | null; city: string | null; notes: string | null;
}

interface PaymentRow {
    id: number; dueDate: string; amountDue: number; interestAmount: number;
    lateFeeApplied: number; totalDue: number; amountPaid: number; paidAt: string | null;
    status: 'pending' | 'paid' | 'overdue' | 'partial'; paymentMethod: string | null; note: string | null;
}

interface PlanRow {
    id: number; saleNumber: string | null; occurredAt: string | null; grandTotal: number;
    totalAmount: number; paidAmount: number; remainingAmount: number;
    installmentCount: number; interestRate: number; lateFeeAmount: number;
    status: 'active' | 'completed' | 'overdue' | 'cancelled'; note: string | null;
    payments: PaymentRow[];
}

interface PageProps {
    customer: CustomerInfo;
    plans: PlanRow[];
    totalOutstanding: number;
    isBlocked: boolean;
    permissions: Record<string, Record<string, boolean>>;
    [key: string]: unknown;
}

const fmt = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;

const statusStyle: Record<string, { label: string; cls: string }> = {
    active:    { label: 'Aktif',        cls: 'bg-blue-100 text-blue-700' },
    completed: { label: 'Lunas',        cls: 'bg-green-100 text-green-700' },
    overdue:   { label: 'Jatuh Tempo',  cls: 'bg-red-100 text-red-700' },
    cancelled: { label: 'Dibatalkan',   cls: 'bg-gray-100 text-gray-500' },
    pending:   { label: 'Menunggu',     cls: 'bg-yellow-100 text-yellow-700' },
    paid:      { label: 'Dibayar',      cls: 'bg-green-100 text-green-700' },
    partial:   { label: 'Sebagian',     cls: 'bg-orange-100 text-orange-700' },
};

function PaymentForm({ payment, planId, onDone }: {
    payment: PaymentRow; planId: number; onDone: () => void;
}) {
    const form = useForm({
        amount_paid: String(payment.totalDue),
        payment_method: 'cash',
        note: '',
    });

    function submit(e: React.FormEvent) {
        e.preventDefault();
        form.post(route('installments.pay', { plan: planId, payment: payment.id }), {
            onSuccess: onDone,
        });
    }

    return (
        <form onSubmit={submit} className="mt-2 p-3 rounded-lg border bg-muted/30 space-y-3 text-sm">
            <div className="flex gap-3 flex-wrap">
                <div>
                    <label className="block text-xs font-medium mb-1">Jumlah Bayar</label>
                    <input type="number" min={1}
                        value={form.data.amount_paid}
                        onChange={e => form.setData('amount_paid', e.target.value)}
                        className="border rounded px-2 py-1 w-36 text-right" />
                    {form.errors.amount_paid && (
                        <p className="text-red-500 text-xs mt-0.5">{form.errors.amount_paid}</p>
                    )}
                </div>
                <div>
                    <label className="block text-xs font-medium mb-1">Metode</label>
                    <select value={form.data.payment_method}
                        onChange={e => form.setData('payment_method', e.target.value)}
                        className="border rounded px-2 py-1">
                        <option value="cash">Cash</option>
                        <option value="transfer">Transfer</option>
                        <option value="qris">QRIS</option>
                        <option value="card">Card</option>
                    </select>
                </div>
                <div className="flex-1 min-w-32">
                    <label className="block text-xs font-medium mb-1">Catatan</label>
                    <input type="text" value={form.data.note}
                        onChange={e => form.setData('note', e.target.value)}
                        className="border rounded px-2 py-1 w-full"
                        placeholder="Opsional" />
                </div>
            </div>
            <div className="flex gap-2">
                <button type="submit" disabled={form.processing}
                    className="px-3 py-1.5 rounded bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50">
                    {form.processing ? 'Menyimpan…' : 'Catat Pembayaran'}
                </button>
                <button type="button" onClick={onDone}
                    className="px-3 py-1.5 rounded border text-xs">Batal</button>
            </div>
        </form>
    );
}

export default function CustomerShow() {
    const { customer, plans, totalOutstanding, isBlocked, permissions } =
        usePage<PageProps>().props;
    const canWrite = permissions?.pos?.can_write ?? false;

    const [expandedPlan, setExpandedPlan] = useState<number | null>(plans[0]?.id ?? null);
    const [payingPaymentId, setPayingPaymentId] = useState<number | null>(null);

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Pelanggan', href: route('customers.index') },
        { title: customer.name, href: '#' },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
                {/* Header */}
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h1 className="text-xl font-bold">{customer.name}</h1>
                        <p className="text-sm text-muted-foreground">
                            {customer.code}
                            {customer.phone ? ` · ${customer.phone}` : ''}
                            {customer.email ? ` · ${customer.email}` : ''}
                        </p>
                    </div>
                    <a href={route('customers.index')}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border bg-background hover:bg-muted transition-colors font-medium">
                        ← Kembali
                    </a>
                </div>

                {/* Overdue blocked banner */}
                {isBlocked && (
                    <div className="flex items-center gap-3 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        Pelanggan ini memiliki cicilan jatuh tempo. Tidak dapat menggunakan kredit baru sampai hutang dilunasi.
                    </div>
                )}

                {/* Summary */}
                {plans.length > 0 && (
                    <div className="rounded-xl border p-4 grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                        <div>
                            <div className="text-muted-foreground text-xs mb-0.5">Total Plan Cicilan</div>
                            <div className="font-semibold">{plans.length} plan</div>
                        </div>
                        <div>
                            <div className="text-muted-foreground text-xs mb-0.5">Sisa Hutang</div>
                            <div className={`font-semibold ${totalOutstanding > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                {fmt(totalOutstanding)}
                            </div>
                        </div>
                        <div>
                            <div className="text-muted-foreground text-xs mb-0.5">Status Kredit</div>
                            <div className={`font-semibold ${isBlocked ? 'text-red-600' : 'text-green-600'}`}>
                                {isBlocked ? 'Tertunggak' : 'Baik'}
                            </div>
                        </div>
                    </div>
                )}

                {/* Plans list */}
                <div className="space-y-3">
                    <h2 className="font-semibold">Riwayat Cicilan</h2>

                    {plans.length === 0 ? (
                        <div className="rounded-xl border p-8 text-center text-sm text-muted-foreground">
                            Belum ada cicilan untuk pelanggan ini.
                        </div>
                    ) : plans.map(plan => (
                        <div key={plan.id} className="rounded-xl border overflow-hidden">
                            {/* Plan header row */}
                            <button
                                type="button"
                                onClick={() => setExpandedPlan(expandedPlan === plan.id ? null : plan.id)}
                                className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors text-sm"
                            >
                                <div className="flex items-center gap-3">
                                    {expandedPlan === plan.id
                                        ? <ChevronDown className="w-4 h-4" />
                                        : <ChevronRight className="w-4 h-4" />
                                    }
                                    <div className="text-left">
                                        <div className="font-medium">{plan.saleNumber ?? '—'}</div>
                                        <div className="text-xs text-muted-foreground">
                                            {plan.occurredAt
                                                ? new Date(plan.occurredAt).toLocaleDateString('id-ID')
                                                : '—'}
                                            {' · '}{plan.installmentCount}x cicilan
                                            {plan.interestRate > 0 && ` · Bunga ${plan.interestRate}%`}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="text-right">
                                        <div className="font-semibold">{fmt(plan.totalAmount)}</div>
                                        {plan.remainingAmount > 0 && (
                                            <div className="text-xs text-muted-foreground">
                                                Sisa: {fmt(plan.remainingAmount)}
                                            </div>
                                        )}
                                    </div>
                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusStyle[plan.status]?.cls ?? ''}`}>
                                        {statusStyle[plan.status]?.label ?? plan.status}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            window.open(
                                                route('installments.invoice', { plan: plan.id }),
                                                'invoice',
                                                'width=900,height=700,toolbar=no,location=no,menubar=no,scrollbars=yes,resizable=yes'
                                            );
                                        }}
                                        className="px-2 py-1 text-xs rounded border border-border hover:bg-muted transition-colors shrink-0"
                                    >
                                        Invoice
                                    </button>
                                </div>
                            </button>

                            {/* Payment schedule rows */}
                            {expandedPlan === plan.id && (
                                <div className="divide-y">
                                    {plan.payments.map((p, idx) => (
                                        <div key={p.id} className="px-4 py-3 text-sm">
                                            <div className="flex items-start justify-between gap-2">
                                                <div>
                                                    <div className="text-xs text-muted-foreground mb-0.5">
                                                        Cicilan #{idx + 1} · Jatuh tempo{' '}
                                                        {new Date(p.dueDate).toLocaleDateString('id-ID')}
                                                    </div>
                                                    <div className="font-semibold">{fmt(p.totalDue)}</div>
                                                    {(p.interestAmount > 0 || p.lateFeeApplied > 0) && (
                                                        <div className="text-xs text-muted-foreground">
                                                            Pokok: {fmt(p.amountDue)}
                                                            {p.interestAmount > 0 && ` · Bunga: ${fmt(p.interestAmount)}`}
                                                            {p.lateFeeApplied > 0 && ` · Denda: ${fmt(p.lateFeeApplied)}`}
                                                        </div>
                                                    )}
                                                    {p.paidAt && (
                                                        <div className="text-xs text-green-600 mt-0.5">
                                                            Dibayar {new Date(p.paidAt).toLocaleDateString('id-ID')}
                                                            {p.paymentMethod ? ` via ${p.paymentMethod}` : ''}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusStyle[p.status]?.cls ?? ''}`}>
                                                        {statusStyle[p.status]?.label ?? p.status}
                                                    </span>
                                                    {canWrite && p.status !== 'paid' && payingPaymentId !== p.id && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setPayingPaymentId(p.id)}
                                                            className="text-xs px-2 py-1 rounded border bg-background hover:bg-muted transition-colors"
                                                        >
                                                            Bayar
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                            {payingPaymentId === p.id && (
                                                <PaymentForm
                                                    payment={p}
                                                    planId={plan.id}
                                                    onDone={() => setPayingPaymentId(null)}
                                                />
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </AppLayout>
    );
}
