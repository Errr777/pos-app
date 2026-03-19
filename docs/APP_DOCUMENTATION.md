# Dokumentasi Teknis Aplikasi POS

## Ringkasan

Aplikasi POS (Point of Sale) berbasis web untuk manajemen penjualan, inventaris, dan laporan toko. Dibangun dengan **Laravel 12 + Inertia.js + React 19 + TypeScript + Tailwind CSS v4**.

---

## Tech Stack

| Layer | Teknologi |
|---|---|
| Backend | PHP 8.2+, Laravel 12, Inertia.js v2 |
| Frontend | React 19, TypeScript, Tailwind CSS v4, Radix UI / shadcn-ui |
| Database | SQLite (`database/database.sqlite`) |
| Build Tool | Vite 6 + `laravel-vite-plugin` |
| Charts | Recharts |
| Icons | Lucide React |

---

## Struktur Direktori

```
pos-app/
├── app/
│   ├── Http/
│   │   ├── Controllers/        # Resource controllers
│   │   └── Middleware/         # HandleInertiaRequests (shared props)
│   ├── Models/                 # Eloquent models
│   ├── Helpers/
│   │   └── InvoiceNumber.php     # Race-safe invoice number generator
│   ├── Support/
│   │   └── BackupEncryption.php  # AES-256-CBC encrypt/decrypt helper
│   └── Console/Commands/
│       └── BackupDatabase.php  # Artisan backup command
├── database/
│   ├── migrations/             # Database schema
│   └── seeders/                # Data awal (users, items, dll)
├── resources/
│   ├── css/app.css             # Tailwind + CSS token tema
│   └── js/
│       ├── components/
│       │   ├── ui/             # shadcn-ui primitives (Button, Dialog, Input, dll)
│       │   ├── notification-bell.tsx  # Bell icon + popover (low stock + pending PO)
│       │   ├── app-sidebar.tsx
│       │   └── app-sidebar-header.tsx
│       ├── hooks/              # React hooks (useAppearance, dll)
│       ├── layouts/            # AppLayout wrapper
│       ├── pages/              # Inertia page components
│       │   ├── dashboard.tsx
│       │   ├── Items/
│       │   ├── category/
│       │   ├── inventory/      # transfers, adjustments, opname
│       │   ├── warehouse/
│       │   ├── supplier/
│       │   ├── customers/
│       │   ├── pos/
│       │   ├── purchase-orders/
│       │   ├── returns/
│       │   ├── report/         # 7 halaman laporan
│       │   ├── Users/
│       │   └── settings/       # backups.tsx, store.tsx
│       └── types/index.d.ts    # Shared TypeScript types
├── routes/
│   ├── web.php                 # Semua route utama
│   ├── auth.php                # Auth routes
│   └── settings.php            # Settings routes
└── docs/
    ├── APP_DOCUMENTATION.md    # File ini
    └── USER_GUIDE.md           # Panduan pengguna
```

---

## Modul & Routes

### Dashboard
| Method | URL | Deskripsi |
|---|---|---|
| GET | `/dashboard` | KPI cards (total item, transaksi, nilai stok, pending PO), grafik penjualan, alert stok minim |

### Items (Produk)
| Method | URL | Route Name | Deskripsi |
|---|---|---|---|
| GET | `/item` | `item.index` | Daftar semua produk (search, sort, filter kategori/tag) |
| GET | `/item/{item}` | `item.show` | Detail produk |
| GET | `/tambah_item` | `item.tambah` | Form tambah produk |
| POST | `/item` | `item.store` | Simpan produk baru |
| PUT | `/item/{item}` | `item.update` | Update produk |
| DELETE | `/item/{item}` | `item.destroy` | Hapus produk |
| PATCH | `/item/{item}/tags` | `item.sync_tags` | Sync tag produk |
| GET | `/item/print-labels` | `item.print_labels` | Cetak label QR produk |
| GET | `/stock_alerts` | `item.low_stock` | Daftar produk stok minim |

