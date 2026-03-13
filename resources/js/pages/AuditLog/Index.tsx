import { useState } from 'react';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Pengguna', href: '#' },
    { title: 'Log Aktivitas', href: '/audit-log' },
];

const ACTION_LABELS: Record<string, string> = {
    'user.created':            'Pengguna Dibuat',
    'user.deleted':            'Pengguna Dihapus',
    'user.role_changed':       'Role Diubah',
    'user.password_reset':     'Password Direset',
    'item.sell_price_changed': 'Harga Jual Diubah',
    'item.buy_price_changed':  'Harga Beli Diubah',
    'stock.adjusted':          'Stok Disesuaikan',
    'po.status_changed':       'Status PO Diubah',
    'po.received':             'PO Diterima',
    'outlet.created':          'Outlet Dibuat',
    'outlet.updated':          'Outlet Diperbarui',
    'outlet.deleted':          'Outlet Dihapus',
    'promotion.created':       'Promo Dibuat',
    'promotion.updated':       'Promo Diperbarui',
    'promotion.deleted':       'Promo Dihapus',
    'role.permissions_changed':'Hak Akses Role Diubah',
};

const ACTION_GROUPS = [
    { value: '',          label: 'Semua Aksi' },
    { value: 'pengguna',  label: 'Pengguna' },
    { value: 'produk',    label: 'Produk' },
    { value: 'stok',      label: 'Stok' },
    { value: 'pembelian', label: 'Pembelian' },
    { value: 'outlet',    label: 'Outlet' },
    { value: 'promosi',   label: 'Promosi' },
    { value: 'role',      label: 'Role' },
];

interface LogEntry {
    id: number;
    occurredAt: string;
    userId: number | null;
    userName: string;
    action: string;
    subjectType: string;
    subjectId: number | null;
    subjectLabel: string;
    oldValue: Record<string, unknown> | null;
    newValue: Record<string, unknown> | null;
    ipAddress: string | null;
}

interface PaginatedLogs {
    data: LogEntry[];
    current_page: number;
    last_page: number;
    total: number;
    from: number | null;
    to: number | null;
}

interface PageProps {
    logs: PaginatedLogs;
    filters: { date_from?: string; date_to?: string; action_group?: string; user_name?: string };
    [key: string]: unknown;
}

