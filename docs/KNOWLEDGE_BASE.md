# Knowledge Base — POS App

Referensi teknis untuk developer yang bekerja di codebase ini.

---

## Arsitektur Singkat

Aplikasi ini menggunakan **Laravel 12 + Inertia.js v2 + React 19 + TypeScript**. Tidak ada API REST terpisah — semua komunikasi melalui Inertia (full-page renders + form submissions). JSON response tersedia di controller yang sama via `wantsJson()` untuk kebutuhan AJAX ringan.

**Request lifecycle:**
```
Browser → routes/web.php → Controller → Inertia::render('PageName', $props)
HandleInertiaRequests::share() dipanggil setiap request → inject shared props ke semua halaman
```

**Shared props (tersedia di semua halaman via `usePage().props`):**
- `auth.user` — user yang login (id sudah di-encode dengan `hid()`)
- `permissions` — permission matrix per modul
- `notifications` — `lowStockCount`, `pendingPoCount`

**Monetary values:** semua harga dan total disimpan sebagai **integer** (Rp 15.000 = `15000`). Jangan pernah simpan float. Format hanya untuk tampilan menggunakan `formatRp()` dari `resources/js/lib/formats.ts`.

**Permission system:** dua level — `RolePermission` (default per role) dan `UserPermission` (override per user). Admin bypass semua check. Backend: `$user->hasPermission($module, 'can_write')`. Frontend: `usePage().props.permissions[module].can_write`.

---

## Pola Desain Penting

### 1. Dual Response Pattern

Semua controller mendukung JSON dan Inertia dalam satu method:

```php
if ($request->wantsJson()) {
    return response()->json(['id' => hid($model->id), ...]);
}
return Inertia::render('PageName', ['id' => hid($model->id), ...]);
```

**Penting:** `hid()` / `dhid()` harus diterapkan di **kedua branch** — jangan encode hanya di branch Inertia.

### 2. Sorting Pattern

Controller memakai whitelist kolom sort untuk mencegah SQL injection:

```php
$allowed = ['nama', 'harga_jual', 'stok'];
$sortBy  = in_array($request->sort_by, $allowed) ? $request->sort_by : 'nama';
$sortDir = $request->sort_dir === 'desc' ? 'desc' : 'asc';

// Kembalikan di props agar frontend bisa inisialisasi state:
'filters' => ['sort_by' => $sortBy, 'sort_dir' => $sortDir, ...]
```

Frontend menggunakan nilai dari `filters` (bukan raw query string) untuk `useState` awal.

### 3. Permission Check

Backend:
```php
if (!$request->user()->hasPermission('items', 'can_write')) {
    abort(403);
}
```

Frontend:
```tsx
const { permissions } = usePage<SharedData>().props;
{permissions.items.can_write && <Button>Tambah</Button>}
```

### 4. Monetary Values

```php
// Benar: simpan sebagai integer
'harga_jual' => 15000,

// Salah: jangan pernah
'harga_jual' => 15000.00,
```

Frontend selalu gunakan `formatRp(value)` dari `@/lib/formats` untuk tampilan. Jangan format nilai sebelum dikirim ke backend.

### 5. Hash ID Pattern

```php
// Encode: kirim ke frontend
'id'          => hid($model->id),
'customer_id' => hid($sale->customer_id),

// Decode: terima dari form/request
$customerId = dhid($request->customer_id);  // returns int, 0 jika kosong/invalid
$item = Item::findOrFail($customerId);       // 404 otomatis jika dhid() return 0

// Route model binding: otomatis via HasHashId trait
// Tidak perlu decode manual di method parameter
public function show(Item $item) { ... }  // $item sudah resolved otomatis
```

`hid(null)` dan `hid(0)` keduanya return `''`. `dhid('')` dan `dhid(null)` keduanya return `0`.

### 6. Report Filter Pattern

