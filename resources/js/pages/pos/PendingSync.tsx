import { useEffect, useState, useCallback } from 'react';
import AppLayout from '@/layouts/app-layout';
import { db, type PendingTransaction } from '@/lib/db';
import { useNetwork } from '@/hooks/use-network';
import { useSyncQueue } from '@/hooks/use-sync-queue';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Trash2, WifiOff } from 'lucide-react';
import type { BreadcrumbItem } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'POS', href: '/pos' },
    { title: 'Transaksi Pending', href: '/pos/pending' },
];

const STATUS_LABEL: Record<string, string> = {
    pending:  'Menunggu',
    syncing:  'Menyinkron',
    failed:   'Gagal',
};

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    pending:  'outline',
    syncing:  'secondary',
    failed:   'destructive',
};

function formatRp(n: number) {
    return 'Rp ' + n.toLocaleString('id-ID');
}

export default function PendingSync() {
    const [rows, setRows] = useState<PendingTransaction[]>([]);
    const isOnline = useNetwork();
    const { isSyncing, syncNow, refreshCount } = useSyncQueue(isOnline);

    const reload = useCallback(() => {
        db.pendingTransactions
            .orderBy('createdAt')
            .reverse()
            .toArray()
            .then(setRows);
    }, []);

    useEffect(() => {
        reload();
    }, [reload]);

    const handleSyncNow = async () => {
        await syncNow();
        reload();
        refreshCount();
    };

    const handleDelete = async (id: number) => {
        await db.pendingTransactions.delete(id);
        reload();
        refreshCount();
    };

    const handleDeleteAll = async () => {
        await db.pendingTransactions.clear();
        reload();
        refreshCount();
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <div className="mx-auto max-w-2xl p-6 space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-semibold">Transaksi Pending</h1>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            {rows.length === 0
                                ? 'Tidak ada transaksi pending.'
                                : `${rows.length} transaksi menunggu sinkronisasi.`}
                        </p>
                    </div>
                    <div className="flex gap-2">
                        {rows.length > 0 && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleDeleteAll}
                                className="text-destructive hover:text-destructive"
                            >
                                <Trash2 className="h-4 w-4 mr-1.5" />
                                Hapus Semua
                            </Button>
                        )}
                        <Button
                            onClick={handleSyncNow}
                            disabled={!isOnline || isSyncing || rows.length === 0}
                            size="sm"
                        >
                            <RefreshCw className={`h-4 w-4 mr-1.5 ${isSyncing ? 'animate-spin' : ''}`} />
                            {isSyncing ? 'Menyinkron…' : 'Sync Sekarang'}
                        </Button>
                    </div>
                </div>

                {/* Offline warning */}
                {!isOnline && (
                    <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        <WifiOff className="h-4 w-4 shrink-0" />
                        Tidak ada koneksi internet. Transaksi akan disinkron otomatis saat online.
                    </div>
                )}

                {/* Empty state */}
                {rows.length === 0 && (
                    <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground text-sm">
                        Semua transaksi sudah tersinkron.
                    </div>
                )}

                {/* Transaction list */}
                <div className="space-y-3">
                    {rows.map((tx) => {
                        const totalItems = tx.payload.items.reduce((s, i) => s + i.quantity, 0);
                        return (
                            <div key={tx.id} className="rounded-lg border bg-card p-4 space-y-3">
                                {/* Top row */}
                                <div className="flex items-start justify-between gap-3">
                                    <div className="space-y-0.5">
                                        <p className="font-mono text-xs text-muted-foreground">
                                            {tx.idempotencyKey}
                                        </p>
                                        <p className="text-sm text-muted-foreground">
                                            {new Date(tx.createdAt).toLocaleString('id-ID', {
                                                dateStyle: 'medium',
                                                timeStyle: 'short',
                                            })}
                                            {tx.attempts > 0 && (
                                                <span className="ml-2 text-amber-600">
                                                    · {tx.attempts}× dicoba
                                                </span>
                                            )}
                                        </p>
                                    </div>
                                    <Badge variant={STATUS_VARIANT[tx.status] ?? 'outline'}>
                                        {STATUS_LABEL[tx.status] ?? tx.status}
                                    </Badge>
                                </div>

                                {/* Summary */}
                                <div className="flex items-center gap-4 text-sm">
                                    <span>
                                        <span className="font-medium">{totalItems}</span>
                                        <span className="text-muted-foreground"> item</span>
                                    </span>
                                    <span className="text-muted-foreground">·</span>
                                    <span>
                                        <span className="font-medium">{formatRp(tx.payload.payment_amount)}</span>
                                    </span>
                                    <span className="text-muted-foreground">·</span>
                                    <span className="capitalize text-muted-foreground">
                                        {tx.payload.payment_method}
                                    </span>
                                </div>

                                {/* Error reason */}
                                {tx.failReason && (
                                    <p className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
                                        Error: {tx.failReason}
                                    </p>
                                )}

                                {/* Actions */}
                                <div className="flex justify-end">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleDelete(tx.id!)}
                                        className="text-destructive hover:text-destructive h-7 text-xs"
                                    >
                                        <Trash2 className="h-3 w-3 mr-1" />
                                        Hapus
                                    </Button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </AppLayout>
    );
}
