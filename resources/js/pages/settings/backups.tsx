import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Download, RefreshCw, Database, Upload, RotateCcw, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';

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
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);
    const [backingUp, setBackingUp] = useState(false);

    const handleRunBackup = async () => {
        if (!confirm('Buat backup sekarang?')) return;
        setBackingUp(true);
        try {
            const csrf = document.cookie.match(/XSRF-TOKEN=([^;]+)/)?.[1] ?? '';
            const resp = await fetch(route('backups.run'), {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    'X-XSRF-TOKEN': decodeURIComponent(csrf),
                    Accept: 'application/json',
                },
            });
            if (!resp.ok) throw new Error(`Server error ${resp.status}`);
            const data = await resp.json();
            // Reload list first, then trigger download after list is updated
            router.reload({
                onSuccess: () => {
                    if (data.filename) {
                        window.location.href = route('backups.download', { filename: data.filename });
                    }
                },
            });
        } catch (err) {
            alert('Backup gagal. Coba lagi.');
            console.error(err);
        } finally {
            setBackingUp(false);
        }
    };

    const handleRestore = (filename: string) => {
        if (!confirm(`Pulihkan database dari "${filename}"?\n\nSemua data saat ini akan digantikan. Pastikan Anda sudah membuat backup terbaru.`)) return;
        router.post(route('backups.restore', { filename }));
    };

    const handleDelete = (filename: string) => {
        if (!confirm(`Hapus backup "${filename}"?\n\nFile ini tidak dapat dipulihkan setelah dihapus.`)) return;
        router.delete(route('backups.destroy', { filename }));
    };

    const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!confirm(`Import dan pulihkan database dari file "${file.name}"?\n\nSemua data saat ini akan digantikan.`)) {
            e.target.value = '';
            return;
        }
        setUploading(true);
        router.post(
            route('backups.upload'),
            { backup_file: file },
            {
                forceFormData: true,
                onFinish: () => {
                    setUploading(false);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                },
            },
        );
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Backup Database" />
            <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-4">
                <div className="flex items-center justify-between">
                    <h1 className="text-xl font-semibold">Backup Database</h1>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={uploading}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <Upload size={15} className="mr-1.5" />
                            {uploading ? 'Mengimpor...' : 'Import Backup'}
                        </Button>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".enc"
                            className="hidden"
                            onChange={handleUpload}
                        />
                        <Button onClick={handleRunBackup} size="sm" disabled={backingUp}>
                            <RefreshCw size={15} className={`mr-1.5 ${backingUp ? 'animate-spin' : ''}`} />
                            {backingUp ? 'Memproses...' : 'Backup Sekarang'}
                        </Button>
                    </div>
                </div>

                <p className="text-sm text-muted-foreground">
                    Backup otomatis berjalan setiap hari pukul 02:00. Maksimal <strong>7 backup</strong> disimpan — backup terlama dihapus otomatis (FIFO).
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
                                <div className="flex items-center gap-2">
                                    <a
                                        href={route('backups.download', { filename: b.filename })}
                                        className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground transition-colors"
                                    >
                                        <Download size={14} />
                                        Unduh
                                    </a>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleRestore(b.filename)}
                                        className="text-orange-600 border-orange-300 hover:bg-orange-50 hover:text-orange-700"
                                    >
                                        <RotateCcw size={14} className="mr-1.5" />
                                        Pulihkan
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleDelete(b.filename)}
                                        className="text-red-600 border-red-300 hover:bg-red-50 hover:text-red-700"
                                    >
                                        <Trash2 size={14} />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