```php
// Benar — ??: tidak skip empty string
$dateFrom = $request->get('date_from') ?: Carbon::now()->startOfMonth()->toDateString();

// Salah — get($key, $default) TIDAK pakai default jika value adalah ''
$dateFrom = $request->get('date_from', Carbon::now()->startOfMonth()->toDateString());
```

Selalu kembalikan nilai filter efektif di props:
```php
'filters' => ['date_from' => $dateFrom, 'date_to' => $dateTo]
```

Frontend: `useState(filters.date_from ?? '')` — tidak pernah kirim string kosong ke server.

---

## Model Relationships Penting

### Item → Kategori
`Item` menyimpan dua kolom untuk kategori: `kategori` (string nama, denormalized) dan `id_kategori` (FK ke `kategoris`). Saat update, **keduanya harus diisi secara bersamaan**. Relasi Eloquent: `$item->kategoriRelation()`.

### Transaction (ledger)
`transactions` adalah tabel ledger terpusat untuk semua pergerakan stok. Types: `stock_in`, `stock_out`, `adjustment`, `transfer_in`, `transfer_out`, `sale`, `purchase_return`. Setiap perubahan dicatat di `transaction_audits`.

### InstallmentPlan / InstallmentPayment
Dibuat otomatis saat POS transaksi dengan `payment_method = credit`. `InstallmentPlan` → many `InstallmentPayment`. Status plan: `pending` → `active` → `completed` / `overdue`. Pembayaran angsuran di `/pos/kredit` menggunakan dua modal: Modal Detail (read-only) dan Modal Bayar (form bayar per angsuran).

### SaleHeader → SaleItem
`SaleItem` menyimpan snapshot nama dan kode produk saat transaksi (`item_name_snapshot`, `item_code_snapshot`) serta `cost_price_snapshot` untuk kalkulasi laba rugi. Snapshot diperlukan agar data historis tidak berubah ketika produk diedit.

### Warehouse → WarehouseItem
Per-warehouse stock tracking. `WarehouseItem` memiliki `stok` dan `stok_minimal` sendiri (terpisah dari `items.stok_minimal`). `Warehouse` memiliki flag `is_default` dan `is_active`.

---

## Offline POS (IndexedDB)

File utama: `resources/js/lib/db.ts` menggunakan **Dexie v2** (bukan v3).

- Tabel: `cart` (item yang sedang di-checkout) dan `pendingTransactions` (transaksi yang belum ter-sync ke server).
- `pendingTransactions` di-queue saat koneksi terputus dan di-sync ulang ketika online.
- **Versi skema:** saat skema berubah (misal: kolom baru di tabel), increment version number di Dexie dan tambahkan upgrade handler. Jika tidak kompatibel (seperti saat Hash ID migration), Dexie akan clear tabel yang affected.

---

## Konvensi Penamaan

| DB / PHP field | Frontend key | Catatan |
|---|---|---|
| `nama` | `name` | — |
| `deskripsi` | `description` | — |
| `kode_item` | `qrcode` / `kode` | — |
| `stok` | `stock` | — |
| `stok_minimal` | `stock_min` / `minimumStock` | — |
| `kategori` | `category` | string nama, bukan ID |
| `id_kategori` | `category_id` | FK integer (dikirim sebagai hash string) |
| `harga_beli` | `purchase_price` | integer |
| `harga_jual` | `selling_price` | integer |
| `image_path` | `image_url` | setelah `Storage::url()` |
| `party` | `party` | supplier/penerima, unified field |

**Semua `id` field di frontend adalah `string`** (hash-encoded), bukan `number`. TypeScript types di `resources/js/types/index.d.ts` sudah mencerminkan ini.

---

## Gotchas & Jebakan Umum

