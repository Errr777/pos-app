# Dokumentasi Teknis Aplikasi POS

## Ringkasan

Aplikasi POS (Point of Sale) berbasis web untuk manajemen penjualan dan inventaris toko. Dibangun dengan **Laravel 12 + Inertia.js + React 19 + TypeScript + Tailwind CSS v4**.

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
│   ├── Http/Controllers/       # Resource controllers
│   ├── Models/                 # Eloquent models
│   └── ...
├── database/
│   ├── migrations/             # Database schema
│   └── seeders/                # Data awal (users, items, dll)
├── resources/
│   ├── css/app.css             # Tailwind + CSS token tema
│   └── js/
│       ├── components/         # Shared UI components
│       │   └── ui/             # shadcn-ui primitives
│       ├── hooks/              # React hooks (useAppearance, dll)
│       ├── layouts/            # Layout wrappers (AppLayout)
│       ├── pages/              # Inertia page components
│       │   ├── dashboard.tsx
│       │   ├── Items/
│       │   ├── category/
│       │   ├── inventory/
│       │   ├── warehouse/
│       │   ├── supplier/
│       │   ├── customers/
│       │   ├── pos/
│       │   ├── purchase-orders/
│       │   ├── returns/
│       │   ├── report/
│       │   └── Users/
│       └── types/index.d.ts    # Shared TypeScript types
├── routes/
│   ├── web.php                 # Main routes
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
| GET | `/dashboard` | Halaman utama dengan KPI, grafik penjualan, alert stok |

### Items (Produk)
| Method | URL | Route Name | Deskripsi |
|---|---|---|---|
| GET | `/item` | `item.index` | Daftar semua produk |
| GET | `/item/{item}` | `item.show` | Detail produk |
| GET | `/tambah_item` | `item.tambah` | Form tambah produk |
| POST | `/item` | `item.store` | Simpan produk baru |
| PUT | `/item/{item}` | `item.update` | Update produk |
| DELETE | `/item/{item}` | `item.destroy` | Hapus produk |
| GET | `/stock_alerts` | `item.low_stock` | Daftar produk stok minim |

### Kategori
| Method | URL | Route Name | Deskripsi |
|---|---|---|---|
| GET | `/category` | `kategori.index` | Daftar kategori |
| POST | `/category` | `kategori.store` | Tambah kategori |
| PUT | `/category/{kategori}` | `kategori.update` | Update kategori |
| DELETE | `/category/{kategori}` | `kategori.destroy` | Hapus kategori |

### Inventaris
| Method | URL | Route Name | Deskripsi |
|---|---|---|---|
| GET | `/inventory` | `Stock_History` | Riwayat semua pergerakan stok |
| GET | `/inventory/stock_in` | `Stock_In` | Daftar stock masuk |
| GET | `/inventory/stock_out` | `Stock_Out` | Daftar stock keluar |
| GET | `/inventory/stock_log` | `Stock_Log` | Log audit stok |
| POST | `/inventory/stock` | `stock.store` | Catat pergerakan stok |
| PUT | `/inventory/stock/{transaction}` | `stock.update` | Update pergerakan stok |
| DELETE | `/inventory/stock/{transaction}` | `stock.destroy` | Hapus pergerakan stok |

### Transfer Stok
| Method | URL | Route Name | Deskripsi |
|---|---|---|---|
| GET | `/inventory/transfers` | `stock_transfer.index` | Daftar transfer stok antar gudang |
| POST | `/inventory/transfers` | `stock_transfer.store` | Buat transfer baru |
| DELETE | `/inventory/transfers/{stockTransfer}` | `stock_transfer.destroy` | Batalkan transfer |

### Penyesuaian Stok
| Method | URL | Route Name | Deskripsi |
|---|---|---|---|
| GET | `/inventory/adjustments` | `stock_adjustment.index` | Daftar penyesuaian stok |
| POST | `/inventory/adjustments` | `stock_adjustment.store` | Buat penyesuaian baru |
| GET | `/inventory/adjustments/stock` | `stock_adjustment.warehouse_stock` | Stok per gudang (JSON) |

### Gudang
| Method | URL | Route Name | Deskripsi |
|---|---|---|---|
| GET | `/warehouses` | `warehouses.index` | Daftar gudang |
| GET | `/warehouses/{warehouse}` | `warehouses.show` | Detail gudang + stok |
| POST | `/warehouses` | `warehouses.store` | Tambah gudang |
| PUT | `/warehouses/{warehouse}` | `warehouses.update` | Update gudang |
| DELETE | `/warehouses/{warehouse}` | `warehouses.destroy` | Hapus gudang |
| PUT | `/warehouses/{warehouse}/items/{item}/min` | `warehouses.item_min` | Set stok minimum item di gudang |

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

### POS / Kasir
| Method | URL | Route Name | Deskripsi |
|---|---|---|---|
| GET | `/pos/terminal` | `pos.terminal` | Terminal kasir (layar transaksi) |
| GET | `/pos` | `pos.index` | Riwayat transaksi penjualan |
| POST | `/pos` | `pos.store` | Proses transaksi penjualan |
| GET | `/pos/{saleHeader}` | `pos.show` | Detail transaksi |
| POST | `/pos/{saleHeader}/void` | `pos.void` | Void/batalkan transaksi |

