import AppLayout from '@/layouts/app-layout';
import { Head, router, usePage } from '@inertiajs/react';
import { Button } from '@/components/ui/button';

interface KategoriDetail {
  id: string;
  nama: string;
  deskripsi?: string | null;
  [key: string]: unknown;
}

interface PageProps { kategori: KategoriDetail; [key: string]: unknown; }

const breadcrumbs = [
  { title: 'Dashboard', href: '/dashboard' },
  { title: 'Kategori', href: '/category' },
];

export default function Show() {
  const { props } = usePage<PageProps>();
  const { kategori } = props;

  return (
    <AppLayout breadcrumbs={[...breadcrumbs, { title: kategori.nama ?? 'Detail', href: '#' }]}>
      <Head title={`Kategori: ${kategori.nama ?? ''}`} />
      <div className="p-4 bg-white rounded shadow">
        <h1 className="text-xl font-semibold mb-2">{kategori.nama}</h1>
        <div className="mb-4">{kategori.deskripsi ?? '-'}</div>
        <div className="space-x-2">
          <Button variant="outline" onClick={() => router.visit(route('kategori.index'))}>Kembali</Button>
        </div>
      </div>
    </AppLayout>
  );
}