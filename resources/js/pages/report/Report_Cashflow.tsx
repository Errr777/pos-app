import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import { Coins } from 'lucide-react';

const breadcrumbs: BreadcrumbItem[] = [
  { title: 'Dashboard', href: '/dashboard' },
  { title: 'Laporan Kas', href: '/report/cashflow' },
];

export default function ReportCashflow() {
  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title="Laporan Kas" />
      <div className="relative min-h-[100vh] flex-1 overflow-hidden rounded-xl border border-sidebar-border/70 md:min-h-min dark:border-sidebar-border bg-white dark:bg-background p-4">
        <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
          <Coins size={48} className="text-muted-foreground/40" />
          <div>
            <h2 className="text-lg font-semibold text-muted-foreground">Laporan Kas</h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              Fitur ini membutuhkan modul Finance / Kasir. Aktifkan modul keuangan terlebih dahulu untuk melihat laporan arus kas.
            </p>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
