# Plan: SaaS Control Panel untuk POS App

> Status: **DRAFT — belum ada implementasi**
> Dibuat: 2026-03-28
> Terakhir diupdate: 2026-03-28

---

## 1. Visi & Tujuan

Memungkinkan owner untuk mendistribusikan POS App ke banyak tenant (bisnis/klien) dengan kontrol terpusat:
- Aktifkan/nonaktifkan modul per tenant
- Batasi jumlah user dan outlet per tenant
- Kelola status langganan (aktif, suspended, expired)
- Semua dilakukan dari satu web panel tanpa perlu masuk ke server masing-masing tenant

---

## 2. Deployment Model

### Model A — Satu Coolify, Banyak Project

```
Coolify Instance
├── laravel_app_tenant_A  (container) ─── MariaDB_A (atau shared MariaDB)
├── laravel_app_tenant_B  (container) ─── MariaDB_B
├── laravel_app_tenant_C  (container) ─── MariaDB_C
└── control_panel         (container) ─── MariaDB_CP
```

**Kelebihan:**
- Satu server, biaya lebih murah
- Satu Coolify dashboard untuk semua
- Jaringan internal — license API bisa pakai `coolify` network (tidak perlu public internet)
- Mudah monitor semua container

**Kekurangan:**
- Satu server down = semua tenant down
- Resource sharing — satu tenant bisa mempengaruhi performa tenant lain
- Scaling vertikal saja (tambah RAM/CPU server)

### Model B — Coolify Per Tenant (Multi-server)

```
Server Owner (Control Panel)
└── control_panel app

Server Tenant A (Coolify A)
└── laravel_app_tenant_A + MariaDB_A

Server Tenant B (Coolify B)
└── laravel_app_tenant_B + MariaDB_B
```

**Kelebihan:**
- Isolasi penuh — satu tenant down tidak pengaruh lain
- Bisa scaling per tenant
- Tenant bisa punya Coolify sendiri (self-managed)
- Cocok untuk klien enterprise yang minta dedicated server

**Kekurangan:**
- Biaya lebih tinggi (N server)
- License sync harus via public internet (HTTPS)
- Management lebih kompleks

### Rekomendasi
**Mulai dengan Model A** (satu Coolify, hemat biaya). Arsitektur license sync dibuat stateless sehingga bisa migrasi ke Model B kapan saja tanpa perubahan besar di POS App.

---

## 3. Arsitektur Sistem

```
┌─────────────────────────────────────┐
│         CONTROL PANEL APP           │
│  - CRUD Tenant                      │
│  - Set modul aktif per tenant       │
│  - Set limit user + outlet          │
│  - Manage status + expiry           │
│  - API: GET /api/license/{key}      │
└──────────────────┬──────────────────┘
                   │ HTTPS / internal network
        ┌──────────┴──────────┐
        ▼                     ▼
┌──────────────┐     ┌──────────────┐
│  POS App A   │     │  POS App B   │
│              │     │              │
│ license_cache│     │ license_cache│
│ (DB table)   │     │ (DB table)   │
│              │     │              │
│ sync tiap    │     │ sync tiap    │
│ 6 jam        │     │ 6 jam        │
└──────────────┘     └──────────────┘
```

**Prinsip desain:**
- POS App tidak hit control panel setiap request (pakai local cache)
- Jika control panel down, POS App tetap jalan (pakai cache terakhir)
- License key adalah UUID unik per tenant, di-set via env var `LICENSE_KEY`

---

## 4. Fitur Control Panel

### 4.1 Manajemen Tenant

| Fitur | Detail |
|-------|--------|
| Daftar tenant | Tabel semua tenant, status, expiry, usage |
| Tambah tenant | Nama bisnis, email kontak, generate license key |
| Edit tenant | Ubah nama, kontak, catatan |
| Hapus tenant | Soft delete, license key jadi invalid |
| Detail tenant | Lihat usage: jumlah user aktif, jumlah outlet |

### 4.2 Konfigurasi Modul per Tenant

Toggle per modul dari daftar berikut (sesuai `ModuleKey` di POS App):

| Modul | Default |
|-------|---------|
| `dashboard` | ✅ selalu aktif |
| `pos` | ✅ |
| `items` | ✅ |
| `inventory` | ✅ |
| `warehouses` | ✅ |
| `purchase_orders` | ✅ |
| `customers` | ✅ |
| `suppliers` | ✅ |
| `reports` | ✅ |
| `returns` | optional |
| `users` | ✅ |

### 4.3 Batas Penggunaan (Limits)

| Limit | Default | Bisa Diubah |
|-------|---------|-------------|
| Max users | 5 | ✅ |
| Max outlets/warehouses | 2 | ✅ |
| Max items | unlimited | optional |
| Max transaksi/bulan | unlimited | optional (fase 2) |

### 4.4 Manajemen Langganan