function formatDateTime(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
        + ' ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

function formatChangeValue(val: unknown): string {
    if (val === null || val === undefined) return '-';
    if (typeof val === 'number') return val.toLocaleString('id-ID');
    return String(val);
}

function ChangeCell({ old: oldVal, new: newVal, action }: { old: Record<string, unknown> | null; new: Record<string, unknown> | null; action: string }) {
    if (!oldVal && !newVal) return <span className="text-muted-foreground">—</span>;

    // Price changes
    if (action === 'item.sell_price_changed' && oldVal && newVal) {
        return (
            <span className="tabular-nums text-xs">
                <span className="text-rose-600">Rp {formatChangeValue(oldVal.harga_jual)}</span>
                {' → '}
                <span className="text-emerald-600">Rp {formatChangeValue(newVal.harga_jual)}</span>
            </span>
        );
    }
    if (action === 'item.buy_price_changed' && oldVal && newVal) {
        return (
            <span className="tabular-nums text-xs">
                <span className="text-rose-600">Rp {formatChangeValue(oldVal.harga_beli)}</span>
                {' → '}
                <span className="text-emerald-600">Rp {formatChangeValue(newVal.harga_beli)}</span>
            </span>
        );
    }
    // Role change
    if (action === 'user.role_changed' && oldVal && newVal) {
        return (
            <span className="text-xs">
                <span className="text-rose-600">{formatChangeValue(oldVal.role)}</span>
                {' → '}
                <span className="text-emerald-600">{formatChangeValue(newVal.role)}</span>
            </span>
        );
    }
    // Stock adjustment
    if (action === 'stock.adjusted' && oldVal && newVal) {
        return (
            <span className="tabular-nums text-xs">
                <span className="text-rose-600">{formatChangeValue(oldVal.old_qty)}</span>
                {' → '}
                <span className="text-emerald-600">{formatChangeValue(newVal.new_qty)}</span>
                {newVal.outlet_name ? <span className="text-muted-foreground ml-1">({String(newVal.outlet_name)})</span> : null}
            </span>
        );
    }
    // PO status change
    if (action === 'po.status_changed' && oldVal && newVal) {
        return (
            <span className="text-xs">
                <span className="text-rose-600">{formatChangeValue(oldVal.status)}</span>
                {' → '}
                <span className="text-emerald-600">{formatChangeValue(newVal.status)}</span>
            </span>
        );
    }

    // Generic: show new_value keys as JSON-like
    const display = newVal ?? oldVal;
    if (display) {
        return (
            <span className="text-xs text-muted-foreground">
                {Object.entries(display).map(([k, v]) => `${k}: ${formatChangeValue(v)}`).join(', ')}
            </span>
        );
    }
    return <span className="text-muted-foreground">—</span>;
}

export default function AuditLogIndex() {
    const { logs, filters } = usePage<PageProps>().props;

    const [dateFrom,    setDateFrom]    = useState(filters.date_from    ?? new Date().toISOString().slice(0, 7) + '-01');
    const [dateTo,      setDateTo]      = useState(filters.date_to      ?? new Date().toISOString().slice(0, 10));
    const [actionGroup, setActionGroup] = useState(filters.action_group ?? '');
    const [userName,    setUserName]    = useState(filters.user_name    ?? '');

    function applyFilters() {
        router.get('/audit-log', {
            date_from:    dateFrom,
            date_to:      dateTo,
            action_group: actionGroup,
            user_name:    userName,
        }, { preserveState: true });
    }

    function goToPage(page: number) {
        router.get('/audit-log', {
            date_from:    filters.date_from,
            date_to:      filters.date_to,
            action_group: filters.action_group,
            user_name:    filters.user_name,
            page,
        }, { preserveState: true });
    }

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Log Aktivitas" />
            <div className="p-6 space-y-6">
                <div>
                    <h1 className="text-2xl font-bold">Log Aktivitas</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        Riwayat perubahan penting oleh pengguna
                    </p>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap gap-3 items-end">
                    <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">Dari</label>
                        <input type="date" className="border rounded-lg px-3 py-2 text-sm bg-background h-9"
                            value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">Sampai</label>
                        <input type="date" className="border rounded-lg px-3 py-2 text-sm bg-background h-9"
                            value={dateTo} onChange={e => setDateTo(e.target.value)} />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">Kategori</label>
                        <select className="border rounded-lg px-3 py-2 text-sm bg-background h-9"
                            value={actionGroup} onChange={e => setActionGroup(e.target.value)}>
                            {ACTION_GROUPS.map(g => (
                                <option key={g.value} value={g.value}>{g.label}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">Pengguna</label>
                        <input type="text" placeholder="Cari nama..." className="border rounded-lg px-3 py-2 text-sm bg-background h-9 w-40"
                            value={userName} onChange={e => setUserName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && applyFilters()} />
                    </div>
                    <button onClick={applyFilters}
                        className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
                        Tampilkan
                    </button>
                </div>

                {/* Table */}
                <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
                    {logs.data.length === 0 ? (
                        <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
                            Tidak ada log untuk filter ini.
                        </div>
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b bg-muted/40">
                                            <th className="text-left px-4 py-3 font-medium">Waktu</th>
                                            <th className="text-left px-4 py-3 font-medium">Pengguna</th>
                                            <th className="text-left px-4 py-3 font-medium">Aksi</th>
                                            <th className="text-left px-4 py-3 font-medium">Subjek</th>
                                            <th className="text-left px-4 py-3 font-medium">Perubahan</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {logs.data.map((log) => (
                                            <tr key={log.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                                                <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap tabular-nums">
                                                    {formatDateTime(log.occurredAt)}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className="font-medium">{log.userName}</span>
                                                    {log.ipAddress && (
                                                        <span className="block text-xs text-muted-foreground">{log.ipAddress}</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                                                        {ACTION_LABELS[log.action] ?? log.action}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className="font-medium">{log.subjectLabel}</span>
                                                    <span className="block text-xs text-muted-foreground">{log.subjectType}</span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <ChangeCell
                                                        old={log.oldValue}
                                                        new={log.newValue}
                                                        action={log.action}
                                                    />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination */}
                            {logs.last_page > 1 && (
                                <div className="flex items-center justify-between px-4 py-3 border-t text-sm text-muted-foreground">
                                    <span>
                                        {logs.from}–{logs.to} dari {logs.total} entri
                                    </span>
                                    <div className="flex gap-1">
                                        {Array.from({ length: logs.last_page }, (_, i) => i + 1).map(page => (
                                            <button
                                                key={page}
                                                onClick={() => goToPage(page)}
                                                className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${
                                                    page === logs.current_page
                                                        ? 'bg-primary text-primary-foreground'
                                                        : 'hover:bg-muted'
                                                }`}
                                            >
                                                {page}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </AppLayout>
    );
}
