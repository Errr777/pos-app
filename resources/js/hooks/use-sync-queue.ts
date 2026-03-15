import { useCallback, useEffect, useRef, useState } from 'react';
import { db, type PendingTransaction } from '@/lib/db';

export function useSyncQueue(isOnline: boolean) {
    const [pendingCount, setPendingCount] = useState(0);
    const [isSyncing, setIsSyncing]       = useState(false);
    const syncLockRef = useRef(false);

    const refreshCount = useCallback(() => {
        db.pendingTransactions
            .where('status').anyOf(['pending', 'failed'])
            .count()
            .then(setPendingCount);
    }, []);

    // Keep count current whenever online state changes
    useEffect(() => {
        refreshCount();
    }, [isOnline, refreshCount]);

    const syncNow = useCallback(async () => {
        if (syncLockRef.current || !isOnline) return;
        syncLockRef.current = true;
        setIsSyncing(true);

        try {
            const pending = await db.pendingTransactions
                .where('status').anyOf(['pending', 'failed'])
                .toArray();

            for (const tx of pending) {
                await db.pendingTransactions.update(tx.id!, { status: 'syncing' });

                try {
                    const csrfMeta = document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement | null;
                    const res = await fetch('/pos', {
                        method:  'POST',
                        headers: {
                            'Content-Type':     'application/json',
                            'Accept':           'application/json',
                            'X-Requested-With': 'XMLHttpRequest',
                            'X-CSRF-TOKEN':     csrfMeta?.content ?? '',
                        },
                        body: JSON.stringify({
                            ...tx.payload,
                            idempotency_key: tx.idempotencyKey,
                        }),
                    });

                    if (res.ok) {
                        await db.pendingTransactions.delete(tx.id!);
                    } else {
                        const err = await res.json().catch(() => ({})) as { message?: string };
                        await db.pendingTransactions.update(tx.id!, {
                            status:     'failed',
                            failReason: err?.message ?? `HTTP ${res.status}`,
                            attempts:   (tx.attempts ?? 0) + 1,
                        });
                    }
                } catch (networkErr) {
                    await db.pendingTransactions.update(tx.id!, {
                        status:     'failed',
                        failReason: String(networkErr),
                        attempts:   (tx.attempts ?? 0) + 1,
                    });
                    break; // Network is down again — stop trying
                }
            }
        } finally {
            syncLockRef.current = false;
            setIsSyncing(false);
            refreshCount();
        }
    }, [isOnline, refreshCount]);

    // Auto-sync the moment we come back online
    useEffect(() => {
        if (isOnline) syncNow();
    }, [isOnline]); // eslint-disable-line react-hooks/exhaustive-deps

    const addToQueue = useCallback(
        async (payload: PendingTransaction['payload'], idempotencyKey: string) => {
            await db.pendingTransactions.add({
                idempotencyKey,
                payload,
                status:    'pending',
                attempts:  0,
                createdAt: Date.now(),
            });
            setPendingCount((c) => c + 1);
        },
        [],
    );

    return { pendingCount, isSyncing, syncNow, addToQueue, refreshCount };
}