| Fitur | Detail |
|-------|--------|
| Status: `active` | Semua berjalan normal |
| Status: `suspended` | Login masih bisa, tapi semua operasi diblokir — tampil halaman "Akun dibekukan" |
| Status: `expired` | Sama dengan suspended, tapi pesan berbeda "Langganan habis" |
| Status: `trial` | Bisa set expiry date, setelah lewat otomatis expired |
| Perpanjang | Set `expires_at` baru |
| Notifikasi | (fase 2) email otomatis H-7, H-3, H-1 sebelum expired |

### 4.5 API License Endpoint

```
GET /api/license/{license_key}
Authorization: tidak perlu (key adalah secret)

Response 200:
{
  "status": "active",
  "expires_at": "2026-12-31T23:59:59Z",
  "modules": ["dashboard","pos","items","inventory","warehouses",
               "purchase_orders","customers","suppliers","reports","users"],
  "limits": {
    "max_users": 5,
    "max_outlets": 2
  },
  "tenant_name": "Toko ABC",
  "synced_at": "2026-03-28T10:00:00Z"
}

Response 404: {"error": "License not found"}
Response 403: {"error": "License revoked"}
```

---

## 5. Perubahan di POS App

### 5.1 Tabel Baru: `license_config`

```sql
CREATE TABLE license_config (
    id            INTEGER PRIMARY KEY,
    license_key   VARCHAR(255) NOT NULL,
    tenant_name   VARCHAR(255),
    status        ENUM('active','suspended','expired','trial') DEFAULT 'active',
    modules       JSON,          -- array of enabled module keys
    max_users     INTEGER DEFAULT 5,
    max_outlets   INTEGER DEFAULT 2,
    expires_at    DATETIME,
    last_synced_at DATETIME,
    raw_response  JSON,          -- full response dari control panel (untuk debug)
    created_at    DATETIME,
    updated_at    DATETIME
);
```

Hanya ada **satu row** di tabel ini per instance POS.

### 5.2 Artisan Command: `license:sync`

```bash
php artisan license:sync
# Hit control panel API, update license_config table
# Jika gagal: log warning, jangan hapus cache lama
```

Dijadwalkan di `routes/console.php`:
```php
Schedule::command('license:sync')->everySixHours();
```

### 5.3 Middleware: `CheckLicense`

Dipasang di semua route yang membutuhkan auth. Cek dari DB lokal (bukan hit API).

**Logic:**
```
1. Baca license_config dari DB
2. Jika tidak ada → bypass (graceful, untuk instance lama yang belum setup)
3. Jika status = suspended/expired → redirect ke /license-expired
4. Jika expires_at sudah lewat → redirect ke /license-expired
5. Lanjut normal
```

### 5.4 Middleware: `CheckModuleEnabled`

Extend sistem permission yang sudah ada. Dipasang per route group.

**Logic:**
```
1. Ambil modul dari route name/parameter
2. Cek apakah modul ada di license_config.modules
3. Jika tidak → 403 dengan pesan "Modul tidak aktif di paket Anda"
```

### 5.5 Guard di Controller

**`UserController::store()`:**
```php
$license = LicenseConfig::first();
if ($license && User::count() >= $license->max_users) {
    return back()->withErrors(['limit' => 'Batas jumlah user tercapai.']);
}
```

**`WarehouseController::store()`:**
```php
$license = LicenseConfig::first();
if ($license && Warehouse::count() >= $license->max_outlets) {
    return back()->withErrors(['limit' => 'Batas jumlah outlet tercapai.']);
}
```

### 5.6 Sidebar — Sembunyikan Modul Tidak Aktif

Di `HandleInertiaRequests.php`, share `enabledModules` ke semua halaman:
```php
'enabledModules' => LicenseConfig::first()?->modules ?? 'all',
```

Di `nav-main.tsx`, filter nav items berdasarkan `enabledModules`.

### 5.7 Env Var Baru

```
LICENSE_KEY=uuid-unik-per-tenant
LICENSE_API_URL=https://control-panel.domain.com
```

---

## 6. Tech Stack Control Panel

| Layer | Pilihan | Alasan |
|-------|---------|--------|
| Backend | Laravel 12 | Sama dengan POS App, familiar |
| Frontend | **Filament v3** | Admin panel siap pakai, tidak perlu buat UI dari scratch |
| DB | MySQL/MariaDB | Bisa share MariaDB Coolify yang sama |
| Auth | Filament default | Single user (owner only), simple |

**Kenapa Filament:** Control panel adalah internal tool hanya untuk owner. Filament memberi CRUD, tabel, form, statistik dashboard — semua sudah ada. Tidak perlu buat halaman React custom.

---

## 7. Tahapan Implementasi

### Fase 1 — Fondasi (Minimum Viable)

