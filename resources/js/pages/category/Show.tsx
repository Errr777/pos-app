import React from 'react';
import AppLayout from '@/layouts/app-layout';
import { Head, usePage } from '@inertiajs/react';
import { Button } from '@/components/ui/button';

const breadcrumbs = [
  { title: 'Dashboard', href: '/dashboard' },
  { title: 'Kategori', href: '/kategoris' },
];

export default function Show() {
  const { props } = usePage();
  const { kategori = {} } = props;

  return (
    <AppLayout breadcrumbs={[...breadcrumbs, { title: kategori.nama ?? 'Detail' }]}>
      <Head title={`Kategori: ${kategori.nama ?? ''}`} />
      <div className="p-4 bg-white rounded shadow">
        <h1 className="text-xl font-semibold mb-2">{kategori.nama}</h1>
        <div className="mb-4">{kategori.deskripsi ?? '-'}</div>
        <div className="space-x-2">
          <Button as="a" href={route('kategoris.index')}>Kembali</Button>
          {/* Add an edit button if you have a dedicated edit page */}
          <Button as="a" href={route('kategoris.index')}>Edit</Button>
        </div>
      </div>
    </AppLayout>
  );
}