- **Radix Dialog + Popover (DatePicker) tidak interaktif** — Dialog modal menyetel `pointer-events: none` pada body; `PopoverContent` yang portal ke body mewarisi ini. Fix: `pointer-events-auto` sudah ditambahkan ke `PopoverContent` base class (`components/ui/popover.tsx`). Jangan hapus class ini.
- **`hid(null)` return `''` bukan `null`** — frontend harus cek `!value` atau `value === ''`, bukan `value === null`.
- **`dhid('')` return `0`** — aman sebagai sentinel value untuk "tidak ada", tapi jangan asumsikan `0` berarti "global" atau "semua".
- **`outletPrices` (dan object key serupa) keyed by hash string** — jangan cast key dengan `Number(key)`, akan selalu `NaN`.
- **`HASH_ID_SALT` tidak boleh dirotasi setelah deploy** — semua URL yang sudah dibagikan dan pending offline transactions akan rusak.
- **PHPUnit test env tidak load `.env`** — `HASH_ID_SALT` harus ada di `phpunit.xml` sebagai `<env name="HASH_ID_SALT" value="test-salt"/>`.
- **Semua nullable FK dikirim sebagai `''` dari backend** (bukan `null`) ketika `hid(null)` dipanggil — handle ini di frontend dengan `value || undefined` jika komponen mengharapkan `undefined`.
- **`$promotion->appliesId === ''` artinya "berlaku untuk semua"** (bukan error) — ini adalah sentinel value yang valid.
- **`$request->get('key', $default)` tidak work untuk empty string** — selalu pakai `?: $default`. Contoh: `$request->get('date_from') ?: now()->startOfMonth()->format('Y-m-d')`. `get(key, default)` hanya pakai default ketika key *tidak ada*, bukan ketika nilainya `''`.
- **Eloquent `'date'` cast serializes to ISO 8601 via Inertia** — jika model punya `protected $casts = ['start_date' => 'date']`, maka `$model->start_date` via Inertia props akan menjadi `"2026-03-15T00:00:00.000000Z"`, bukan `"2026-03-15"`. Ini crash react-day-picker. **Selalu panggil `->format('Y-m-d')` eksplisit** sebelum mengirim date ke frontend: `'start_date' => $model->start_date?->format('Y-m-d')`.
- **`dhid()` return `0` pada input invalid/empty** — jangan langsung pakai hasil `dhid()` di WHERE clause. Selalu guard: `$wId = dhid($warehouseId); if ($wId > 0) { $query->where('warehouse_id', $wId); }`. Tanpa guard, `WHERE warehouse_id = 0` akan return no results.
- **`->when($cond, fn($q) => ...)` vs explicit `if`** — closure di `->when()` bisa berperilaku tidak terduga dengan null atau empty string values di Laravel request. Untuk filter conditions, lebih aman pakai explicit `if ($condition) { $query->where(...); }`.
- **MySQL/MariaDB date filter: jangan pakai `whereDate()`** — `whereDate('col', '>=', $date)` tidak reliable di production. Pakai pattern: `->where('col', '>=', $date . ' 00:00:00')->where('col', '<=', $date . ' 23:59:59')` (sama seperti `ReturnController` dan `ReportController`).
- **`kategori` dan `id_kategori` harus diisi bersamaan** saat insert/update Item — lewatkan salah satu dan data akan inkonsisten.
- **Invoice number adalah unik per tanggal** via `invoice_sequences` table dengan atomic counter — jangan generate manual, selalu gunakan `App\Helpers\InvoiceNumber::generate()`.

---

## Docker & Coolify Deployment

### Arsitektur Container
Single app container (PHP-FPM + Nginx di-manage Supervisord). Tidak ada MySQL container — DB adalah MariaDB eksternal yang berjalan di jaringan `coolify` di server yang sama.

```
[Coolify Proxy (HTTPS)] → [laravel_app container (HTTP:80)] → [MariaDB container di jaringan coolify]
```

### File-file Docker

