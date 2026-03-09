# Panduan Pengguna Aplikasi POS

## Daftar Isi

1. [Login & Akses](#1-login--akses)
2. [Dashboard](#2-dashboard)
3. [Produk & Kategori](#3-produk--kategori)
4. [Inventaris & Stok](#4-inventaris--stok)
5. [Gudang](#5-gudang)
6. [Supplier](#6-supplier)
7. [Pelanggan](#7-pelanggan)
8. [Kasir (POS)](#8-kasir-pos)
9. [Purchase Order](#9-purchase-order)
10. [Retur Barang](#10-retur-barang)
11. [Laporan](#11-laporan)
12. [Manajemen Pengguna](#12-manajemen-pengguna)
13. [Pengaturan Akun](#13-pengaturan-akun)

---

## 1. Login & Akses

### Masuk ke Aplikasi
1. Buka aplikasi di browser
2. Masukkan **Email** dan **Password**
3. Klik **Log in**

### Level Akses
Setiap pengguna memiliki role yang menentukan fitur apa yang bisa diakses:

| Role | Deskripsi |
|---|---|
| **Admin** | Akses penuh ke semua fitur |
| **Staff** | Dapat kelola produk, inventaris, PO, retur — tidak bisa kelola pengguna |
| **Kasir** | Hanya kasir (POS), pelanggan, dan retur pelanggan |

> Jika menu tertentu tidak muncul, hubungi admin untuk mengecek hak akses Anda.

---

## 2. Dashboard

Dashboard adalah halaman utama yang menampilkan ringkasan kondisi toko secara real-time.

### KPI Cards (Kartu Statistik)
| Kartu | Informasi |
|---|---|
| **Penjualan Hari Ini** | Total omzet hari ini dari transaksi selesai |
| **Penjualan Bulan Ini** | Total omzet bulan berjalan |
| **Pendapatan Bersih** | Omzet dikurangi harga beli barang terjual |
| **Total Item** | Jumlah produk terdaftar di sistem |
| **Stok Minim** | Jumlah produk yang stoknya di bawah minimum (merah = ada masalah) |
| **Kategori** | Jumlah kategori produk |

### Grafik
- **Penjualan 7 Hari Terakhir** — grafik area menunjukkan tren omzet harian
- **Top 5 Item Terjual** — grafik batang item paling laku bulan ini

### Tabel
- **Transaksi Penjualan Terbaru** — 8 transaksi terakhir, klik baris untuk melihat detail
- **Alert Stok Minim** — produk yang perlu segera direstok (merah = stok habis)

### Ganti Tema
Klik ikon **matahari/bulan/monitor** di pojok kanan atas untuk memilih tema:
- **Light** — tampilan terang
- **Dark** — tampilan gelap
- **System** — mengikuti pengaturan sistem/perangkat

---

## 3. Produk & Kategori

### 3.1 Daftar Produk

Menu: **Produk** di sidebar

Menampilkan semua produk dengan informasi: nama, kategori, kode, harga beli, harga jual, stok.

**Fitur:**
- **Cari** produk by nama atau kode
- **Filter** by kategori
- **Urutkan** by nama, stok, harga
- Klik **Detail** untuk melihat info lengkap produk

### 3.2 Tambah Produk Baru

1. Klik tombol **Tambah Item** (pojok kanan atas)
2. Isi form:
   - **Nama Produk** *(wajib)*
   - **Kode Item** — kode unik / QR code produk
   - **Kategori** — pilih dari daftar atau buat baru
   - **Harga Beli** — harga modal (dalam Rupiah, tanpa desimal)
   - **Harga Jual** — harga ke pelanggan
   - **Stok Awal**
   - **Stok Minimal** — batas minimum sebelum muncul alert
   - **Deskripsi** *(opsional)*
3. Klik **Simpan**

### 3.3 Edit Produk

1. Klik tombol **Edit** pada baris produk
2. Ubah data yang diinginkan
3. Klik **Simpan**

### 3.4 Hapus Produk

1. Klik tombol **Hapus** pada baris produk
2. Konfirmasi penghapusan

> **Perhatian:** Produk yang sudah digunakan di transaksi tidak dapat dihapus.

### 3.5 Stok Minim Alert

Menu: **Produk → Stok Minim**

Menampilkan semua produk yang stoknya sudah di bawah batas minimum. Gunakan halaman ini untuk menentukan produk mana yang perlu direstok.

### 3.6 Kategori

Menu: **Kategori** (sub-menu Produk)

- **Tambah kategori** — klik tombol Tambah, isi nama dan deskripsi
- **Edit** — klik tombol Edit pada baris kategori
- **Hapus** — hanya bisa jika tidak ada produk dalam kategori tersebut

---

## 4. Inventaris & Stok

### 4.1 Riwayat Stok

Menu: **Inventaris → Riwayat**

Menampilkan semua pergerakan stok (masuk/keluar) secara kronologis beserta keterangan pihak terkait (supplier/pelanggan).

### 4.2 Catat Stock In (Barang Masuk)

Menu: **Inventaris → Stock In**

Digunakan untuk mencatat penerimaan barang di luar Purchase Order (misalnya: sumbangan, barang titipan, dll).

1. Klik **Tambah Stock In**
2. Pilih **Produk**, isi **Jumlah**, pilih **Gudang**
3. Isi **Keterangan** (supplier/sumber)
4. Klik **Simpan**

### 4.3 Catat Stock Out (Barang Keluar)

Menu: **Inventaris → Stock Out**

Untuk mencatat pengeluaran barang yang bukan dari transaksi kasir (misalnya: barang rusak, pemakaian internal).

### 4.4 Transfer Stok Antar Gudang

Menu: **Inventaris → Transfer Stok**

Memindahkan stok dari satu gudang ke gudang lain.

1. Klik **Buat Transfer**
2. Pilih **Gudang Asal** dan **Gudang Tujuan**
3. Pilih **Item** dan isi **Jumlah**
4. Klik **Simpan**

> Stok gudang asal akan berkurang dan gudang tujuan akan bertambah secara otomatis.

### 4.5 Penyesuaian Stok

Menu: **Inventaris → Penyesuaian Stok**

Digunakan untuk mengoreksi selisih stok fisik vs sistem (misalnya setelah stock opname).

1. Klik **Buat Penyesuaian**
2. Pilih **Gudang** dan **Item**
3. Masukkan **Stok Aktual** (jumlah fisik yang dihitung)
4. Sistem otomatis menghitung selisih
5. Isi **Alasan** penyesuaian
6. Klik **Simpan**

---

## 5. Gudang

Menu: **Gudang** di sidebar

### 5.1 Daftar Gudang

Menampilkan semua gudang beserta status aktif dan default-nya.

### 5.2 Tambah Gudang

1. Klik **Tambah Gudang**
2. Isi **Nama**, **Kode**, **Alamat**
3. Centang **Aktif** dan/atau **Default** jika diperlukan
4. Klik **Simpan**

### 5.3 Detail Gudang

Klik nama gudang untuk melihat detail termasuk daftar stok per item di gudang tersebut.

### 5.4 Set Stok Minimum per Item per Gudang

Di halaman detail gudang:
1. Temukan item yang ingin diatur
2. Klik tombol edit pada kolom **Stok Minimal**
3. Masukkan nilai minimum
4. Klik **Simpan**

---

## 6. Supplier

Menu: **Supplier** di sidebar

### 6.1 Daftar Supplier

Menampilkan semua supplier dengan nama, kode, email, dan nomor telepon.

### 6.2 Tambah Supplier

1. Klik **Tambah Supplier**
2. Isi **Nama**, **Email**, **Telepon**, **Alamat**
3. Klik **Simpan**

Kode supplier digenerate otomatis (format: `SUP-0001`, `SUP-0002`, dst).

### 6.3 Edit & Hapus Supplier

- **Edit** — klik tombol Edit, ubah data, simpan
- **Hapus** — klik tombol Hapus, konfirmasi

---

## 7. Pelanggan

Menu: **Pelanggan** di sidebar

### 7.1 Daftar Pelanggan

Menampilkan semua pelanggan terdaftar. Transaksi tanpa pelanggan dicatat sebagai **Walk-in**.

### 7.2 Tambah Pelanggan

1. Klik **Tambah Pelanggan**
2. Isi **Nama**, **Email** *(opsional)*, **Telepon** *(opsional)*, **Alamat** *(opsional)*
3. Klik **Simpan**

Kode pelanggan digenerate otomatis (format: `CUST-0001`, dst).

---

## 8. Kasir (POS)

Menu: **Kasir** di sidebar

### 8.1 Riwayat Transaksi

Halaman **Kasir → Riwayat** menampilkan semua transaksi penjualan dengan filter tanggal, status, dan metode pembayaran.

### 8.2 Proses Transaksi Baru

1. Klik **Buka Terminal** atau menu **Kasir → Terminal**
2. **Pilih produk** — cari by nama atau scan kode QR, klik untuk menambahkan ke keranjang
3. **Atur qty & diskon** — klik item di keranjang untuk mengubah jumlah atau tambah diskon per item
4. **Pilih pelanggan** *(opsional)* — cari pelanggan terdaftar atau biarkan kosong untuk Walk-in
5. **Pilih metode pembayaran** — Tunai, Transfer, atau QRIS
6. **Masukkan nominal bayar** (untuk transaksi tunai)
7. Klik **Proses Transaksi**
8. Sistem menampilkan kembalian dan struk transaksi

### 8.3 Detail Transaksi

Klik nomor transaksi di riwayat untuk melihat detail lengkap:
- Item yang terjual, qty, harga satuan, subtotal
- Info pelanggan dan kasir
- Metode pembayaran dan kembalian

### 8.4 Void Transaksi

Jika transaksi perlu dibatalkan:
1. Buka detail transaksi
2. Klik tombol **Void** (merah)
3. Konfirmasi pembatalan

> Void akan mengembalikan stok semua item ke kondisi sebelum transaksi.

---

## 9. Purchase Order

Menu: **Purchase Order** di sidebar

### 9.1 Daftar PO

Menampilkan semua PO dengan status berjalan. Status PO:
- **Draft** — PO dibuat, belum dikirim ke supplier
- **Ordered** — PO sudah dipesan ke supplier
- **Partial** — Sebagian barang sudah diterima
- **Received** — Semua barang sudah diterima
- **Cancelled** — PO dibatalkan

### 9.2 Buat PO Baru

1. Klik **Buat PO**
2. Pilih **Supplier**
3. Pilih **Gudang** tujuan
4. Tambahkan item:
   - Klik **Tambah Item**
   - Pilih produk, isi jumlah dan harga beli
5. Isi **Catatan** *(opsional)*
6. Klik **Simpan**

### 9.3 Update Status PO

Di halaman detail PO, klik tombol sesuai alur:
- **Kirim Order** → status jadi `ordered`
- **Terima Barang** → input jumlah yang diterima per item → status jadi `partial` atau `received`
- **Batalkan** → status jadi `cancelled`

> Saat barang diterima, stok gudang otomatis bertambah.

---

## 10. Retur Barang

Menu: **Retur Barang** di sidebar

### 10.1 Daftar Retur

Menampilkan semua retur dengan tipe dan status.

**Tipe Retur:**
- **Retur dari Pelanggan** — pelanggan mengembalikan barang (stok masuk)
- **Retur ke Supplier** — toko mengembalikan barang ke supplier (stok keluar)

### 10.2 Buat Retur Baru

1. Klik **Buat Retur**
2. Pilih **Tipe Retur**:
   - Retur dari Pelanggan → pilih pelanggan
   - Retur ke Supplier → pilih supplier
3. Pilih **Gudang**
4. Isi **Tanggal**, **Alasan**, **Catatan** *(opsional)*
5. Tambahkan item yang diretur:
   - Pilih **Produk**
   - Isi **Jumlah**
   - Pilih **Kondisi Barang**: Baik / Rusak / Cacat
   - Isi **Harga Satuan**
6. Klik **Simpan**

> Stok otomatis disesuaikan: retur dari pelanggan menambah stok, retur ke supplier mengurangi stok.

### 10.3 Detail Retur

Klik nomor retur untuk melihat detail lengkap termasuk kondisi tiap item.

### 10.4 Void Retur

1. Buka detail retur
2. Klik **Void**
3. Konfirmasi

> Void akan membalik perubahan stok ke kondisi sebelum retur.

---

## 11. Laporan

Menu: **Laporan** di sidebar

### 11.1 Laporan Stok

Menampilkan kondisi stok saat ini untuk semua produk: jumlah stok, nilai stok (qty × harga beli), dan status.

### 11.2 Laporan Penjualan

Menampilkan ringkasan penjualan dalam periode tertentu:
- Total transaksi
- Total omzet
- Breakdown per produk

Gunakan filter tanggal untuk memilih periode laporan.

### 11.3 Laporan Arus Kas

Menampilkan aliran kas masuk dan keluar:
- **Kas Masuk** — dari penjualan POS
- **Kas Keluar** — dari pembelian (Purchase Order)
- **Selisih** — saldo bersih

---

## 12. Manajemen Pengguna

Menu: **Pengguna** di sidebar *(hanya Admin)*

### 12.1 Daftar Pengguna

Menampilkan semua pengguna yang terdaftar beserta role dan status.

### 12.2 Tambah Pengguna

1. Klik **Tambah Pengguna**
2. Isi **Nama**, **Email**, **Password**, **Role**
3. Klik **Simpan**

### 12.3 Edit Pengguna

1. Klik tombol **Edit** pada baris pengguna
2. Ubah data (nama, email, role)
3. Klik **Simpan**

### 12.4 Reset Password

1. Klik tombol **Reset Password** pada baris pengguna
2. Masukkan password baru
3. Klik **Simpan**

### 12.5 Hapus Pengguna

Klik **Hapus** pada baris pengguna, konfirmasi penghapusan.

> Tidak bisa menghapus akun Anda sendiri.

### 12.6 Override Permission per Pengguna

Untuk memberikan hak akses berbeda dari role standar:
1. Klik tombol **Permission** pada baris pengguna
2. Centang permission yang diinginkan untuk setiap modul
3. Klik **Simpan**

> Permission per user menggantikan permission dari role untuk user tersebut.

### 12.7 Manajemen Role

Sub-menu: **Pengguna → Role**

- **Lihat role** — daftar role beserta permission default
- **Tambah role** — buat role baru dengan nama dan permission custom
- **Edit role** — ubah nama atau permission role
- **Hapus role** — role default (admin, staff, kasir) tidak bisa dihapus

---

## 13. Pengaturan Akun

Menu: klik avatar/nama di pojok sidebar → **Settings**

### 13.1 Edit Profil

- Ubah **Nama** dan **Email**
- Klik **Simpan**

### 13.2 Ganti Password

1. Masukkan **Password Saat Ini**
2. Masukkan **Password Baru** dan konfirmasi
3. Klik **Simpan**

### 13.3 Tema Tampilan

Klik ikon **matahari/bulan/monitor** di pojok kanan atas untuk memilih:
- **Light** — tema terang
- **Dark** — tema gelap
- **System** — mengikuti tema sistem/OS

---

## Tips & Catatan Penting

### Format Harga
- Masukkan harga dalam Rupiah **tanpa titik atau koma desimal**
- Contoh: Rp 15.000 diketik sebagai `15000`

### Void vs Hapus
- **Void** — membatalkan transaksi/retur dan membalik stok. Data tetap tersimpan sebagai catatan.
- **Hapus** — menghapus data permanen (hanya untuk draft/data yang belum diproses).

### Stok Terpusat vs Per Gudang
- Stok di halaman **Produk** menampilkan total stok semua gudang
- Stok per gudang dapat dilihat di halaman detail **Gudang**

### Walk-in Customer
- Jika pelanggan tidak terdaftar, cukup kosongkan field pelanggan saat transaksi
- Transaksi akan tercatat sebagai **Walk-in**

### Logout
Klik avatar/nama di sidebar → **Log out**
