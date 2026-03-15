import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, useForm, usePage } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FormEventHandler, useRef } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Pengaturan Toko', href: '#' },
];

interface PageProps {
    settings: {
        store_name: string;
        store_address: string | null;
        store_phone: string | null;
        store_logo: string | null;
        receipt_footer: string | null;
    };
    [key: string]: unknown;
}

export default function StoreSettings() {
    const { settings } = usePage<PageProps>().props;
    const logoRef = useRef<HTMLInputElement>(null);

    const { data, setData, post, processing, errors } = useForm({
        store_name: settings.store_name ?? '',
        store_address: settings.store_address ?? '',
        store_phone: settings.store_phone ?? '',
        receipt_footer: settings.receipt_footer ?? '',
        store_logo: null as File | null,
    });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        post(route('settings.store.update'), {
            forceFormData: true,
        });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Pengaturan Toko" />
            <div className="p-4 md:p-6 max-w-xl mx-auto">
                <h1 className="text-xl font-semibold mb-6">Pengaturan Toko</h1>
                <form onSubmit={submit} className="space-y-5">
                    <div className="space-y-1.5">
                        <Label htmlFor="store_name">
                            Nama Toko <span className="text-destructive">*</span>
                        </Label>
                        <Input
                            id="store_name"
                            value={data.store_name}
                            onChange={(e) => setData('store_name', e.target.value)}
                        />
                        {errors.store_name && (
                            <p className="text-sm text-destructive">{errors.store_name}</p>
                        )}
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="store_address">Alamat</Label>
                        <Textarea
                            id="store_address"
                            rows={2}
                            value={data.store_address}
                            onChange={(e) => setData('store_address', e.target.value)}
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="store_phone">Nomor Telepon</Label>
                        <Input
                            id="store_phone"
                            value={data.store_phone}
                            onChange={(e) => setData('store_phone', e.target.value)}
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="receipt_footer">Footer Struk</Label>
                        <Input
                            id="receipt_footer"
                            value={data.receipt_footer}
                            onChange={(e) => setData('receipt_footer', e.target.value)}
                            placeholder="Terima kasih!"
                        />
                        <p className="text-xs text-muted-foreground">
                            Teks yang muncul di bawah struk penjualan.
                        </p>
                    </div>

                    <div className="space-y-1.5">
                        <Label>Logo Toko</Label>
                        {settings.store_logo && (
                            <img
                                src={`/storage/${settings.store_logo}`}
                                alt="Logo toko"
                                className="h-16 w-auto rounded border mb-2"
                            />
                        )}
                        <input
                            ref={logoRef}
                            type="file"
                            accept="image/*"
                            className="text-sm"
                            onChange={(e) => setData('store_logo', e.target.files?.[0] ?? null)}
                        />
                        {errors.store_logo && (
                            <p className="text-sm text-destructive">{errors.store_logo}</p>
                        )}
                    </div>

                    <Button type="submit" disabled={processing}>
                        {processing ? 'Menyimpan...' : 'Simpan Pengaturan'}
                    </Button>
                </form>
            </div>
        </AppLayout>
    );
}
