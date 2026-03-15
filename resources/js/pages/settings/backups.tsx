import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Download, RefreshCw, Database } from 'lucide-react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Backup Database', href: '#' },
];

interface Backup {
    filename: string;
    size: number;
    createdAt: string;
}

interface PageProps {
    backups: Backup[];
    [key: string]: unknown;
}

function formatSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export default function BackupsPage() {
    const { backups } = usePage<PageProps>().props;

    const handleRunBackup = () => {
        if (!confirm('Buat backup sekarang?')) return;
        router.post(route('backups.run'));
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Backup Database" />
            <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-4">
                <div className="flex items-center justify-between">
                    <h1 className="text-xl font-semibold">Backup Database</h1>
                    <Button onClick={handleRunBackup} size="sm">
                        <RefreshCw size={15} className="mr-1.5" />
                        Backup Sekarang
                    </Button>
                </div>

                <p className="text-sm text-muted-foreground">
                    Backup otomatis berjalan setiap hari pukul 02:00. 7 backup terakhir disimpan.
                </p>

                {backups.length === 0 ? (
                    <div className="border rounded-lg p-8 text-center text-muted-foreground">
                        <Database size={40} className="mx-auto mb-3 opacity-30" />
                        <p>
                            Belum ada backup. Klik &quot;Backup Sekarang&quot; untuk membuat backup pertama.
                        </p>
                    </div>
                ) : (
                    <div className="border rounded-lg divide-y">
                        {backups.map((b) => (
                            <div key={b.filename} className="flex items-center justify-between px-4 py-3">
                                <div>
                                    <div className="text-sm font-mono font-medium">{b.filename}</div>
                                    <div className="text-xs text-muted-foreground">
                                        {b.createdAt} · {formatSize(b.size)}
                                    </div>
                                </div>
                                <Button variant="outline" size="sm" asChild>
                                    <a href={route('backups.download', { filename: b.filename })}>
                                        <Download size={14} className="mr-1.5" />
                                        Unduh
                                    </a>
                                </Button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