### Item Variants
| Method | URL | Route Name | Deskripsi |
|---|---|---|---|
| GET | `/item/{item}/variants` | `item.variants.index` | Daftar varian produk |
| POST | `/item/{item}/variants` | `item.variants.store` | Tambah varian |
| PUT | `/item/{item}/variants/{variant}` | `item.variants.update` | Update varian |
| DELETE | `/item/{item}/variants/{variant}` | `item.variants.destroy` | Hapus varian |

### Kategori
| Method | URL | Route Name | Deskripsi |
|---|---|---|---|
| GET | `/category` | `kategori.index` | Daftar kategori |
| GET | `/category/{kategori}` | `kategori.show` | Detail kategori |
| POST | `/category` | `kategori.store` | Tambah kategori |
| PUT | `/category/{kategori}` | `kategori.update` | Update kategori |
| DELETE | `/category/{kategori}` | `kategori.destroy` | Hapus kategori |

### Tags Produk
| Method | URL | Route Name | Deskripsi |
|---|---|---|---|
| GET | `/tags` | `tags.index` | Daftar tag |
| POST | `/tags` | `tags.store` | Tambah tag |
| PUT | `/tags/{tag}` | `tags.update` | Update tag |
| DELETE | `/tags/{tag}` | `tags.destroy` | Hapus tag |

### Inventaris (Pergerakan Stok)
| Method | URL | Route Name | Deskripsi |
|---|---|---|---|
| GET | `/inventory` | `Stock_History` | Riwayat semua pergerakan stok |
| GET | `/inventory/stock_in` | `Stock_In` | Daftar stock masuk |
| GET | `/inventory/stock_out` | `Stock_Out` | Daftar stock keluar |
| GET | `/inventory/stock_log` | `Stock_Log` | Log audit stok |
| POST | `/inventory/stock` | `stock.store` | Catat pergerakan stok |
| PUT | `/inventory/stock/{transaction}` | `stock.update` | Update pergerakan |
| DELETE | `/inventory/stock/{transaction}` | `stock.destroy` | Hapus pergerakan |

### Transfer Stok
| Method | URL | Route Name | Deskripsi |
|---|---|---|---|
| GET | `/inventory/transfers` | `stock_transfer.index` | Daftar transfer antar gudang |
| POST | `/inventory/transfers` | `stock_transfer.store` | Buat transfer baru |
| DELETE | `/inventory/transfers/{stockTransfer}` | `stock_transfer.destroy` | Batalkan transfer |

### Penyesuaian Stok
| Method | URL | Route Name | Deskripsi |
|---|---|---|---|
| GET | `/inventory/adjustments` | `stock_adjustment.index` | Daftar penyesuaian stok |
| POST | `/inventory/adjustments` | `stock_adjustment.store` | Buat penyesuaian baru |
| GET | `/inventory/adjustments/stock` | `stock_adjustment.warehouse_stock` | Stok per gudang (JSON) |

### Stock Opname
| Method | URL | Route Name | Deskripsi |
|---|---|---|---|
| GET | `/inventory/opname` | `opname.index` | Daftar sesi opname |
| POST | `/inventory/opname` | `opname.store` | Buat sesi opname baru |
| GET | `/inventory/opname/{opname}` | `opname.show` | Detail opname |
| PUT | `/inventory/opname/{opname}/items` | `opname.update_items` | Update hitungan fisik |
| POST | `/inventory/opname/{opname}/submit` | `opname.submit` | Submit & terapkan selisih |
| DELETE | `/inventory/opname/{opname}` | `opname.destroy` | Hapus sesi opname |

### Gudang
| Method | URL | Route Name | Deskripsi |
|---|---|---|---|
| GET | `/warehouses` | `warehouses.index` | Daftar gudang |
| GET | `/warehouses/{warehouse}` | `warehouses.show` | Detail gudang + stok |
| POST | `/warehouses` | `warehouses.store` | Tambah gudang |
| PUT | `/warehouses/{warehouse}` | `warehouses.update` | Update gudang |
| DELETE | `/warehouses/{warehouse}` | `warehouses.destroy` | Hapus gudang |
| PUT | `/warehouses/{warehouse}/items/{item}/min` | `warehouses.item_min` | Set stok minimum item |

