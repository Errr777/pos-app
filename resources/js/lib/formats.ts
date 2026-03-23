/**
 * Shared formatting utilities — import these instead of defining locally.
 */

export function formatRp(n: number): string {
    return 'Rp ' + n.toLocaleString('id-ID');
}

export function fmtDate(iso: string | null | undefined): string {
    if (!iso) return '-';
    return new Date(iso).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
}

export const METHOD_LABEL: Record<string, string> = {
    cash: 'Tunai',
    transfer: 'Transfer Bank',
    qris: 'QRIS',
    card: 'Kartu',
    credit: 'Kredit',
};

export const STATUS_LABEL: Record<string, string> = {
    pending: 'Belum Lunas',
    active: 'Aktif',
    overdue: 'Jatuh Tempo',
    completed: 'Lunas',
    paid: 'Lunas',
    partial: 'Sebagian',
};
