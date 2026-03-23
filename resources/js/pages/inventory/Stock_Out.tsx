import StockMovementPage from '@/components/StockMovementPage';

export default function Stock_Out() {
    return (
        <StockMovementPage config={{
            direction: 'out',
            breadcrumbs: [
                { title: 'Dashboard', href: '/dashboard' },
                { title: 'Stock Out', href: '/inventory/stock_out' },
            ],
            title: 'Stock Out',
            routeName: 'Stock_Out',
            partyLabel: 'Receiver',
            partyPlaceholder: 'Penerima / divisi / outlet',
            qtyLabel: 'Qty Out',
            deleteConfirm: 'Hapus data stock-out ini? Stok item akan dikembalikan.',
            csvFilename: 'stock-out',
            csvPartyHeader: 'Receiver',
            addLabel: 'Tambah Stock-Out',
            fetchItemsRoute: 'stock_out.items',
        }} />
    );
}
