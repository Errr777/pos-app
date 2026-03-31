import StockMovementPage from '@/components/StockMovementPage';

export default function Stock_Out() {
    return (
        <StockMovementPage config={{
            direction: 'out',
            breadcrumbs: [
                { title: 'Dashboard', href: '/dashboard' },
                { title: 'Stok Keluar', href: '/inventory/stock_out' },
            ],
            title: 'Stok Keluar',
            routeName: 'Stock_Out',
            partyLabel: 'Penerima',
            partyPlaceholder: 'Penerima / divisi / outlet',
            qtyLabel: 'Qty Keluar',
            deleteConfirm: 'Hapus data stok keluar ini? Stok item akan dikembalikan.',
            csvFilename: 'stok-keluar',
            csvPartyHeader: 'Penerima',
            addLabel: 'Tambah Stok Keluar',
            fetchItemsRoute: 'stock_out.items',
        }} />
    );
}