### Supplier
| Method | URL | Route Name | Deskripsi |
|---|---|---|---|
| GET | `/suppliers` | `suppliers.index` | Daftar supplier |
| POST | `/suppliers` | `suppliers.store` | Tambah supplier |
| PUT | `/suppliers/{supplier}` | `suppliers.update` | Update supplier |
| DELETE | `/suppliers/{supplier}` | `suppliers.destroy` | Hapus supplier |

### Pelanggan (Customer)
| Method | URL | Route Name | Deskripsi |
|---|---|---|---|
| GET | `/customers` | `customers.index` | Daftar pelanggan |
| POST | `/customers` | `customers.store` | Tambah pelanggan |
| PUT | `/customers/{customer}` | `customers.update` | Update pelanggan |
| DELETE | `/customers/{customer}` | `customers.destroy` | Hapus pelanggan |

### Promosi & Diskon
| Method | URL | Route Name | Deskripsi |
|---|---|---|---|
| GET | `/promotions` | `promotions.index` | Daftar promosi / kode diskon |
| POST | `/promotions` | `promotions.store` | Tambah promosi |
| PUT | `/promotions/{promotion}` | `promotions.update` | Update promosi |
| DELETE | `/promotions/{promotion}` | `promotions.destroy` | Hapus promosi |
| GET | `/promotions/active` | `promotions.active` | Promosi aktif (JSON, untuk POS) |

### POS / Kasir
| Method | URL | Route Name | Deskripsi |
|---|---|---|---|
| GET | `/pos/terminal` | `pos.terminal` | Terminal kasir (layar transaksi) |
| GET | `/pos/pending` | `pos.pending` | Antrian transaksi pending |
| GET | `/pos/promo/validate` | `pos.promo.validate` | Validasi kode promo (JSON) |
| GET | `/pos` | `pos.index` | Riwayat transaksi penjualan |
| POST | `/pos` | `pos.store` | Proses transaksi penjualan |
| GET | `/pos/{saleHeader}` | `pos.show` | Detail transaksi (+ tombol cetak) |
| POST | `/pos/{saleHeader}/void` | `pos.void` | Void/batalkan transaksi |
| GET | `/pos/{saleHeader}/print` | `pos.print` | Halaman struk termal (popup print) |
| GET | `/pos/{saleHeader}/invoice` | `pos.invoice` | Invoice A4 (popup print, generate/reuse INV-number) |

### POS / Cicilan (Kredit)
| Method | URL | Route Name | Deskripsi |
|---|---|---|---|
| GET | `/pos/installments` | `pos.installments` | Halaman rencana cicilan aktif |
| GET | `/pos/installments/{plan}/invoice` | `installments.invoice` | Invoice cicilan A4 (popup print) |

### Purchase Order
| Method | URL | Route Name | Deskripsi |
|---|---|---|---|
| GET | `/purchase-orders` | `po.index` | Daftar PO |
| POST | `/purchase-orders` | `po.store` | Buat PO baru |
| GET | `/purchase-orders/suggestions` | `po.suggestions` | Saran PO (item stok rendah) |
| POST | `/purchase-orders/suggestions/create` | `po.suggestions.create` | Buat PO dari saran |
| GET | `/purchase-orders/{purchaseOrder}` | `po.show` | Detail PO (+ tombol cetak) |
| POST | `/purchase-orders/{purchaseOrder}/status` | `po.status` | Update status PO |
| POST | `/purchase-orders/{purchaseOrder}/receive` | `po.receive` | Terima barang PO |
| DELETE | `/purchase-orders/{purchaseOrder}` | `po.destroy` | Hapus PO |
| GET | `/purchase-orders/{purchaseOrder}/invoice` | `po.invoice` | Invoice PO A4 (popup print) |