| # | Task | Di mana |
|---|------|---------|
| 1.1 | Buat project Laravel baru + install Filament | Control Panel (repo baru) |
| 1.2 | Model + migration: `Tenant`, `LicenseKey` | Control Panel |
| 1.3 | Filament resource: TenantResource (CRUD) | Control Panel |
| 1.4 | API endpoint `GET /api/license/{key}` | Control Panel |
| 1.5 | Migration `license_config` di POS App | POS App |
| 1.6 | Model `LicenseConfig` + artisan `license:sync` | POS App |
| 1.7 | Scheduler `license:sync` tiap 6 jam | POS App |
| 1.8 | Middleware `CheckLicense` (status/expiry check) | POS App |
| 1.9 | Halaman `/license-expired` di POS App | POS App |

### Fase 2 — Kontrol Modul & Limit

| # | Task | Di mana |
|---|------|---------|
| 2.1 | Filament: toggle modul per tenant | Control Panel |
| 2.2 | Filament: set max_users + max_outlets | Control Panel |
| 2.3 | Middleware `CheckModuleEnabled` | POS App |
| 2.4 | Sembunyikan modul di sidebar sesuai license | POS App |
| 2.5 | Guard limit user di `UserController` | POS App |
| 2.6 | Guard limit outlet di `WarehouseController` | POS App |
| 2.7 | Tampil info limit di halaman Users + Warehouses | POS App |

### Fase 3 — Polish & Monitoring

| # | Task | Di mana |
|---|------|---------|
| 3.1 | Dashboard Filament: statistik tenant aktif, akan expired | Control Panel |
| 3.2 | Halaman "Info Paket" di POS App (lihat modul aktif, sisa limit) | POS App |
| 3.3 | Email notifikasi H-7 sebelum expired | Control Panel |
| 3.4 | Sync on-demand via webhook (instant update tanpa tunggu 6 jam) | Keduanya |
| 3.5 | Audit log: kapan tenant di-suspend, diperpanjang, dll | Control Panel |

---

## 8. Yang Perlu Diselesaikan / Disiapkan Sebelum Mulai

### Di POS App (codebase ini)

| # | Item | Kenapa penting |
|---|------|----------------|
| P1 | **Pastikan `QUEUE_CONNECTION=database` dan queue worker jalan** | `license:sync` bisa dijalankan via queue, bukan blocking |
| P2 | **Audit semua route yang perlu dilindungi middleware** | Agar tidak ada route yang lolos check license |
| P3 | **Konfirmasi: apakah `dashboard` modul selalu wajib aktif?** | Jika ya, hardcode exempt dari module check |
| P4 | **Tentukan behavior graceful-degradation** | Jika control panel tidak bisa dicapai dan cache expired 7 hari, apa yang terjadi? Block atau bypass? |
| P5 | **Sidebar nav items sudah punya mapping ke ModuleKey** | Perlu verifikasi semua nav item sudah punya key yang konsisten |

### Di Infrastructure / DevOps

| # | Item | Kenapa penting |
|---|------|----------------|
| I1 | **Tentukan domain control panel** | Dibutuhkan untuk `LICENSE_API_URL` env var di semua tenant |
| I2 | **Coolify project baru untuk control panel** | Repo terpisah, deploy terpisah |
| I3 | **Apakah MariaDB control panel shared atau dedicated?** | Jika shared, pastikan DB name berbeda |
| I4 | **SSL di control panel** | API license harus HTTPS jika Model B (multi-server) |

### Keputusan Desain yang Perlu Dikonfirmasi

| # | Pertanyaan | Opsi |
|---|-----------|------|
| D1 | Jika license tidak ada (instance baru, belum setup) → block atau allow? | **Rekomendasi: allow** (graceful, untuk dev/testing) |
| D2 | Jika sync gagal dan cache > 7 hari old → block atau allow? | **Rekomendasi: allow** dengan warning di dashboard admin |
| D3 | Apakah admin POS bisa lihat info license mereka? | **Rekomendasi: ya**, halaman read-only "Info Paket" |
| D4 | Apakah control panel punya fitur trial otomatis? | Fase 1: manual. Fase 3: otomatis |
| D5 | Mulai Fase 1 atau Fase 2 dulu? | Fase 1 lebih kecil risikonya |

---

## 9. Estimasi Kompleksitas

| Fase | Estimasi Effort | Risiko |
|------|----------------|--------|
| Fase 1 (fondasi) | Medium — repo baru + 8 task di POS | Low — tidak ubah logika existing |
| Fase 2 (modul+limit) | Medium — integrasi lebih dalam di sidebar+controllers | Medium — perlu test semua modul |
| Fase 3 (polish) | Low-Medium — mostly additive | Low |

**Total: bisa dikerjakan bertahap, Fase 1 tidak breaking change untuk POS App yang sudah live.**

---

## 10. Out of Scope (tidak direncanakan saat ini)

- Billing / payment gateway otomatis (Midtrans, Stripe)
- Multi-owner / reseller tier
- Per-tenant custom domain
- Tenant bisa self-register
- Usage analytics (transaksi per bulan, dll)
- White-label (custom branding per tenant)