| File | Fungsi |
|---|---|
| `Dockerfile` | Multi-stage: Node build frontend → PHP 8.3 runtime |
| `docker-compose.yml` | Single service + join `coolify` external network |
| `docker/start.sh` | Entrypoint: wait DB → migrate → cache → supervisord |
| `docker/supervisord.conf` | php-fpm + nginx + queue-worker |
| `docker/nginx/default.conf` | Nginx Laravel config |
| `.dockerignore` | Exclude `.env`, `node_modules/`, `.knowledge/`, dll |
| `sync-to-production.sh` | Script sync dev → production folder + docker build + up |

### Coolify Environment Variables (wajib semua)

```
APP_NAME=POS App
APP_ENV=production
APP_KEY=base64:...
APP_URL=http://<domain>          # HTTP — SSL di-terminate di Coolify proxy
APP_DEBUG=false

DB_CONNECTION=mysql
DB_HOST=<mariadb-container-hostname>   # dari: docker inspect <container> --format '{{json .NetworkSettings.Networks}}' | jq 'keys'
DB_PORT=3306
DB_DATABASE=default              # nama DB di Coolify MariaDB
DB_USERNAME=mariadb
DB_PASSWORD=...

SESSION_DRIVER=database
SESSION_SECURE_COOKIE=false      # container menerima HTTP bukan HTTPS
TRUSTED_PROXIES=*                # WAJIB — tanpa ini 419 CSRF error saat login

HASH_ID_SALT=...
```

### Gotchas Deployment Coolify

- **`.env` tidak ada di dalam container** — di-exclude oleh `.dockerignore`. Semua env vars HARUS di-set di Coolify dashboard. Jika env var tidak ada di Coolify dan tidak ada `.env`, Laravel pakai default config (bisa salah).
- **`TRUSTED_PROXIES=*` adalah kritis** — Coolify terminate SSL di proxy, container menerima HTTP. Tanpa `TRUSTED_PROXIES`, Laravel tidak tahu request aslinya HTTPS → generate URL HTTP → session cookie tidak match → **419 CSRF error di setiap form submission**.
- **`SESSION_SECURE_COOKIE=false`** — harus `false` karena container menerima HTTP dari proxy. Jika `true`, browser tidak kirim cookie di HTTP → session hilang → 419.
- **`APP_URL` pakai `http://`** — meskipun user akses via HTTPS, APP_URL di container side harus HTTP karena Coolify proxy yang handle SSL.
- **DB_HOST adalah container hostname MariaDB** — bukan `127.0.0.1`, bukan `localhost`. Cari dengan: `docker inspect <container_name> --format '{{json .NetworkSettings.Networks}}' | jq 'keys'` lalu ambil nama network-nya, lalu lihat container hostname di Coolify MariaDB service.
- **Jaringan `coolify` harus di-join** — app container harus ada di `networks: coolify (external: true)` agar bisa resolve hostname MariaDB.
- **Alpine sh tidak support brace expansion `{}`** — di `RUN` Dockerfile, `mkdir -p storage/framework/{cache,sessions,views}` tidak bekerja. Harus explicit: `mkdir -p storage/framework/cache && mkdir -p storage/framework/sessions ...`
- **Volume mount `./storage` menghapus subdirektori** — `storage/framework/cache`, `sessions`, `views` yang dibuat saat build hilang ketika volume di-mount. Selalu buat ulang di `start.sh` sebelum artisan commands.
- **`cal_days_in_month()` butuh PHP extension `calendar`** — extension ini tidak terinstall by default di Alpine. Tambah ke `docker-php-ext-install`.
- **Migrasi jalan otomatis di startup** — `start.sh` selalu jalankan `php artisan migrate --force`. Aman karena Laravel skip migrasi yang sudah diterapkan. Tidak perlu jalankan manual kecuali ada masalah.
- **Queue worker sudah berjalan** — `supervisord.conf` punya `[program:queue-worker]`. Tidak perlu `php artisan queue:work` manual.

### Deploy Workflow