### Retur Barang
| Method | URL | Route Name | Deskripsi |
|---|---|---|---|
| GET | `/returns` | `returns.index` | Daftar retur |
| POST | `/returns` | `returns.store` | Buat retur baru |
| GET | `/returns/{returnHeader}` | `returns.show` | Detail retur (+ tombol cetak) |
| POST | `/returns/{returnHeader}/void` | `returns.void` | Void retur |

### Pengeluaran (Expenses)
| Method | URL | Route Name | Deskripsi |
|---|---|---|---|
| GET | `/expenses` | `expenses.index` | Daftar pengeluaran operasional |
| POST | `/expenses` | `expenses.store` | Catat pengeluaran baru |
| PUT | `/expenses/{expense}` | `expenses.update` | Update pengeluaran |
| DELETE | `/expenses/{expense}` | `expenses.destroy` | Hapus pengeluaran |

### Laporan
| Method | URL | Route Name | Export |
|---|---|---|---|
| GET | `/report/stock` | `Report_Stock` | Excel |
| GET | `/report/sales` | `Report_Sales` | Excel |
| GET | `/report/cashflow` | `Report_Cashflow` | Excel + **CSV** |
| GET | `/report/profit-loss` | `Report_ProfitLoss` | **CSV** |
| GET | `/report/abc` | `report.abc` | Excel + **CSV** |
| GET | `/report/peak-hours` | `report.peak_hours` | Excel + **CSV** |
| GET | `/report/branches` | `report.branches` | Excel + **CSV** |

> Excel export via Laravel backend route (`/export/excel`). CSV export via frontend `Blob` download (client-side, no server call needed).

### Audit Log
| Method | URL | Route Name | Deskripsi |
|---|---|---|---|
| GET | `/audit-log` | `audit.log` | Log semua aktivitas sistem |

### Pengaturan Toko
| Method | URL | Route Name | Deskripsi |
|---|---|---|---|
| GET | `/settings/store` | `settings.store` | Form pengaturan toko (nama, logo, dll) |
| POST | `/settings/store` | `settings.store.update` | Simpan pengaturan |

### Backup Database
| Method | URL | Route Name | Deskripsi |
|---|---|---|---|
| GET | `/settings/backups` | `backups.index` | Daftar file backup tersimpan |
| POST | `/settings/backups/run` | `backups.run` | Jalankan backup sekarang (→ download) |
| GET | `/settings/backups/download/{filename}` | `backups.download` | Download file backup |
| POST | `/settings/backups/restore/{filename}` | `backups.restore` | Restore dari file backup |
| POST | `/settings/backups/upload` | `backups.upload` | Upload & restore file `.sql.enc` |
| DELETE | `/settings/backups/{filename}` | `backups.destroy` | Hapus satu file backup |

### Manajemen Pengguna
| Method | URL | Route Name | Deskripsi |
|---|---|---|---|
| GET | `/users` | `users.index` | Daftar pengguna |
| POST | `/users` | `users.store` | Tambah pengguna |
| PUT | `/users/{user}` | `users.update` | Update pengguna |
| DELETE | `/users/{user}` | `users.destroy` | Hapus pengguna |
| POST | `/users/{user}/reset-password` | `users.reset_password` | Reset password |
| POST | `/users/{user}/permissions` | `users.permissions` | Override permission per user |
| POST | `/users/{user}/warehouses` | `users.warehouses` | Set akses gudang per user |

### Manajemen Role
| Method | URL | Route Name | Deskripsi |
|---|---|---|---|
| GET | `/users/roles` | `users.roles` | Daftar role |
| POST | `/users/roles` | `roles.store` | Tambah role |
| PUT | `/users/roles/{role}` | `roles.update` | Update role |
| DELETE | `/users/roles/{role}` | `roles.destroy` | Hapus role |
| POST | `/users/roles/{role}/permissions` | `roles.permissions` | Set permission role |

---

## Data Flow

### 1. Request Lifecycle (Inertia)

