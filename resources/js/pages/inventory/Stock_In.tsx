import StockMovementPage from '@/components/StockMovementPage';

export default function Stock_In() {
    return (
        <StockMovementPage config={{
            direction: 'in',
            breadcrumbs: [
                { title: 'Dashboard', href: '/dashboard' },
                { title: 'Stock In', href: '/inventory/stock_in' },
            ],
            title: 'Stock In',
            routeName: 'Stock_In',
            partyLabel: 'Supplier',
            partyPlaceholder: 'Nama supplier',
            qtyLabel: 'Qty In',
            deleteConfirm: 'Hapus data stock-in ini? Stok item akan dikurangi kembali.',
            csvFilename: 'stock-in',
            csvPartyHeader: 'Supplier',
            addLabel: 'Tambah Stock-In',
        }} />
    );
}
