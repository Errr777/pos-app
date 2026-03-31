import StockMovementPage from '@/components/StockMovementPage';

export default function Stock_In() {
    return (
        <StockMovementPage config={{
            direction: 'in',
            breadcrumbs: [
                { title: 'Dashboard', href: '/dashboard' },
                { title: 'Stok Masuk', href: '/inventory/stock_in' },
            ],
            title: 'Stok Masuk',
            routeName: 'Stock_In',
            partyLabel: 'Supplier',
            partyPlaceholder: 'Nama supplier',
            qtyLabel: 'Qty Masuk',
            deleteConfirm: 'Hapus data stok masuk ini? Stok item akan dikurangi kembali.',
            csvFilename: 'stok-masuk',
            csvPartyHeader: 'Supplier',
            addLabel: 'Tambah Stok Masuk',
        }} />
    );
}