```
Browser → routes/web.php → Controller → Inertia::render('PageName', $props)
       ↓
HandleInertiaRequests::share()   ← dipanggil setiap request
  - auth.user
  - permissions (per module)
  - notifications { lowStockCount, pendingPoCount }
       ↓
React Page Component (resources/js/pages/*)
  - usePage().props untuk akses semua props
  - router dari @inertiajs/react untuk navigasi
  - useForm dari @inertiajs/react untuk form submit
```

### 2. Dual Response Pattern

Semua controller mendukung JSON dan Inertia dalam satu method:
```php
if ($request->wantsJson()) {
    return response()->json($data);
}
return Inertia::render('PageName', $data);
```

Frontend fetch request harus menyertakan `Accept: application/json` untuk mendapat JSON response.

### 3. POS Transaction Flow

```
/pos/terminal (kasir input)
    ↓ pilih item → cek promo (/pos/promo/validate)
    ↓ POST /pos (PosController::store)
        → buat SaleHeader + SaleItems
        → kurangi stok WarehouseItem
        → buat Transaction record (type: sale)
    ↓ /pos/{id} (receipt / detail)

Untuk kredit (cicilan):
    ↓ payment_method = credit → buat InstallmentPlan + InstallmentPayments
    ↓ /pos/installments → lihat semua cicilan aktif
```

### 4. Purchase Order Flow

```
/purchase-orders/suggestions  ← saran otomatis dari stok minim
    ↓ buat PO manual / dari saran
    draft → ordered → partial → received
                              ↓
                    PosController::receive
                        → tambah stok WarehouseItem
                        → buat Transaction record (type: stock_in)
```

### 5. Stock Movement Flow

```
Semua pergerakan stok → transactions table
  type: stock_in      ← PO receive, manual stock_in
  type: stock_out     ← manual stock_out
  type: sale          ← transaksi POS
  type: adjustment    ← stock adjustment
  type: transfer_in   ← terima dari transfer
  type: transfer_out  ← kirim ke gudang lain
  type: purchase_return ← retur ke supplier
```

### 6. Notification Bell Flow

```
Setiap request Inertia
    ↓ HandleInertiaRequests::share()
        → Item::where stok <= stok_minimal (lowStockCount)
        → PurchaseOrder::whereIn status [draft,ordered,partial] (pendingPoCount)
    ↓ props.notifications tersedia di semua halaman
    ↓ NotificationBell component (app-sidebar-header.tsx)
        → tampilkan badge total
        → popover list item stok rendah + PO pending
```

### 7. Backup Flow

```
Artisan: BackupDatabase command
    → dump DB ke file .sql (temp)
    → BackupEncryption::encryptFile() → .sql.enc (AES-256-CBC, IV prepended)
    → hapus .sql temp
    → simpan di Storage::disk('local') → storage/app/private/backups/

Restore flow:
    → BackupEncryption::decryptToTemp() → .sql temp
    → mysql CLI / sqlite copy
    → hapus .sql temp

FIFO prune: otomatis hapus backup terlama jika > 7 file
```

### 8. Report CSV Export Flow

```
Client-side (tidak perlu server call):
    → ambil data dari Inertia props (sudah di-load saat halaman dibuka)
    → build string CSV (semicolon-delimited)
    → new Blob(['...'], { type: 'text/csv' })
    → URL.createObjectURL(blob)
    → klik <a download="..."> programatik
    → URL.revokeObjectURL()
```

---

## Models & Database

### Item
- **Table:** `items`
- **Fields:** `nama`, `deskripsi`, `kode_item` (QR), `kategori`, `id_kategori` (FK), `harga_beli` (int), `harga_jual` (int), `stok`, `stok_minimal`, `image`
- **Relations:** `kategoriRelation()` → Kategori, `variants()` → ItemVariant, `tags()` → Tag (many-to-many)

### ItemVariant
- **Table:** `item_variants`
- **Fields:** `item_id`, `name`, `sku`, `harga_beli`, `harga_jual`, `stok`, `image`

### Tag
- **Table:** `tags`, pivot: `item_tag`
- **Fields:** `name`, `color`

