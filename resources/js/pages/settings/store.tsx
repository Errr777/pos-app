import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, useForm, usePage } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FormEventHandler } from 'react';
import LogoUpload from '@/components/logo-upload';
import { ShieldCheck, ShieldAlert } from 'lucide-react';

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
    outlet: {
        name: string;
        city: string | null;
        phone: string | null;
    } | null;
    [key: string]: unknown;
}

interface License {
    valid: boolean;
    status: string;
    expires_at: string | null;
    max_users: number;
    max_outlets: number;
}

export default function StoreSettings() {
    const { settings, outlet } = usePage<PageProps>().props;
    const license = (usePage().props as { license?: License }).license ?? null;

    const { data, setData, post, processing, errors } = useForm({
        store_name:     settings.store_name ?? '',
        store_address:  settings.store_address ?? '',
        store_phone:    settings.store_phone ?? '',
        receipt_footer: settings.receipt_footer ?? '',
        store_logo:     null as File | null,
        outlet_name:    outlet?.name ?? '',
        outlet_city:    outlet?.city ?? '',
        outlet_phone:   outlet?.phone ?? '',
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
                        <Textarea
                            id="receipt_footer"
                            rows={4}
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
                        <LogoUpload
                            currentUrl={settings.store_logo ? `/storage/${settings.store_logo}` : undefined}
                            onChange={(f) => setData('store_logo', f)}
                        />
                        {errors.store_logo && (
                            <p className="text-sm text-destructive">{errors.store_logo}</p>
                        )}
                    </div>

                    {outlet != null && (
                        <>
                            <div className="border-t pt-5">
                                <h2 className="text-base font-semibold mb-4">Outlet Utama</h2>
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="outlet_name">Nama Outlet</Label>
                                <Input
                                    id="outlet_name"
                                    value={data.outlet_name}
                                    onChange={(e) => setData('outlet_name', e.target.value)}
                                />
                                {errors.outlet_name && (
                                    <p className="text-sm text-destructive">{errors.outlet_name}</p>
                                )}
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="outlet_city">Kota</Label>
                                <Input
                                    id="outlet_city"
                                    value={data.outlet_city}
                                    onChange={(e) => setData('outlet_city', e.target.value)}
                                    placeholder="Jakarta"
                                />
                                {errors.outlet_city && (
                                    <p className="text-sm text-destructive">{errors.outlet_city}</p>
                                )}
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="outlet_phone">Telepon Outlet</Label>
                                <Input
                                    id="outlet_phone"
                                    value={data.outlet_phone}
                                    onChange={(e) => setData('outlet_phone', e.target.value)}
                                    placeholder="021-123-4567"
                                />
                                {errors.outlet_phone && (
                                    <p className="text-sm text-destructive">{errors.outlet_phone}</p>
                                )}
                            </div>
                        </>
                    )}

                    <Button type="submit" disabled={processing}>
                        {processing ? 'Menyimpan...' : 'Simpan Pengaturan'}
                    </Button>
                </form>

                {/* License Info */}
                {license && (
                    <div className="mt-8 pt-6 border-t">
                        <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
                            {license.valid
                                ? <ShieldCheck size={16} className="text-green-600" />
                                : <ShieldAlert size={16} className="text-red-500" />}
                            Informasi Lisensi
                        </h2>
                        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                            <div>
                                <dt className="text-muted-foreground text-xs">Status</dt>
                                <dd className="font-medium capitalize mt-0.5">{license.status}</dd>
                            </div>
                            <div>
                                <dt className="text-muted-foreground text-xs">Berlaku hingga</dt>
                                <dd className={`font-medium mt-0.5 ${(() => {
                                    if (!license.expires_at) return '';
                                    const diff = Math.ceil((new Date(license.expires_at).getTime() - Date.now()) / 86400000);
                                    return diff <= 7 ? 'text-red-600' : diff <= 14 ? 'text-amber-600' : '';
                                })()}`}>
                                    {license.expires_at
                                        ? new Date(license.expires_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
                                        : '—'}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-muted-foreground text-xs">Maks. Pengguna</dt>
                                <dd className="font-medium mt-0.5">{license.max_users}</dd>
                            </div>
                            <div>
                                <dt className="text-muted-foreground text-xs">Maks. Outlet</dt>
                                <dd className="font-medium mt-0.5">{license.max_outlets}</dd>
                            </div>
                        </dl>
                        <p className="text-xs text-muted-foreground mt-3">
                            Untuk perpanjangan lisensi, hubungi administrator.
                        </p>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
