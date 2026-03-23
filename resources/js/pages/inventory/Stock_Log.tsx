import StockViewPage from '@/components/StockViewPage';

export default function Stock_Log() {
    return (
        <StockViewPage config={{
            mode: 'log',
            breadcrumbs: [
                { title: 'Dashboard', href: '/dashboard' },
                { title: 'Log Stok', href: '/inventory/stock_log' },
            ],
            title: 'Log Stok',
            routeName: 'Stock_Log',
            csvFilename: 'stock-log',
        }} />
    );
}