### Warehouse & WarehouseItem
- **Tables:** `warehouses`, `warehouse_items`
- **Fields Warehouse:** `name`, `code`, `address`, `city`, `phone`, `is_active`, `is_default`
- **Fields WarehouseItem:** `warehouse_id`, `item_id`, `stok`, `stok_minimal`

### Transaction (Pergerakan Stok)
- **Table:** `transactions`
- **Types:** `stock_in`, `stock_out`, `adjustment`, `transfer_in`, `transfer_out`, `sale`, `purchase_return`
- **Fields:** `item_id`, `warehouse_id`, `type`, `amount`, `party`, `occurred_at`, `status`, `note`
- **Audit:** `TransactionAudit` mencatat setiap perubahan

### SaleHeader & SaleItem
- **Tables:** `sale_headers`, `sale_items`
- **Fields SaleHeader:** `sale_number`, `warehouse_id`, `customer_id`, `cashier_id`, `occurred_at`, `subtotal`, `discount_amount`, `tax_amount`, `grand_total`, `payment_method`, `payment_amount`, `change_amount`, `status`, `note`, `invoice_number` (VARCHAR 30, unique, nullable), `invoice_issued_at` (timestamp, nullable)
- **Fields SaleItem:** `sale_header_id`, `item_id`, `item_name_snapshot`, `item_code_snapshot`, `unit_price`, `quantity`, `discount_amount`, `line_total`

### PurchaseOrder & PurchaseOrderItem
- **Tables:** `purchase_orders`, `purchase_order_items`
- **Status lifecycle:** `draft` → `ordered` → `partial` → `received` / `cancelled`
- **Fields PurchaseOrder (tambahan):** `invoice_number` (VARCHAR 30, unique, nullable), `invoice_issued_at` (timestamp, nullable)

### InstallmentPlan & InstallmentPayment
- **Tables:** `installment_plans`, `installment_payments`
- **Fields InstallmentPlan:** `sale_header_id`, `customer_id`, `total_amount`, `paid_amount`, `status`, `note`, `invoice_number`, `invoice_issued_at`
- **Status:** `pending` → `active` → `completed` / `overdue`
- **Fields InstallmentPayment:** `installment_plan_id`, `due_date`, `amount_due`, `interest_amount`, `late_fee_applied`, `status`, `paid_at`
- **Created automatically** when POS sale is processed with `payment_method = credit`

### InvoiceSequence
- **Table:** `invoice_sequences`
- **Fields:** `date DATE UNIQUE`, `sequence UNSIGNED INT`
- **Purpose:** Atomic counter for INV-YYYYMMDD-XXXX number generation. Used by `App\Helpers\InvoiceNumber::generate()`.

### ReturnHeader & ReturnItem
- **Tables:** `return_headers`, `return_items`
- **Types:** `customer_return` (stok masuk kembali), `supplier_return` (stok keluar ke supplier)
- **Conditions:** `good`, `damaged`, `defective`
- **Status:** `completed`, `void`

### Promotion
- **Table:** `promotions`
- **Types:** kode diskon, persentase, nominal tetap
- **Digunakan di:** POS terminal (validasi saat checkout)

### StockOpname
- **Tables:** `stock_opnames`, `stock_opname_items`
- **Flow:** buat sesi → input hitungan fisik → submit → selisih otomatis dibuat sebagai adjustment

### Expense
- **Table:** `expenses`
- **Fields:** `date`, `category`, `amount`, `description`, `warehouse_id`
- **Pengaruh:** diperhitungkan dalam laporan cashflow

### AppSetting
- **Table:** `app_settings`
- **Fields:** `store_name`, `address`, `phone`, `logo`, dll.

### User, Role, Permission
- **Tables:** `users`, `roles`, `role_permissions`, `user_permissions`
- **Roles default:** `admin`, `staff`, `kasir`
- **Modules:** `dashboard`, `items`, `inventory`, `warehouses`, `reports`, `suppliers`, `customers`, `pos`, `purchase_orders`, `returns`, `users`

---

## Sistem Permission

### Hierarki 2 Level
1. **RolePermission** — Permission default per role
2. **UserPermission** — Override per user (prioritas lebih tinggi)

