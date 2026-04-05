---
date: 2026-04-05
status: approved
---

# Onboarding Wizard Polish — Design Spec

## Goal

Polish wizard onboarding yang sudah ada dan tutup gap di halaman Settings, tanpa membangun ulang dari nol. Lima perbaikan konkret: step indicator, logo upload, copy Indonesia, animasi transisi, dan outlet di Settings.

## Architecture

Tidak ada migrasi baru. Semua perubahan di frontend dan satu perubahan backend (AppSettingController + settings/store). Komponen `LogoUpload` dibuat sekali dan dipakai di dua tempat (wizard + settings).

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, Inertia.js v2, Laravel 12. Animasi transisi pakai CSS native (tanpa framer-motion — tidak ada di dependencies).

---

## File Structure

| File | Status | Keterangan |
|------|--------|------------|
| `resources/js/components/logo-upload.tsx` | **Baru** | Drag-and-drop + preview, shared component |
| `resources/js/pages/onboarding/Index.tsx` | Modifikasi | Step indicator, animasi, logo upload, copy ID |
| `resources/js/pages/settings/store.tsx` | Modifikasi | Section outlet, logo upload pakai komponen baru |
| `resources/js/pages/auth/register.tsx` | Modifikasi | Copy teks Indonesia |
| `app/Http/Controllers/AppSettingController.php` | Modifikasi | Validasi + save outlet fields |

---

## Komponen: LogoUpload

**Path:** `resources/js/components/logo-upload.tsx`

```tsx
interface LogoUploadProps {
    currentUrl?: string        // URL logo yang sudah tersimpan (mode settings)
    onChange: (file: File | null) => void
}
```

**Behavior:**
- Area klik + drag-and-drop (`onDragOver`, `onDrop`)
- Setelah file dipilih → tampil `<img>` thumbnail preview + tombol "Hapus"
- Jika `currentUrl` ada → tampil sebagai preview awal (sebelum file baru dipilih)
- Accept: `image/*`
- Tidak ada validasi ukuran di komponen — validasi 2MB tetap di backend

**States:**
- `preview: string | null` — object URL dari file yang dipilih, atau `currentUrl`
- `isDragging: boolean` — highlight border saat drag over

**Cleanup:** `URL.revokeObjectURL()` di `useEffect` cleanup saat preview berubah.

---

## Wizard Polish (onboarding/Index.tsx)

### Step Indicator

Step 3 (konfirmasi) adalah summary, bukan langkah data — tetap 3 icon tapi label progress hanya muncul untuk step 1 dan 2:

```
"Langkah 1 dari 2 — Informasi Toko"
"Langkah 2 dari 2 — Outlet Pertama"
```

Perubahan visual:
- Connector: `h-px` → `h-0.5`, warna `bg-primary` saat done (sebelumnya `bg-border`)
- State done: `bg-primary text-primary-foreground`
- State aktif: `border-2 border-primary bg-background text-primary`
- State pending: `bg-muted text-muted-foreground`

### Animasi Transisi

Pakai CSS `transition` + key trick — saat step berubah, div konten di-unmount dan mount ulang dengan class fade+slide:

```tsx
// Tambah CSS ke dalam <style> tag di komponen atau via Tailwind arbitrary
// Kelas: animate-slide-in (dari kanan), animate-slide-out (ke kiri)
```

Implementasi konkret:
- `key={step}` pada `<div>` konten setiap step
- CSS keyframe `@keyframes slideIn { from { opacity:0; transform:translateX(20px) } to { opacity:1; transform:translateX(0) } }`
- Tambah di inline `<style>` tag dalam komponen (tidak ada Tailwind arbitrary untuk keyframe)
- Durasi: 200ms ease-out

### Logo Upload

Ganti `<input type="file">` plain dengan `<LogoUpload onChange={(f) => setData('store_logo', f)} />`.

### Copy Indonesia

Semua teks di `onboarding/Index.tsx` sudah Indonesia — cek dan perbaiki placeholder yang masih English:
- "Full name" → tidak ada di wizard, sudah aman
- Pastikan button text, label, placeholder konsisten

---

## Auth Register (register.tsx)

Perubahan copy:

| Sebelum | Sesudah |
|---------|---------|
| `title="Create an account"` | `title="Buat Akun"` |
| `description="Enter your details below..."` | `description="Masukkan detail di bawah untuk membuat akun"` |
| `<Label>Name</Label>` | `<Label>Nama Lengkap</Label>` |
| `placeholder="Full name"` | `placeholder="Nama lengkap Anda"` |
| `<Label>Email address</Label>` | `<Label>Alamat Email</Label>` |
| `placeholder="email@example.com"` | tetap sama (sudah universal) |
| `Create account` (button) | `Buat Akun` |
| `Already have an account?` | `Sudah punya akun?` |
| `Log in` | `Masuk` |

---

## Settings Outlet (AppSettingController + settings/store.tsx)

### Backend

`AppSettingController::edit()` tambah load warehouse default:

```php
$defaultWarehouse = Warehouse::where('is_default', true)->first();

return Inertia::render('settings/store', [
    'settings' => AppSetting::allAsArray(),
    'outlet'   => $defaultWarehouse ? [
        'name'  => $defaultWarehouse->name,
        'city'  => $defaultWarehouse->city,
        'phone' => $defaultWarehouse->phone,
    ] : null,
]);
```

`AppSettingController::update()` tambah validasi dan save outlet:

```php
// Tambah ke $request->validate():
'outlet_name'  => ['nullable', 'string', 'max:100'],
'outlet_city'  => ['nullable', 'string', 'max:100'],
'outlet_phone' => ['nullable', 'string', 'max:30'],

// Setelah save app_settings:
$warehouse = Warehouse::where('is_default', true)->first();
if ($warehouse && ($request->filled('outlet_name') || $request->has('outlet_city') || $request->has('outlet_phone'))) {
    $warehouse->update([
        'name'  => $request->input('outlet_name', $warehouse->name),
        'city'  => $request->input('outlet_city'),
        'phone' => $request->input('outlet_phone'),
    ]);
}
```

### Frontend

`settings/store.tsx` tambah prop `outlet` ke type dan form state. Tambah section baru di bawah section toko:

```
Section: Outlet Utama
  - Nama Outlet (input text, required jika outlet ada)
  - Kota (input text, optional)
  - Telepon Outlet (input text, optional)
```

Jika `outlet === null` (belum ada warehouse default) — sembunyikan section ini.

---

## Out of Scope

- Self-signup tenant baru (tidak ada infrastruktur multi-tenant)
- Step "first user" di wizard (user lain dibuat via manajemen user)
- Reset/jalankan ulang wizard dari Settings
- Validasi ukuran file di komponen LogoUpload (sudah ada di backend)
