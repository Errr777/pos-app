# Deployment Guide — POS App

Panduan ini mencakup deployment **POS App** (client) dan **Panel SaaS** (control panel).

---

## Arsitektur Production

```
┌─────────────────────────────────────────────────────────┐
│  VPS / Server (Coolify)                                  │
│                                                          │
│  ┌─────────────────────┐   ┌─────────────────────────┐  │
│  │  pos-app-production │   │  pos-app-panel          │  │
│  │  (Laravel + Docker) │   │  (Laravel + Docker)     │  │
│  │  port 80            │   │  port 80                │  │
│  └──────────┬──────────┘   └───────────┬─────────────┘  │
│             │                          │                 │
│  ┌──────────▼──────────────────────────▼─────────────┐  │
│  │  MariaDB (Coolify managed)                        │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## Repo & Folder Structure

| Folder | Repo GitHub | Keterangan |
|---|---|---|
| `pos-app/` | `Errr777/pos-app` | Source dev utama |
| `pos-app-production/` | `Errr777/pos-app-production` | Repo yang di-deploy Coolify |
| `pos-app-panel/` | `Errr777/pos-app-panel` | Source + deploy panel |

---

## Bagian 1: Deploy POS App (Client)

### Workflow Harian

```
Edit kode di pos-app/
      ↓
./sync-to-production.sh   ← sync + build asset di pos-app-production/
      ↓
git push pos-app-production ke GitHub
      ↓
Coolify auto-deploy (jika webhook aktif)
atau
Trigger manual di Coolify dashboard
```

### Langkah Detail

**1. Sync dari dev ke production folder**

```bash
cd /Users/errr/Developer/Project/my/pos-app
./sync-to-production.sh
```

Script ini melakukan:
- `rsync` file dari `pos-app/` ke `pos-app-production/` (mengabaikan `.env`, `vendor/`, `node_modules/`, dll.)
- `composer install`
- `npm ci && npm run build`
- `docker compose build` *(perlu Docker Desktop aktif di Mac)*
- `docker compose up -d` *(hanya berjalan lokal — di server ditangani Coolify)*

> **Catatan:** Langkah `docker compose up -d` akan gagal di Mac karena network `coolify` hanya ada di VPS. Ini normal — file sudah tersync dan siap di-push.

**Flag opsional:**
```bash
./sync-to-production.sh --dry-run   # preview, tidak ada perubahan
./sync-to-production.sh --files     # sync file saja, skip build
```

**2. Commit dan push ke GitHub**

```bash
cd /Users/errr/Developer/Project/my/pos-app-production
git add -A
git commit -m "sync: update dari main"
git push
```

**3. Coolify auto-deploy**

Coolify mendeteksi push ke branch `main` dan otomatis rebuild + restart container.
Pantau progress di: Coolify dashboard → aplikasi POS → Deployments.

**4. Verifikasi**

```bash
curl http://fgp9mk55i3e2q4k31hyi27re.72.62.125.181.sslip.io/up
# Response: {"status":"ok","..."}
```

---

### Setup Pertama Kali (POS App)

**1. Buat project di Coolify**

1. Login ke Coolify dashboard
2. **New Resource → Docker Compose** → pilih repo `pos-app-production`
3. **Compose File**: `docker-compose.yml`
4. **Port**: `80`
5. **Domain**: masukkan domain atau biarkan pakai sslip.io

**2. Environment Variables di Coolify**

```
APP_NAME=POS App
APP_ENV=production
APP_DEBUG=false
APP_URL=http://your-domain.com
APP_KEY=base64:xxxx              # php artisan key:generate --show

DB_CONNECTION=mysql
DB_HOST=<container-hostname-mariadb>
DB_PORT=3306
DB_DATABASE=pos_db
DB_USERNAME=pos_user
DB_PASSWORD=<password>

HASH_ID_SALT=<random-32-chars>   # JANGAN DIUBAH setelah deploy pertama

SESSION_DRIVER=database
SESSION_LIFETIME=120
QUEUE_CONNECTION=database

TRUSTED_PROXIES=*
SESSION_SECURE_COOKIE=false      # true jika domain pakai HTTPS

# License (isi setelah panel aktif)
# Diisi via: php artisan license:setup
```

**3. Deploy pertama**

Klik **Deploy** di Coolify. Container akan:
- Menunggu MariaDB siap
- Menjalankan `php artisan migrate --force`
- Membuat storage symlink
- Cache config/routes/views
- Start nginx + php-fpm + queue worker

**4. Seed data awal (pertama kali saja)**

Via Coolify Terminal atau SSH:
```bash
docker exec -it laravel_app php artisan db:seed
```

Credentials default setelah seed:

| Email | Password | Role |
|---|---|---|
| admin@admin.com | 12345678 | Admin |
| staff@pos.com | 12345678 | Staff |
| kasir1@pos.com | 12345678 | Kasir |

> **Ganti semua password setelah login pertama.**

**5. Setup lisensi**

```bash
docker exec -it laravel_app php artisan license:setup
```

Masukkan:
- License Key (dari panel)
- Panel URL (URL pos-app-panel)

---

## Bagian 2: Deploy Panel SaaS

### Workflow Harian

Panel di-deploy langsung dari repo `pos-app-panel` — tidak perlu sync script terpisah.

```
Edit kode di pos-app-panel/
      ↓
