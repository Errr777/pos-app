import { Head, useForm } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FormEventHandler, useState } from 'react';
import { Store, MapPin, CheckCircle2 } from 'lucide-react';
import LogoUpload from '@/components/logo-upload';

const STEPS = [
    { id: 1, label: 'Info Toko', icon: Store },
    { id: 2, label: 'Outlet',    icon: MapPin },
    { id: 3, label: 'Selesai',   icon: CheckCircle2 },
];

export default function OnboardingIndex() {
    const [step, setStep] = useState(1);
    const [stepError, setStepError] = useState('');

    const { data, setData, post, processing, errors } = useForm({
        store_name:     '',
        store_address:  '',
        store_phone:    '',
        receipt_footer: 'Terima kasih!',
        store_logo:     null as File | null,
        outlet_name:    '',
        outlet_city:    '',
        outlet_phone:   '',
    });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        post(route('onboarding.store'), { forceFormData: true });
    };

    return (
        <>
        <style>{`
            @keyframes slideIn {
                from { opacity: 0; transform: translateX(16px); }
                to   { opacity: 1; transform: translateX(0); }
            }
            .step-animate { animation: slideIn 200ms ease-out; }
        `}</style>
        <div className="min-h-screen bg-muted/40 flex items-center justify-center p-4">
            <Head title="Setup Toko" />
            <div className="bg-background rounded-2xl shadow-lg w-full max-w-lg p-8">

                {/* Step indicator */}
                <div className="mb-8">
                    <div className="flex items-center justify-center gap-2">
                        {STEPS.map((s, i) => {
                            const Icon = s.icon;
                            const active = step === s.id;
                            const done = step > s.id;
                            return (
                                <div key={s.id} className="flex items-center gap-2">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-colors
                                        ${done  ? 'bg-primary text-primary-foreground' : ''}
                                        ${active && !done ? 'border-2 border-primary bg-background text-primary' : ''}
                                        ${!active && !done ? 'bg-muted text-muted-foreground' : ''}`}>
                                        {done ? <CheckCircle2 size={16} /> : <Icon size={16} />}
                                    </div>
                                    <span className={`text-sm ${active ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
                                        {s.label}
                                    </span>
                                    {i < STEPS.length - 1 && (
                                        <div className={`w-8 h-0.5 mx-1 transition-colors ${step > s.id ? 'bg-primary' : 'bg-border'}`} />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                    {step <= 2 && (
                        <p className="text-center text-xs text-muted-foreground mt-3">
                            Langkah {step} dari 2
                        </p>
                    )}
                </div>

                <form onSubmit={submit}>
                    {/* Step 1: Store info */}
                    {step === 1 && (
                        <div key={step} className="step-animate space-y-4">
                            <h2 className="text-xl font-semibold">Informasi Toko</h2>
                            <p className="text-sm text-muted-foreground">
                                Masukkan detail toko Anda yang akan tampil di struk dan dashboard.
                            </p>

                            <div className="space-y-1.5">
                                <Label htmlFor="store_name">
                                    Nama Toko <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                    id="store_name"
                                    value={data.store_name}
                                    onChange={(e) => setData('store_name', e.target.value)}
                                    placeholder="Contoh: Toko Maju Jaya"
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
                                    placeholder="Jl. Contoh No. 1, Jakarta"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="store_phone">Nomor Telepon</Label>
                                <Input
                                    id="store_phone"
                                    value={data.store_phone}
                                    onChange={(e) => setData('store_phone', e.target.value)}
                                    placeholder="0812-3456-7890"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="receipt_footer">Footer Struk</Label>
                                <Input
                                    id="receipt_footer"
                                    value={data.receipt_footer}
                                    onChange={(e) => setData('receipt_footer', e.target.value)}
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label>Logo Toko <span className="text-muted-foreground text-xs">(opsional)</span></Label>
                                <LogoUpload onChange={(f) => setData('store_logo', f)} />
                            </div>

                            {stepError && <p className="text-sm text-destructive">{stepError}</p>}
                            <Button
                                type="button"
                                className="w-full"
                                onClick={() => {
                                    if (!data.store_name.trim()) {
                                        setStepError('Nama toko wajib diisi.');
                                        return;
                                    }
                                    setStepError('');
                                    setStep(2);
                                }}
                            >
                                Lanjut →
                            </Button>
                        </div>
                    )}

                    {/* Step 2: First outlet */}
                    {step === 2 && (
                        <div key={step} className="step-animate space-y-4">
                            <h2 className="text-xl font-semibold">Outlet Pertama</h2>
                            <p className="text-sm text-muted-foreground">
                                Setup outlet / gudang utama Anda.
                            </p>

                            <div className="space-y-1.5">
                                <Label htmlFor="outlet_name">
                                    Nama Outlet <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                    id="outlet_name"
                                    value={data.outlet_name}
                                    onChange={(e) => setData('outlet_name', e.target.value)}
                                    placeholder="Contoh: Outlet Pusat"
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
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="outlet_phone">Telepon Outlet</Label>
                                <Input
                                    id="outlet_phone"
                                    value={data.outlet_phone}
                                    onChange={(e) => setData('outlet_phone', e.target.value)}
                                    placeholder="021-123-4567"
                                />
                            </div>

                            {stepError && <p className="text-sm text-destructive">{stepError}</p>}
                            <div className="flex gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="flex-1"
                                    onClick={() => { setStepError(''); setStep(1); }}
                                >
                                    ← Kembali
                                </Button>
                                <Button
                                    type="button"
                                    className="flex-1"
                                    onClick={() => {
                                        if (!data.outlet_name.trim()) {
                                            setStepError('Nama outlet wajib diisi.');
                                            return;
                                        }
                                        setStepError('');
                                        setStep(3);
                                    }}
                                >
                                    Lanjut →
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Confirm */}
                    {step === 3 && (
                        <div key={step} className="step-animate space-y-4 text-center">
                            <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                                <CheckCircle2 size={36} className="text-primary" />
                            </div>
                            <h2 className="text-xl font-semibold">Siap untuk memulai!</h2>
                            <div className="text-sm text-muted-foreground space-y-1 text-left bg-muted/40 rounded-lg p-4">
                                <p><span className="font-medium">Nama Toko:</span> {data.store_name}</p>
                                {data.store_address && (
                                    <p><span className="font-medium">Alamat:</span> {data.store_address}</p>
                                )}
                                <p><span className="font-medium">Outlet:</span> {data.outlet_name}</p>
                                {data.outlet_city && (
                                    <p><span className="font-medium">Kota:</span> {data.outlet_city}</p>
                                )}
                            </div>

                            <div className="flex gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="flex-1"
                                    onClick={() => setStep(2)}
                                >
                                    ← Kembali
                                </Button>
                                <Button type="submit" className="flex-1" disabled={processing}>
                                    {processing ? 'Menyimpan...' : 'Mulai Gunakan POS →'}
                                </Button>
                            </div>
                        </div>
                    )}
                </form>
            </div>
        </div>
        </>
    );
}
