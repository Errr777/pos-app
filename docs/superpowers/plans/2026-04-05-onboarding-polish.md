# Onboarding Wizard Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish wizard onboarding yang sudah ada dan tutup gap di Settings — step indicator lebih jelas, logo upload drag-and-drop, animasi transisi, copy teks Indonesia, dan section outlet di Settings.

**Architecture:** Komponen `LogoUpload` dibuat sekali dan dipakai di dua tempat (wizard + settings/store). Animasi transisi pakai CSS keyframe native (tanpa framer-motion). Backend AppSettingController diperluas untuk menyimpan outlet fields ke tabel `warehouses`. Tidak ada migrasi baru.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, Inertia.js v2, Laravel 12, PHPUnit.

---

## File Structure

| File | Status |
|------|--------|
| `resources/js/components/logo-upload.tsx` | **Baru** |
| `resources/js/pages/onboarding/Index.tsx` | Modifikasi |
| `resources/js/pages/settings/store.tsx` | Modifikasi |
| `resources/js/pages/auth/register.tsx` | Modifikasi |
| `app/Http/Controllers/AppSettingController.php` | Modifikasi |
| `tests/Feature/Settings/StoreSettingsTest.php` | **Baru** |

---

### Task 1: Komponen LogoUpload

**Files:**
- Create: `resources/js/components/logo-upload.tsx`

- [ ] **Step 1: Tulis komponen LogoUpload**

```tsx
// resources/js/components/logo-upload.tsx
import { useEffect, useRef, useState } from 'react';
import { UploadCloud, X } from 'lucide-react';

interface LogoUploadProps {
    currentUrl?: string;
    onChange: (file: File | null) => void;
}

export default function LogoUpload({ currentUrl, onChange }: LogoUploadProps) {
    const [preview, setPreview] = useState<string | null>(currentUrl ?? null);
    const [isDragging, setIsDragging] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        return () => {
            if (preview && preview !== currentUrl) {
                URL.revokeObjectURL(preview);
            }
        };
    }, [preview, currentUrl]);

    function handleFile(file: File | null) {
        if (!file) return;
        const url = URL.createObjectURL(file);
        setPreview(url);
        onChange(file);
    }

    function handleRemove() {
        setPreview(null);
        onChange(null);
        if (inputRef.current) inputRef.current.value = '';
    }

    return (
        <div>
            {preview ? (
                <div className="relative inline-block">
                    <img src={preview} alt="Logo preview" className="h-20 w-auto rounded border object-contain" />
                    <button
                        type="button"
                        onClick={handleRemove}
                        className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-0.5"
                        title="Hapus logo"
                    >
                        <X size={12} />
                    </button>
                </div>
            ) : (
                <div
                    className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
                        ${isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}
                    onClick={() => inputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={(e) => {
                        e.preventDefault();
                        setIsDragging(false);
                        handleFile(e.dataTransfer.files[0] ?? null);
                    }}
                >
                    <UploadCloud size={24} className="mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                        Seret & lepas gambar, atau <span className="text-primary underline">pilih file</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">PNG, JPG, SVG maks. 2MB</p>
                </div>
            )}
            <input
                ref={inputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            />
        </div>
    );
}
```

- [ ] **Step 2: Commit**

```bash
git add resources/js/components/logo-upload.tsx
git commit -m "feat: add LogoUpload drag-and-drop component"
```

---

### Task 2: Settings — Backend Outlet Fields

**Files:**
- Modify: `app/Http/Controllers/AppSettingController.php`
- Create: `tests/Feature/Settings/StoreSettingsTest.php`

- [ ] **Step 1: Tulis test yang gagal**

