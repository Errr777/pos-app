import StockViewPage from '@/components/StockViewPage';

export default function Stock_History() {
    return (
        <StockViewPage config={{
            mode: 'history',
            breadcrumbs: [
                { title: 'Dashboard', href: '/dashboard' },
                { title: 'Riwayat Transaksi Stok', href: '/inventory' },
            ],
            title: 'Riwayat Transaksi Stok',
            routeName: 'Stock_History',
            csvFilename: 'stock-history',
        }} />
    );
}
