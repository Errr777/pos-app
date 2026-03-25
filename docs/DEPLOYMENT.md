# Deployment Guide — POS App Production

## Overview

POS App (Laravel 12 + Inertia.js + React 19) dikemas dalam Docker untuk production deployment.
Panduan ini mencakup dua opsi: **Coolify** (rekomendasi) dan **Manual VPS**.

---

## File Structure

```
pos-app-production/
├── Dockerfile.prod              # Multi-stage production build (node → composer → php-fpm)
├── docker-compose.prod.yml      # Deploy manual ke VPS
├── docker-compose.coolify.yml   # Deploy via Coolify
├── .env.production              # Template environment variables
├── .dockerignore
└── docker/
    ├── nginx/default.conf       # Nginx config (Laravel)
    ├── supervisord.prod.conf    # Supervisord: php-fpm + nginx + queue-worker
    └── start.prod.sh            # Entrypoint: migrate, cache, start supervisord
```

---

## Opsi A: Deploy via Coolify (Rekomendasi)

Coolify adalah self-hosted PaaS yang menangani SSL, domain routing (Traefik), dan auto-deploy dari GitHub secara otomatis.

### Tahap 1: Install Coolify di VPS

```bash
# SSH ke VPS Niagahoster
ssh root@ip-vps

# Install Coolify
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

Akses panel Coolify di `http://ip-vps:8000` → buat akun admin.

### Tahap 2: Push kode ke GitHub

```bash
cd pos-app-production

# Buat repo baru di GitHub (github.com/new) → pos-app-production (bisa private)
git remote remove origin
git remote add origin https://github.com/USERNAME/pos-app-production.git
git push -u origin main
```

### Tahap 3: Konfigurasi di Panel Coolify

1. **Settings → Sources → GitHub** → Install GitHub App → pilih repo `pos-app-production`
2. **Projects → New Project** → beri nama "POS App"
3. **New Resource → Docker Compose** → pilih repo dari GitHub
4. **Compose File Path**: `docker-compose.coolify.yml`
5. **Port**: `80`
6. **Domain**: masukkan domain (misal: `pos.namadomain.com`)
7. Centang **SSL/HTTPS** → Coolify generate Let's Encrypt otomatis

### Tahap 4: Set Environment Variables di Coolify UI

```
APP_KEY=base64:xxxx              # generate: php artisan key:generate --show
APP_URL=https://pos.namadomain.com
DB_DATABASE=pos_db
DB_USERNAME=pos_user
DB_PASSWORD=password_aman_123
DB_ROOT_PASSWORD=root_password_aman_456
HASH_ID_SALT=your-random-32-char-string   # Jangan pernah diubah setelah deploy pertama
```

### Tahap 5: Deploy

Klik **Deploy** → Coolify build image, jalankan container, setup SSL otomatis.

### Tahap 6: Seed Data (pertama kali saja)

```bash
# Via Coolify terminal (Resources → app → Terminal)
php artisan db:seed

# Atau via SSH ke VPS
docker exec -it <container-id> php artisan db:seed
```

### Auto-deploy (opsional)

> Resource → Settings → Webhook → aktifkan auto-deploy on push

Workflow: edit di `pos-app` → `sync-from-main.sh` → `git push` di `pos-app-production` → Coolify otomatis rebuild.

---

## Opsi B: Deploy Manual ke VPS

### Tahap 1: Upload kode ke VPS

```bash
# Dari Mac
rsync -avz --exclude='node_modules/' --exclude='vendor/' --exclude='.env' \
  /Users/errr/Developer/Project/my/pos-app-production/ \
  root@ip-vps:/var/www/pos-app/
```

### Tahap 2: Setup `.env` di VPS

```bash
cd /var/www/pos-app
cp .env.production .env
nano .env   # isi APP_URL, DB_PASSWORD, APP_KEY, HASH_ID_SALT
```

Variabel wajib yang harus diisi:
```
APP_KEY=base64:xxxx
APP_URL=https://your-domain.com
DB_PASSWORD=password_aman
HASH_ID_SALT=your-random-32-char-string   # Jangan pernah diubah setelah deploy pertama
```

Generate APP_KEY (jalankan di Mac dulu):
```bash
php artisan key:generate --show
# Paste hasilnya ke .env di VPS
```

### Tahap 3: Build dan jalankan

```bash
cd /var/www/pos-app
docker compose -f docker-compose.prod.yml up -d --build
```

### Tahap 4: Seed data (pertama kali saja)

```bash
docker compose -f docker-compose.prod.yml exec app php artisan db:seed
```

### Verifikasi

```bash
curl http://your-domain.com/up   # → {"status":"ok"}
docker compose -f docker-compose.prod.yml logs -f app
```

---

## Workflow Update Kode

```bash
# 1. Edit di pos-app (main project)
# 2. Sync ke production folder
cd /Users/errr/Developer/Project/my/pos-app-production
./sync-from-main.sh

# 3. Commit dan push
git add -A
git commit -m "sync: update from main"
git push

# 4. Jika pakai Coolify: auto-deploy via webhook
# Jika manual: rebuild di VPS
docker compose -f docker-compose.prod.yml up -d --build
```

---

## Perbandingan Coolify vs Manual

| Fitur | Manual VPS | Coolify |
|---|---|---|
| SSL/HTTPS | Setup manual (certbot) | Otomatis |
| Domain routing | Manual nginx | Otomatis Traefik |
| Auto-deploy | Tidak | Ya (via webhook) |
| Monitoring | Manual | Dashboard built-in |
| Rollback | Manual | 1 klik |
| Repo | Bisa private | Bisa private |

---

## Credentials Default (setelah db:seed)

| User | Email | Password | Role |
|---|---|---|---|
| Admin | admin@admin.com | 12345678 | admin |
| Staff | staff@pos.com | 12345678 | staff |
| Kasir 1 | kasir1@pos.com | 12345678 | kasir |
| Kasir 2 | kasir2@pos.com | 12345678 | kasir |

> **Ganti password setelah login pertama kali.**