```php
<?php
// tests/Feature/Settings/StoreSettingsTest.php
namespace Tests\Feature\Settings;

use App\Models\AppSetting;
use App\Models\User;
use App\Models\Warehouse;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class StoreSettingsTest extends TestCase
{
    use RefreshDatabase;

    private function adminUser(): User
    {
        return User::factory()->create(['role' => 'admin', 'is_active' => true]);
    }

    public function test_settings_page_includes_outlet_data(): void
    {
        $admin = $this->adminUser();
        Warehouse::create([
            'code' => 'MAIN', 'name' => 'Outlet Pusat',
            'city' => 'Jakarta', 'phone' => '021-111',
            'is_active' => true, 'is_default' => true,
        ]);

        $response = $this->actingAs($admin)->get('/settings/store');

        $response->assertOk();
        $response->assertInertia(fn ($page) =>
            $page->has('outlet')
                 ->where('outlet.name', 'Outlet Pusat')
                 ->where('outlet.city', 'Jakarta')
        );
    }

    public function test_outlet_fields_are_saved(): void
    {
        $admin = $this->adminUser();
        AppSetting::set('store_name', 'Toko A');
        Warehouse::create([
            'code' => 'MAIN', 'name' => 'Lama',
            'is_active' => true, 'is_default' => true,
        ]);

        $this->actingAs($admin)->post('/settings/store', [
            'store_name'   => 'Toko A',
            'outlet_name'  => 'Outlet Baru',
            'outlet_city'  => 'Bandung',
            'outlet_phone' => '022-222',
        ]);

        $warehouse = Warehouse::where('is_default', true)->first();
        $this->assertEquals('Outlet Baru', $warehouse->name);
        $this->assertEquals('Bandung', $warehouse->city);
        $this->assertEquals('022-222', $warehouse->phone);
    }

    public function test_outlet_not_required_when_no_default_warehouse(): void
    {
        $admin = $this->adminUser();
        AppSetting::set('store_name', 'Toko A');

        $response = $this->actingAs($admin)->post('/settings/store', [
            'store_name' => 'Toko A',
        ]);

        $response->assertSessionHasNoErrors();
    }
}
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

```bash
php artisan test tests/Feature/Settings/StoreSettingsTest.php --stop-on-failure
```

Expected: FAIL — `outlet` key tidak ada di Inertia props.

- [ ] **Step 3: Update AppSettingController**

Ubah method `edit()`:

```php
public function edit(): \Inertia\Response
{
    abort_unless(auth()->user()->role === 'admin', 403);

    $defaultWarehouse = \App\Models\Warehouse::where('is_default', true)->first();

    return Inertia::render('settings/store', [
        'settings' => AppSetting::allAsArray(),
        'outlet'   => $defaultWarehouse ? [
            'name'  => $defaultWarehouse->name,
            'city'  => $defaultWarehouse->city,
            'phone' => $defaultWarehouse->phone,
        ] : null,
    ]);
}
```

Ubah method `update()` — tambah validasi outlet dan save ke warehouse:

```php
public function update(Request $request): \Illuminate\Http\RedirectResponse
{
    abort_unless(auth()->user()->role === 'admin', 403);

    $validated = $request->validate([
        'store_name'     => ['required', 'string', 'max:100'],
        'store_address'  => ['nullable', 'string', 'max:255'],
        'store_phone'    => ['nullable', 'string', 'max:30'],
        'receipt_footer' => ['nullable', 'string', 'max:255'],
        'store_logo'     => ['nullable', 'image', 'max:2048'],
        'outlet_name'    => ['nullable', 'string', 'max:100'],
        'outlet_city'    => ['nullable', 'string', 'max:100'],
        'outlet_phone'   => ['nullable', 'string', 'max:30'],
    ]);

    if ($request->hasFile('store_logo')) {
        $path = $request->file('store_logo')->store('logos', 'public');
        AppSetting::set('store_logo', $path);
    }

    foreach (['store_name', 'store_address', 'store_phone', 'receipt_footer'] as $key) {
        if (array_key_exists($key, $validated)) {
            AppSetting::set($key, $validated[$key]);
        }
    }

    $warehouse = \App\Models\Warehouse::where('is_default', true)->first();
    if ($warehouse && $request->filled('outlet_name')) {
        $warehouse->update([
            'name'  => $validated['outlet_name'],
            'city'  => $validated['outlet_city'] ?? null,
            'phone' => $validated['outlet_phone'] ?? null,
        ]);
    }

    PushSettingsToPanelJob::dispatch();

    return back()->with('success', 'Pengaturan toko berhasil disimpan.');
}
```

- [ ] **Step 4: Jalankan test, pastikan hijau**

```bash
php artisan test tests/Feature/Settings/StoreSettingsTest.php
```

Expected: 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add app/Http/Controllers/AppSettingController.php tests/Feature/Settings/StoreSettingsTest.php
git commit -m "feat: add outlet fields to store settings controller"
```