npm run build  (build frontend)
      ↓
git add + git commit + git push
      ↓
Coolify auto-deploy
```

### Setup Pertama Kali (Panel)

**1. Buat project di Coolify**

1. **New Resource → Docker Compose** → pilih repo `pos-app-panel`
2. **Compose File**: `docker-compose.yml`
3. **Port**: `80`
4. **Domain**: masukkan domain panel

**2. Environment Variables di Coolify**

```
APP_NAME="POS Panel"
APP_ENV=production
APP_DEBUG=false
APP_URL=http://your-panel-domain.com
APP_KEY=base64:xxxx

DB_CONNECTION=mysql
DB_HOST=<container-hostname-mariadb>
DB_PORT=3306
DB_DATABASE=panel_db
DB_USERNAME=panel_user
DB_PASSWORD=<password>

SESSION_DRIVER=database
QUEUE_CONNECTION=database
MAIL_MAILER=smtp                 # opsional, untuk notifikasi email
MAIL_HOST=smtp.mailtrap.io
MAIL_PORT=587
MAIL_USERNAME=
MAIL_PASSWORD=
MAIL_FROM_ADDRESS=noreply@panel.com

TRUSTED_PROXIES=*
SESSION_SECURE_COOKIE=false
```

**3. Deploy dan seed**

```bash
docker exec -it panel_app php artisan db:seed
```

Credentials default panel:

| Email | Password |
|---|---|
| admin@panel.com | password |

> **Ganti password setelah login pertama.**

---

## Bagian 3: Koneksi Panel ↔ POS App

Setelah kedua app aktif, sambungkan:

**1. Buat tenant di panel**

1. Login ke panel
2. **Tenants → Tambah Tenant**
3. Isi: nama bisnis, email, status `active`, modul, batas user/outlet
4. Salin **License Key** yang ter-generate otomatis

**2. Setup lisensi di POS App**

```bash
docker exec -it laravel_app php artisan license:setup
# Masukkan License Key dan Panel URL
```

**3. Verifikasi koneksi**

Setelah setup, app akan sync otomatis dalam beberapa detik. Cek:
- Halaman **Pengaturan → Lisensi** di POS App → status harus `active`
- Di panel → **Tenants → Show** → kolom `Last Synced` harus terisi

**4. App URL otomatis tersimpan di panel**

Saat POS App sync ke panel, `app_url` dan `webhook_url` tersimpan otomatis di data tenant. Tidak perlu input manual.

---

## Bagian 4: Troubleshooting

### Container restart loop

```bash
docker logs laravel_app --tail=50
```

Penyebab umum:
- **"Nothing to migrate"** → normal, bukan error
- **DB_HOST salah** → cek nama container MariaDB di Coolify network
- **APP_KEY kosong** → generate dan set di Coolify env vars

### Lisensi tidak sync

1. Cek `APP_URL` di POS App — harus bisa diakses dari luar (bukan localhost)
2. Cek `PANEL_URL` di lisensi config — harus URL panel yang aktif
3. Trigger sync manual:
   ```bash
   docker exec -it laravel_app php artisan schedule:run
   ```

### Queue worker tidak berjalan

Cek di POS App → **Pengaturan → Lisensi** → field `queue_running`:
- `true` → worker aktif
- `false/null` → worker mati, restart container

### Reset password admin POS App

Via panel: **Tenants → Show → Reset Admin Password**
Password sementara tampil selama 30 menit, lalu hilang otomatis.

---

## Bagian 5: Variabel Penting yang Tidak Boleh Diubah

| Variabel | Alasan |
|---|---|
| `HASH_ID_SALT` | Mengubah ini membuat semua ID lama tidak bisa di-decode → data rusak |
| `APP_KEY` | Mengubah ini invalidate semua session, cookie, dan data terenkripsi |
| `DB_DATABASE` / `DB_USERNAME` | Mengubah ini memutus koneksi ke database yang sudah ada |

---

## Bagian 6: Update Kode Rutin

### POS App

```bash
# 1. Edit di pos-app/
# 2. Commit ke pos-app repo
git add -A && git commit -m "feat: ..." && git push   # di folder pos-app

# 3. Sync ke production folder
cd pos-app && ./sync-to-production.sh --files   # jika hanya sync file
# atau
./sync-to-production.sh                          # full sync + build

# 4. Push ke pos-app-production repo
cd pos-app-production && git add -A && git commit -m "sync" && git push

# 5. Coolify auto-deploy
```

### Panel

```bash
# 1. Edit di pos-app-panel/
# 2. Build frontend
cd pos-app-panel && npm run build

# 3. Commit dan push
git add -A && git commit -m "feat: ..." && git push

# 4. Coolify auto-deploy
```
