import ContactsPage from '@/components/ContactsPage';
import { Users, User } from 'lucide-react';

export default function CustomersIndex() {
    return (
        <ContactsPage config={{
            entitySingular: 'Pelanggan',
            entityKey: 'customer',
            dataKey: 'customers',
            routePrefix: 'customers',
            breadcrumbs: [
                { title: 'Dashboard', href: '/dashboard' },
                { title: 'Pelanggan', href: '/customers' },
            ],
            headTitle: 'Pelanggan',
            pageHeading: 'Manajemen Pelanggan',
            pageSubheading: 'Kelola daftar pelanggan / pembeli',
            searchPlaceholder: 'Cari nama, kode, telepon…',
            EmptyIcon: Users,
            emptyMessage: 'Belum ada pelanggan',
            emptySubMessage: 'Tambahkan pelanggan untuk melacak riwayat pembelian mereka.',
            ViewIcon: User,
            hasContactPerson: false,
            showDetailRoute: 'customers.show',
            csvFilename: 'customers',
            activeLabel: 'Pelanggan aktif',
            nameLabel: 'Nama',
            namePlaceholder: 'Nama pelanggan',
            codePlaceholder: 'Kosongkan untuk auto-generate',
            summaryLabel: 'pelanggan',
        }} />
    );
}