```bash
# Di dev machine, dari folder pos-app:
./sync-to-production.sh

# Script ini akan:
# 1. rsync dev → /pos-app-production/ (exclude .env, node_modules, vendor, dll)
# 2. composer install --no-interaction di production folder
# 3. npm ci + npm run build
# 4. docker compose build (dari production folder)
# 5. docker compose up -d
# 6. tail logs 30 baris terakhir
```

Untuk sync file saja tanpa build:
```bash
./sync-to-production.sh --files
```

Preview tanpa perubahan:
```bash
./sync-to-production.sh --dry-run
```

---

## Perubahan Signifikan Terakhir

| Tanggal | Perubahan | File Utama |
|---|---|---|
| 2026-03-28 | Setup Docker + Coolify deployment — multi-stage Dockerfile, `start.sh` entrypoint, `.dockerignore`, queue worker, fix CSRF 419 via `TRUSTED_PROXIES=*` | `Dockerfile`, `docker/start.sh`, `docker/supervisord.conf`, `docker-compose.yml`, `.dockerignore` |
| 2026-03-27 | Fix: `PromotionController` kirim `format('Y-m-d')` eksplisit — cegah RangeError di react-day-picker saat edit promo | `app/Http/Controllers/PromotionController.php` |
| 2026-03-27 | Fix: `ExpenseController` date/warehouse/category filter — pakai MariaDB pattern + dhid guard + explicit if | `app/Http/Controllers/ExpenseController.php` |
| 2026-03-27 | Fix: Beban pagination — windowed max 10 buttons + Prev/Next + go-to-page | `resources/js/pages/expenses/Index.tsx` |
| 2026-03-25 | Fix: `pointer-events-auto` di `PopoverContent` — date picker bisa diklik di dalam Radix Dialog | `resources/js/components/ui/popover.tsx` |
| 2026-03-25 | Fix: semua TypeScript interface ID diubah ke `string` di semua halaman frontend | semua halaman inventory, items, POS, purchase-orders |
| 2026-03-25 | Hash ID obfuscation — semua ID integer di-encode sebelum ke frontend | `app/Helpers/HashId.php`, `app/Traits/HasHashId.php`, semua controllers, semua frontend pages |
| 2026-03-23 | Cost price snapshot pada SaleItem | `database/migrations/*add_cost_price_snapshot*`, `app/Models/SaleItem.php` |
| ~2026-03-20 | Surat Jalan (Delivery Orders) — pengiriman antar outlet dengan status tracking | `DeliveryOrderController.php`, `app/Models/DeliveryOrder.php`, halaman inventory/Delivery* |
| ~2026-03-20 | Harga item per gudang (WarehouseItemPrice) | `WarehouseItemPriceController.php`, `app/Models/WarehouseItemPrice.php`, `warehouse/Prices.tsx` |
| ~2026-03-20 | Offline POS dengan IndexedDB (Dexie) | `resources/js/lib/db.ts`, `hooks/use-offline-cart.ts` |
| ~2026-03-19 | Sistem kredit/cicilan pelanggan | `app/Models/InstallmentPlan.php`, `InstallmentPayment.php`, `InstallmentController.php` |

---

## File Kunci yang Sering Disentuh

| File | Kapan disentuh |
|---|---|
| `app/Http/Middleware/HandleInertiaRequests.php` | Tambah shared props baru ke semua halaman |
| `resources/js/types/index.d.ts` | Update shared TypeScript types |
| `routes/web.php` | Tambah route baru |
| `resources/js/lib/db.ts` | Perubahan schema IndexedDB offline POS |
| `config/app.php` | Tambah config key baru (misal: `hash_id_salt`) |
| `phpunit.xml` | Tambah env var baru untuk test environment |
| `app/Helpers/HashId.php` | Ubah panjang minimum hash atau salt logic |
| `app/Traits/HasHashId.php` | Ubah behaviour route model binding |
| `resources/js/lib/formats.ts` | Tambah format utility baru (currency, label, dll) |