---

### Task 3: Settings — Frontend Outlet Section

**Files:**
- Modify: `resources/js/pages/settings/store.tsx`

- [ ] **Step 1: Update interface PageProps dan form state**

Ganti blok `interface PageProps` dan `useForm` yang ada:

```tsx
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
```

Ubah destructuring dan form state (di dalam `StoreSettings()`):

```tsx
const { settings, outlet } = usePage<PageProps>().props;

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
```

- [ ] **Step 2: Ganti logo input dengan LogoUpload dan tambah section outlet**

Tambah import di bagian atas:

```tsx
import LogoUpload from '@/components/logo-upload';
```

Hapus blok logo lama (ref dan input file):

```tsx
// Hapus ini:
const logoRef = useRef<HTMLInputElement>(null);
// Hapus juga import useRef dari react jika tidak dipakai lagi
```

Ganti blok `<div className="space-y-1.5">` untuk logo dengan:

```tsx
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
```

Tambah section outlet setelah blok logo, sebelum `<Button type="submit">`:

```tsx
{outlet !== null && (
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
    </>
)}
```

- [ ] **Step 3: Jalankan dev server dan cek Settings/store di browser**

```bash
composer run dev
```

Buka `http://localhost:8000/settings/store` — pastikan:
- Logo upload menampilkan drag-and-drop area (bukan input file polos)
- Section "Outlet Utama" muncul dengan 3 field
- Simpan bekerja tanpa error

- [ ] **Step 4: Commit**

```bash
git add resources/js/pages/settings/store.tsx
git commit -m "feat: add LogoUpload and outlet section to store settings"
```

---

### Task 4: Auth Register — Copy Teks Indonesia

**Files:**
- Modify: `resources/js/pages/auth/register.tsx`

- [ ] **Step 1: Update copy teks**

Ganti konten `AuthLayout` dan semua label/placeholder:

```tsx
// Ubah:
<AuthLayout title="Create an account" description="Enter your details below to create your account">
// Menjadi:
<AuthLayout title="Buat Akun" description="Masukkan detail di bawah untuk membuat akun">
```

```tsx
// Ubah label Name:
<Label htmlFor="name">Nama Lengkap</Label>
<Input ... placeholder="Nama lengkap Anda" ... />

// Ubah label Email address:
<Label htmlFor="email">Alamat Email</Label>

// Ubah label Password (sudah OK, tetap):
<Label htmlFor="password">Password</Label>

// Ubah label Confirm password:
<Label htmlFor="password_confirmation">Konfirmasi Password</Label>
<Input ... placeholder="Ulangi password" ... />

// Ubah button text:
{processing && <LoaderCircle className="h-4 w-4 animate-spin" />}
Buat Akun

// Ubah footer:
<div className="text-center text-sm text-muted-foreground">
    Sudah punya akun?{' '}
    <TextLink href={route('login')} tabIndex={6}>
        Masuk
    </TextLink>
</div>
```

- [ ] **Step 2: Cek halaman register di browser**

Buka `http://localhost:8000/register` — pastikan semua teks Indonesia, tidak ada teks English tersisa.

- [ ] **Step 3: Commit**

```bash
git add resources/js/pages/auth/register.tsx
git commit -m "fix: localize register page copy to Indonesian"
```

---

### Task 5: Wizard — Step Indicator + Animasi + LogoUpload

