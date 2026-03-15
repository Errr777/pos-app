import { RefreshCw, WifiOff } from 'lucide-react';
import { router } from '@inertiajs/react';

interface Props {
    isOnline:     boolean;
    pendingCount: number;
    isSyncing:    boolean;
    onSyncNow:    () => void;
}

export function OfflineIndicator({ isOnline, pendingCount, isSyncing, onSyncNow }: Props) {
    if (isOnline && pendingCount === 0) return null;

    return (
        <div
            className={`fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium shadow-lg ${
                isOnline ? 'bg-amber-500 text-white' : 'bg-red-600 text-white'
            }`}
        >
            <WifiOff className="h-4 w-4 shrink-0" />

            {isOnline ? (
                <>
                    <span>{pendingCount} transaksi pending</span>
                    <button
                        onClick={onSyncNow}
                        disabled={isSyncing}
                        className="flex items-center gap-1 underline underline-offset-2 disabled:opacity-50"
                    >
                        <RefreshCw className={`h-3 w-3 ${isSyncing ? 'animate-spin' : ''}`} />
                        {isSyncing ? 'Menyinkron…' : 'Sync'}
                    </button>
                    <span className="text-white/70">·</span>
                    <button
                        onClick={() => router.visit(route('pos.pending'))}
                        className="underline underline-offset-2"
                    >
                        Lihat
                    </button>
                </>
            ) : (
                <span>
                    Offline{pendingCount > 0 ? ` — ${pendingCount} pending` : ''}
                </span>
            )}
        </div>
    );
}
