import ContactsPage from '@/components/ContactsPage';
import { Truck, Building2 } from 'lucide-react';

export default function SupplierIndex() {
    return (
        <ContactsPage config={{
            entitySingular: 'Supplier',
            entityKey: 'supplier',
            dataKey: 'suppliers',
            routePrefix: 'suppliers',
            breadcrumbs: [
                { title: 'Dashboard', href: '/dashboard' },
                { title: 'Supplier', href: '/suppliers' },
            ],
            headTitle: 'Supplier',
            pageHeading: 'Manajemen Supplier',
            pageSubheading: 'Kelola daftar supplier/pemasok barang',
            searchPlaceholder: 'Cari nama, kode, kota…',
            EmptyIcon: Truck,
            emptyMessage: 'Belum ada supplier',
            emptySubMessage: 'Tambahkan supplier untuk mulai membuat Purchase Order.',
            ViewIcon: Building2,
            hasContactPerson: true,
            csvFilename: 'suppliers',
            activeLabel: 'Supplier aktif',
            nameLabel: 'Nama Supplier',
            namePlaceholder: 'Nama perusahaan / supplier',
            codePlaceholder: 'Biarkan kosong untuk generate otomatis',
            summaryLabel: 'supplier',
        }} />
    );
}