Admin selalu bypass semua permission check.

### Matrix Default Permission

| Modul | Admin | Staff | Kasir |
|---|---|---|---|
| Dashboard | V | V | V |
| Items & Kategori | V/W/D | V/W | V |
| Inventory | V/W/D | V/W | — |
| Gudang | V/W/D | V/W | V |
| Laporan | V/W/D | V | V |
| Supplier | V/W/D | V/W | V |
| Pelanggan | V/W/D | V/W | V/W |
| POS/Kasir | V/W/D | V/W | V/W |
| Purchase Order | V/W/D | V/W | V |
| Retur | V/W/D | V/W | V/W |
| Manajemen User | V/W/D | — | — |

**V** = can_view, **W** = can_write, **D** = can_delete

### Pengecekan Backend
```php
$user->hasPermission('items', 'can_write'); // true/false
```

### Pengecekan Frontend
```tsx
const { permissions } = usePage<SharedData>().props;
if (permissions.items.can_write) { /* tampilkan tombol */ }
```

---

## Aturan Penting

### Nilai Moneter
Semua harga dan total disimpan sebagai **integer** (tidak ada desimal). Contoh: Rp 15.000 disimpan sebagai `15000`. Format hanya untuk tampilan.

### Naming Convention (DB ↔ Frontend)
| DB / PHP field | Frontend key |
|---|---|
| `nama` | `name` |
| `deskripsi` | `description` |
| `kode_item` | `qrcode` |
| `stok` | `stock` |
| `stok_minimal` | `stock_min` / `minimumStock` |
| `kategori` | `category` |
| `harga_beli` | `purchase_price` |
| `harga_jual` | `selling_price` |

### Backup Encryption
File backup dienkripsi dengan **AES-256-CBC**. IV 16 byte ditulis di awal file, diikuti ciphertext. Key diambil dari `APP_KEY` (base64 decoded). Extension file: `.sql.enc`.

### Storage Path
`Storage::disk('local')` root = `storage/app/private/` (Laravel 11+). Selalu gunakan `Storage::disk('local')->path($relativePath)` — jangan `storage_path("app/...")`.

### Sorting Pattern
Controller whitelist kolom sort untuk mencegah SQL injection. Frontend kirim `sort_by` dan `sort_dir` query param; controller kembalikan di `filters` agar UI bisa inisialisasi state.

### CSV Export (Client-side)
Report CSV tidak perlu route backend. Data sudah ada di Inertia props. Build string CSV di browser, download via Blob API.

---

## Commands

```bash
# Development
composer run dev          # Jalankan semua: Laravel, queue, logs, Vite

# Build
npm run build             # Build production
npm run build:ssr         # SSR build

# Testing
composer run test         # PHPUnit

# Code Quality
npm run lint              # ESLint (auto-fix)
npm run format            # Prettier (auto-fix resources/)
npm run types             # TypeScript type check
vendor/bin/pint           # PHP Pint

# Database
php artisan migrate
php artisan migrate:fresh --seed
php artisan db:seed --class=TransactionSeeder

# Backup (manual)
php artisan db:backup
```

---

## Tema & UI

- **Primary color:** Indigo 600 (light) / Indigo 400 (dark)
- **Accent:** Gold / Amber
- **Sidebar:** Selalu dark slate (light & dark mode)
- **Theme toggle:** Di header kanan atas (light / dark / system)
- **Notification bell:** Di header, menampilkan jumlah stok minim + PO pending
- **Status badge semantic:**
  - Hijau emerald = completed / active / success
  - Amber = partial / pending / warning
  - Rose = void / cancelled / error
  - Indigo = draft / info
  - Slate = unknown / neutral
- **Print support:** struk termal dan invoice A4 masing-masing membuka popup window terpisah (tanpa chrome browser). Auto-trigger window.print() setelah 400ms. Tersedia di: detail POS (struk + invoice), rencana cicilan pelanggan (invoice), detail PO (invoice), detail Retur (struk).