**Files:**
- Modify: `resources/js/pages/onboarding/Index.tsx`

- [ ] **Step 1: Tambah CSS keyframe untuk animasi**

Tambahkan `<style>` tag di dalam return, sebelum `<div className="min-h-screen...">`:

```tsx
<>
    <style>{`
        @keyframes slideIn {
            from { opacity: 0; transform: translateX(16px); }
            to   { opacity: 1; transform: translateX(0); }
        }
        .step-animate { animation: slideIn 200ms ease-out; }
    `}</style>
    <div className="min-h-screen ...">
```

- [ ] **Step 2: Update step indicator**

Ganti blok step indicator (baris `{/* Step indicator */}` sampai akhir `</div>` penutupnya):

```tsx
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
```

- [ ] **Step 3: Tambah key dan animasi pada konten setiap step**

Bungkus setiap `{step === N && (...)}` dengan `<div key={step} className="step-animate">`:

```tsx
{/* Step 1 */}
{step === 1 && (
    <div key="step-1" className="step-animate space-y-4">
        {/* ...konten step 1 tidak berubah... */}
    </div>
)}

{/* Step 2 */}
{step === 2 && (
    <div key="step-2" className="step-animate space-y-4">
        {/* ...konten step 2 tidak berubah... */}
    </div>
)}

{/* Step 3 */}
{step === 3 && (
    <div key="step-3" className="step-animate space-y-4 text-center">
        {/* ...konten step 3 tidak berubah... */}
    </div>
)}
```

- [ ] **Step 4: Ganti logo input dengan LogoUpload**

Tambah import di atas:

```tsx
import LogoUpload from '@/components/logo-upload';
```

Ganti blok logo di Step 1 (dari `<div className="space-y-1.5">` untuk logo sampai `</div>`):

```tsx
<div className="space-y-1.5">
    <Label>Logo Toko <span className="text-muted-foreground text-xs">(opsional)</span></Label>
    <LogoUpload onChange={(f) => setData('store_logo', f)} />
</div>
```

- [ ] **Step 5: Cek wizard di browser**

Buka `http://localhost:8000/onboarding` (pastikan `onboarding_done` = '0' di DB, atau ubah sementara via tinker):

```bash
php artisan tinker --execute="App\Models\AppSetting::set('onboarding_done', '0');"
```

Pastikan:
- Step indicator tampil dengan state aktif/done yang kontras
- Label "Langkah 1 dari 2" muncul di bawah step circles
- Saat klik "Lanjut →", konten slide in dari kanan
- Logo upload menampilkan drag-and-drop area

Reset onboarding setelah cek:

```bash
php artisan tinker --execute="App\Models\AppSetting::set('onboarding_done', '1');"
```

- [ ] **Step 6: Commit**

```bash
git add resources/js/pages/onboarding/Index.tsx
git commit -m "feat: polish wizard — step indicator, slide animation, LogoUpload"
```

---

### Task 6: Manual Smoke Test

- [ ] **Step 1: Test full flow wizard**

```bash
php artisan tinker --execute="App\Models\AppSetting::set('onboarding_done', '0');"
```

Login sebagai admin → harusnya redirect ke `/onboarding` → isi semua field termasuk upload logo → submit → cek redirect ke dashboard dengan flash "Selamat datang!".

- [ ] **Step 2: Test Settings/store**

Buka `/settings/store` → cek section Outlet Utama muncul → ubah nama outlet dan kota → simpan → reload → pastikan nilai tersimpan.

- [ ] **Step 3: Test register page**

Buka `/register` → pastikan semua teks Indonesia → tidak ada admin yang ada di DB dulu (atau test di fresh DB).

- [ ] **Step 4: Jalankan full test suite**

```bash
composer run test
```

Expected: semua tests pass, tidak ada regresi.

- [ ] **Step 5: Commit akhir jika ada perubahan minor dari smoke test**

```bash
git add -p
git commit -m "fix: smoke test fixes for onboarding polish"
```