### Purchase Order
| Method | URL | Route Name | Deskripsi |
|---|---|---|---|
| GET | `/purchase-orders` | `po.index` | Daftar purchase order |
| POST | `/purchase-orders` | `po.store` | Buat PO baru |
| GET | `/purchase-orders/{purchaseOrder}` | `po.show` | Detail PO |
| POST | `/purchase-orders/{purchaseOrder}/status` | `po.status` | Update status PO |
| POST | `/purchase-orders/{purchaseOrder}/receive` | `po.receive` | Terima barang PO |
| DELETE | `/purchase-orders/{purchaseOrder}` | `po.destroy` | Hapus PO |

### Retur Barang
| Method | URL | Route Name | Deskripsi |
|---|---|---|---|
| GET | `/returns` | `returns.index` | Daftar retur |
| POST | `/returns` | `returns.store` | Buat retur baru |
| GET | `/returns/{returnHeader}` | `returns.show` | Detail retur |
| POST | `/returns/{returnHeader}/void` | `returns.void` | Void retur |

### Laporan
| Method | URL | Route Name | Deskripsi |
|---|---|---|---|
| GET | `/report/stock` | `Report_Stock` | Laporan stok saat ini |
| GET | `/report/sales` | `Report_Sales` | Laporan penjualan |
| GET | `/report/cashflow` | `Report_Cashflow` | Laporan arus kas |

### Manajemen Pengguna
| Method | URL | Route Name | Deskripsi |
|---|---|---|---|
| GET | `/users` | `users.index` | Daftar pengguna |
| POST | `/users` | `users.store` | Tambah pengguna |
| PUT | `/users/{user}` | `users.update` | Update pengguna |
| DELETE | `/users/{user}` | `users.destroy` | Hapus pengguna |
| POST | `/users/{user}/reset-password` | `users.reset_password` | Reset password |
| POST | `/users/{user}/permissions` | `users.permissions` | Override permission per user |

### Manajemen Role
| Method | URL | Route Name | Deskripsi |
|---|---|---|---|
| GET | `/users/roles` | `users.roles` | Daftar role |
| POST | `/users/roles` | `roles.store` | Tambah role |
| PUT | `/users/roles/{role}` | `roles.update` | Update role |
| DELETE | `/users/roles/{role}` | `roles.destroy` | Hapus role |
| POST | `/users/roles/{role}/permissions` | `roles.permissions` | Set permission role |

---

## Models & Database

### Item
- **Table:** `items`
- **Fields:** `nama`, `deskripsi`, `kode_item` (QR), `kategori`, `id_kategori` (FK), `harga_beli` (int), `harga_jual` (int), `stok`, `stok_minimal`
- **Relations:** `kategoriRelation()` → Kategori

### Warehouse & WarehouseItem
- **Tables:** `warehouses`, `warehouse_items`
- **Fields Warehouse:** `name`, `code`, `address`, `is_active`, `is_default`
- **Fields WarehouseItem:** `warehouse_id`, `item_id`, `stok`, `stok_minimal`

### Transaction (Pergerakan Stok)
- **Table:** `transactions`
- **Types:** `stock_in`, `stock_out`, `adjustment`, `transfer_in`, `transfer_out`, `sale`, `purchase_return`
- **Fields:** `item_id`, `warehouse_id`, `type`, `amount`, `party`, `occurred_at`, `status`, `note`
- **Audit:** `TransactionAudit` mencatat setiap perubahan

### SaleHeader & SaleItem
- **Tables:** `sale_headers`, `sale_items`
- **Fields SaleHeader:** `sale_number`, `warehouse_id`, `customer_id`, `cashier_id`, `occurred_at`, `subtotal`, `discount_amount`, `tax_amount`, `grand_total`, `payment_method`, `payment_amount`, `change_amount`, `status`, `note`
- **Fields SaleItem:** `sale_header_id`, `item_id`, `item_name_snapshot`, `item_code_snapshot`, `unit_price`, `quantity`, `discount_amount`, `line_total`

### PurchaseOrder & PurchaseOrderItem
- **Tables:** `purchase_orders`, `purchase_order_items`
- **Status:** `draft` → `ordered` → `partial` → `received` / `cancelled`

### ReturnHeader & ReturnItem
- **Tables:** `return_headers`, `return_items`
- **Types:** `customer_return` (stok masuk), `supplier_return` (stok keluar)
- **Conditions:** `good`, `damaged`, `defective`
- **Status:** `completed`, `void`

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

### Dual Response Pattern
Semua controller mendukung respons JSON dan Inertia dalam satu method:
```php
if ($request->wantsJson()) {
    return response()->json($data);
}
return Inertia::render('PageName', $data);
```

### Naming Convention
| DB / PHP field | Frontend key |
|---|---|
| `nama` | `name` |
| `kode_item` | `qrcode` |
| `stok_minimal` | `stock_min` / `minimumStock` |
| `harga_beli` | `purchase_price` |
| `harga_jual` | `selling_price` |

---

## Commands

```bash
# Development
composer run dev          # Jalankan semua: Laravel, queue, logs, Vite

# Build
npm run build             # Build production

# Testing
composer run test         # PHPUnit

# Code Quality
npm run lint              # ESLint
npm run format            # Prettier
npm run types             # TypeScript check
vendor/bin/pint           # PHP Pint

# Database
php artisan migrate
php artisan migrate:fresh --seed
```

---

## Tema & UI

- **Primary color:** Indigo 600 (light) / Indigo 400 (dark)
- **Accent:** Gold / Amber
- **Sidebar:** Selalu dark slate (light & dark mode)
- **Theme toggle:** Tombol di pojok kanan atas header (light / dark / system)
- **Status badge semantic:**
  - Hijau emerald = completed / active / success
  - Amber = partial / pending / warning
  - Rose = void / cancelled / error
  - Indigo = draft / info
  - Slate = unknown / neutral
