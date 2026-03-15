# Panduan Pengguna Aplikasi POS

## Daftar Isi

1. [Login & Akses](#1-login--akses)
2. [Dashboard](#2-dashboard)
3. [Produk & Kategori](#3-produk--kategori)
4. [Tags Produk](#4-tags-produk)
5. [Inventaris & Stok](#5-inventaris--stok)
6. [Gudang](#6-gudang)
7. [Supplier](#7-supplier)
8. [Pelanggan](#8-pelanggan)
9. [Kasir (POS)](#9-kasir-pos)
10. [Purchase Order](#10-purchase-order)
11. [Retur Barang](#11-retur-barang)
12. [Promo & Diskon](#12-promo--diskon)
13. [Pengeluaran](#13-pengeluaran)
14. [Laporan](#14-laporan)
15. [Manajemen Pengguna](#15-manajemen-pengguna)
16. [Log Aktivitas](#16-log-aktivitas)
17. [Pengaturan Akun](#17-pengaturan-akun)

---

## 1. Login & Akses

### Masuk ke Aplikasi
1. Buka aplikasi di browser
2. Masukkan **Email** dan **Password**
3. Klik **Log in**

### Syarat Password
Password harus memenuhi:
- Minimal **8 karakter**
- Mengandung **huruf besar dan huruf kecil**
- Mengandung minimal **satu angka**

### Level Akses

| Role | Deskripsi |
|---|---|
| **Admin** | Akses penuh ke semua fitur |
| **Staff** | Dapat kelola produk, inventaris, PO, retur — tidak bisa kelola pengguna |
| **Kasir** | Hanya kasir (POS), pelanggan, dan retur pelanggan |

> Hak akses setiap pengguna dapat dikustomisasi per modul oleh Admin melalui menu Pengguna → Permission.

> Jika menu tertentu tidak muncul atau muncul pesan "403 Forbidden", hubungi admin untuk mengecek hak akses Anda.

---

## 2. Dashboard

Dashboard adalah halaman utama yang menampilkan ringkasan kondisi toko secara real-time.

### Filter Bulan
Di pojok kanan atas dashboard, tersedia **dropdown filter bulan**:
- Pilih **Tahun** dan **Bulan** untuk melihat data periode tertentu
- Default menampilkan bulan berjalan

### KPI Cards (Kartu Statistik)

| Kartu | Informasi |
|---|---|
| **Penjualan Hari Ini** | Total omzet hari ini (khusus bulan berjalan) |
| **Penjualan Bulan Ini** | Total omzet bulan yang dipilih |
| **Pendapatan Bersih** | Omzet dikurangi harga beli barang terjual |
| **Jumlah Transaksi** | Total transaksi selesai pada bulan yang dipilih |
| **Total Item** | Jumlah produk terdaftar di sistem |
| **Stok Minim** | Jumlah produk yang stoknya di bawah minimum |

### Statistik Per Outlet (Admin)
Admin melihat kartu ringkasan per outlet/gudang:
- Penjualan hari ini per outlet
- Penjualan bulan ini per outlet
- Jumlah transaksi hari ini per outlet

### Grafik
- **Penjualan Harian** — tren omzet harian (7 hari terakhir untuk bulan berjalan, full bulan untuk bulan lalu)
- **Top 5 Item Terjual** — produk paling laku bulan yang dipilih

### Tabel & Alert
- **Transaksi Terbaru** — 5 transaksi terakhir pada bulan yang dipilih
- **Alert Stok Minim** — produk yang perlu segera direstok, lengkap dengan nama outlet

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
   - **Tipe** — Barang (stok terpantau) atau Jasa (tidak ada stok)
   - **Nama Produk** *(wajib)*
   - **Kode Item** — kode unik / QR code produk
   - **Kategori** — pilih dari daftar atau buat baru
   - **Tag** *(opsional)* — tag warna untuk pengelompokan
   - **Harga Beli** — harga modal (dalam Rupiah, tanpa desimal)
   - **Harga Jual** — harga ke pelanggan
   - **Stok Awal** *(khusus Barang)*
   - **Stok Minimal** *(khusus Barang)* — batas minimum sebelum muncul alert
   - **Deskripsi** *(opsional)*
3. Klik **Simpan**

> Setelah berhasil tersimpan, muncul notifikasi hijau di atas halaman.

### 3.3 Edit Produk

1. Klik tombol **Edit** pada baris produk
2. Ubah data yang diinginkan
3. Klik **Simpan**

### 3.4 Hapus Produk

1. Klik tombol **Hapus** pada baris produk
2. Konfirmasi penghapusan

> **Perhatian:** Produk yang sudah digunakan di transaksi tidak dapat dihapus.

### 3.5 Cetak Label QR Code

Di halaman detail produk, klik **Cetak Label** untuk mencetak label QR code produk yang dapat di-scan di terminal kasir.

### 3.6 Stok Minim Alert

Produk dengan stok di bawah minimum otomatis muncul di:
- Dashboard → Alert Stok Minim
- Halaman detail produk (indikator merah)

> **Catatan:** Produk bertipe **Jasa** tidak dihitung dalam alert stok minimum.

### 3.7 Kategori

Menu: **Kategori** (sub-menu Produk)

- **Tambah kategori** — klik tombol Tambah, isi nama dan deskripsi
- **Edit** — klik tombol Edit pada baris kategori
- **Hapus** — hanya bisa jika tidak ada produk dalam kategori tersebut

---

## 4. Tags Produk

Menu: **Tags Produk** di sidebar

Tags adalah label warna yang bisa dipasang ke produk untuk pengelompokan bebas (misalnya: "Promo", "Baru", "Unggulan").

### 4.1 Tambah Tag

1. Klik **Tambah Tag**
2. Isi **Nama Tag**
3. Pilih **Warna** dari color picker
4. Klik **Simpan**

### 4.2 Edit & Hapus Tag

- Klik ikon **edit** (pensil) pada baris tag untuk mengubah nama/warna
- Klik ikon **hapus** untuk menghapus tag

> Menghapus tag tidak menghapus produk yang memiliki tag tersebut — tag hanya dicabut dari produk.

### 4.3 Menggunakan Tag di Produk

Tag dipasang saat menambah atau mengedit produk melalui field **Tag** di form produk. Satu produk bisa memiliki beberapa tag sekaligus.

---

## 5. Inventaris & Stok

### 5.1 Riwayat Stok

Menu: **Inventaris → Riwayat**

Menampilkan semua pergerakan stok (masuk/keluar) secara kronologis beserta keterangan pihak terkait (supplier/pelanggan).

### 5.2 Catat Stock In (Barang Masuk)

Menu: **Inventaris → Stock In**

Digunakan untuk mencatat penerimaan barang di luar Purchase Order (misalnya: sumbangan, barang titipan, koreksi).

1. Klik **Tambah Stock In**
2. Pilih **Produk**, isi **Jumlah**, pilih **Gudang**
3. Isi **Keterangan** (supplier/sumber)
4. Klik **Simpan**

### 5.3 Catat Stock Out (Barang Keluar)

Menu: **Inventaris → Stock Out**

Untuk mencatat pengeluaran barang yang bukan dari transaksi kasir (misalnya: barang rusak, pemakaian internal, sampel).

### 5.4 Transfer Stok Antar Gudang

Menu: **Inventaris → Transfer Stok**

Memindahkan stok dari satu gudang ke gudang lain.

1. Klik **Buat Transfer**
2. Pilih **Gudang Asal** dan **Gudang Tujuan**
3. Pilih **Item** dan isi **Jumlah**
4. Klik **Simpan**

> Stok gudang asal akan berkurang dan gudang tujuan akan bertambah secara otomatis.

### 5.5 Penyesuaian Stok

Menu: **Inventaris → Penyesuaian Stok**

Digunakan untuk mengoreksi selisih stok fisik vs sistem (misalnya setelah stock opname).

1. Klik **Buat Penyesuaian**
2. Pilih **Gudang** dan **Item**
3. Masukkan **Stok Aktual** (jumlah fisik yang dihitung)
4. Sistem otomatis menghitung selisih
5. Isi **Alasan** penyesuaian
6. Klik **Simpan**

---

## 6. Gudang

Menu: **Gudang** di sidebar

### 6.1 Daftar Gudang

Menampilkan semua gudang/outlet beserta kota, nomor telepon, status aktif dan default-nya.

### 6.2 Tambah Gudang

1. Klik **Tambah Gudang**
2. Isi **Nama**, **Kode**, **Kota**, **Telepon**, **Alamat**
3. Centang **Aktif** dan/atau **Default** jika diperlukan
4. Klik **Simpan**

### 6.3 Detail Gudang

Klik nama gudang untuk melihat detail termasuk daftar stok per item di gudang tersebut.

### 6.4 Set Stok Minimum per Item per Gudang

Di halaman detail gudang:
1. Temukan item yang ingin diatur
2. Klik tombol edit pada kolom **Stok Minimal**
3. Masukkan nilai minimum
4. Klik **Simpan**

### 6.5 Assign Pengguna ke Gudang

Admin dapat membatasi akses kasir/staff hanya ke gudang tertentu melalui menu **Pengguna → Edit → Gudang**.

---

## 7. Supplier

Menu: **Supplier** di sidebar

### 7.1 Daftar Supplier

Menampilkan semua supplier dengan nama, kode, kontak, kota, dan status aktif.

**Fitur:**
- Cari by nama, kode, kontak, telepon, atau kota
- Filter by status (Aktif / Nonaktif)
- Urutkan by nama, kode, kota

### 7.2 Tambah Supplier

1. Klik **Tambah Supplier**
2. Isi **Nama** *(wajib)*, **Kontak Person**, **Telepon**, **Email**, **Alamat**, **Kota**
3. Klik **Simpan**

Kode supplier digenerate otomatis (format: `SUP-0001`, `SUP-0002`, dst).

### 7.3 Edit & Hapus Supplier

- **Edit** — klik tombol Edit, ubah data, simpan
- **Hapus** — klik tombol Hapus, konfirmasi
- **Nonaktifkan** — ubah status menjadi nonaktif agar tidak muncul di dropdown PO

---

## 8. Pelanggan

Menu: **Pelanggan** di sidebar

### 8.1 Daftar Pelanggan

Menampilkan semua pelanggan terdaftar. Transaksi tanpa pelanggan dicatat sebagai **Walk-in**.

### 8.2 Tambah Pelanggan

1. Klik **Tambah Pelanggan**
2. Isi **Nama** *(wajib)*, **Email** *(opsional)*, **Telepon** *(opsional)*, **Alamat** *(opsional)*
3. Klik **Simpan**

Kode pelanggan digenerate otomatis (format: `CUST-0001`, dst).

### 8.3 Edit & Hapus Pelanggan

- **Edit** — klik tombol Edit, ubah data, simpan
- **Hapus** — klik tombol Hapus, konfirmasi

---

## 9. Kasir (POS)

Menu: **Kasir** di sidebar

### 9.1 Riwayat Transaksi

Halaman **Kasir** menampilkan semua transaksi penjualan dengan filter:
- Tanggal (dari-sampai)
- Metode pembayaran
- Outlet/gudang

### 9.2 Proses Transaksi Baru

1. Klik **Buka Terminal** atau menu **Kasir → Terminal**
2. **Pilih produk** — cari by nama atau scan kode QR, klik untuk menambahkan ke keranjang
3. **Atur qty & diskon** — klik item di keranjang untuk mengubah jumlah atau tambah diskon per item
4. **Pilih pelanggan** *(opsional)* — cari pelanggan terdaftar atau biarkan kosong untuk Walk-in
5. **Terapkan promo** *(opsional)* — masukkan kode promo jika ada
6. **Pilih metode pembayaran** — Tunai, Transfer, atau QRIS
7. **Masukkan nominal bayar** (untuk transaksi tunai)
8. Klik **Proses Transaksi**
9. Sistem menampilkan kembalian dan struk transaksi

### 9.3 Struk Transaksi

Setelah transaksi berhasil, struk otomatis ditampilkan dengan:
- Nomor transaksi
- Daftar item, qty, harga, subtotal
- Diskon (jika ada)
- Total, metode bayar, kembalian
- Nama kasir dan outlet

Klik **Cetak** untuk mencetak struk.

### 9.4 Detail Transaksi

Klik nomor transaksi di riwayat untuk melihat detail lengkap:
- Item yang terjual, qty, harga satuan, subtotal
- Info pelanggan dan kasir
- Nama outlet
- Metode pembayaran dan kembalian
- Diskon yang diterapkan

### 9.5 Void Transaksi

Jika transaksi perlu dibatalkan:
1. Buka detail transaksi
2. Klik tombol **Void** (merah)
3. Konfirmasi pembatalan

> Void akan mengembalikan stok semua item ke kondisi sebelum transaksi.

---

## 10. Purchase Order

Menu: **Purchase Order** di sidebar

### 10.1 Daftar PO

Menampilkan semua PO. Status PO:
- **Draft** — PO dibuat, belum dikirim ke supplier
- **Ordered** — PO sudah dipesan ke supplier
- **Partial** — Sebagian barang sudah diterima
- **Received** — Semua barang sudah diterima
- **Cancelled** — PO dibatalkan

### 10.2 Buat PO Baru

1. Klik **Buat PO**
2. Pilih **Supplier** *(opsional)*
3. Pilih **Gudang** tujuan
4. Tambahkan item:
   - Klik **Tambah Item**
   - Pilih produk, isi jumlah dan harga beli
5. Isi **Catatan** *(opsional)*
6. Klik **Simpan**

### 10.3 Saran Reorder Otomatis

Klik **Saran Reorder** untuk melihat produk yang stoknya sudah di bawah minimum. Sistem dapat membuat draft PO otomatis dari daftar saran ini.

### 10.4 Update Status PO

Di halaman detail PO, klik tombol sesuai alur:
- **Kirim Order** → status jadi `ordered`
- **Terima Barang** → input jumlah yang diterima per item → status jadi `partial` atau `received`
- **Batalkan** → status jadi `cancelled`

> Saat barang diterima, stok gudang otomatis bertambah.

---

## 11. Retur Barang

Menu: **Retur Barang** di sidebar

### 11.1 Daftar Retur

Menampilkan semua retur dengan tipe dan status.

**Tipe Retur:**
- **Retur dari Pelanggan** — pelanggan mengembalikan barang (stok masuk)
- **Retur ke Supplier** — toko mengembalikan barang ke supplier (stok keluar)

### 11.2 Buat Retur Baru

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

### 11.3 Detail & Void Retur

- Klik nomor retur untuk melihat detail
- Klik **Void** untuk membatalkan retur (membalik perubahan stok)

---

## 12. Promo & Diskon

Menu: **Promo** di sidebar

### 12.1 Daftar Promo

Menampilkan semua promo aktif dan tidak aktif beserta periode berlaku dan status.

### 12.2 Buat Promo Baru

1. Klik **Tambah Promo**
2. Isi:
   - **Nama Promo** *(wajib)*
   - **Kode Promo** *(opsional)* — kode yang dimasukkan kasir saat transaksi (contoh: `DISKON10`)
   - **Tipe Diskon**:
     - **Persentase** — diskon berupa % dari subtotal
     - **Nominal** — diskon berupa Rp tetap
   - **Nilai Diskon** — angka persen atau Rupiah
   - **Berlaku Untuk**:
     - **Semua Produk** — berlaku untuk semua item di keranjang
     - **Kategori** — pilih kategori tertentu
     - **Produk** — pilih produk spesifik
     - **Tag** — pilih tag produk
   - **Min. Pembelian** — minimal subtotal agar promo berlaku (0 = tanpa batas)
   - **Maks. Diskon** — batas atas nominal diskon (0 = tanpa batas, khusus tipe %)
   - **Tanggal Mulai** dan **Tanggal Berakhir** *(opsional)*
   - **Aktif** — centang untuk mengaktifkan promo
3. Klik **Simpan**

### 12.3 Menggunakan Promo di Kasir

Di terminal kasir, setelah menambahkan produk ke keranjang:
1. Masukkan **kode promo** di field yang tersedia
2. Klik **Terapkan**
3. Diskon otomatis dihitung dan ditampilkan di total

---

## 13. Pengeluaran

Menu: **Pengeluaran** di sidebar

Digunakan untuk mencatat pengeluaran operasional toko yang bukan pembelian barang dagangan (misalnya: listrik, gaji, sewa, kebersihan).

### 13.1 Daftar Pengeluaran

Menampilkan semua pengeluaran dengan filter:
- **Periode tanggal** (dari-sampai)
- **Kategori pengeluaran**
- **Outlet/gudang**

### 13.2 Catat Pengeluaran Baru

Klik tombol **+** atau **Tambah Pengeluaran**, isi:
- **Tanggal**
- **Kategori** (pilih dari daftar: operasional, gaji, sewa, dll)
- **Jumlah** (Rupiah)
- **Keterangan** *(opsional)*
- **Outlet** — cabang mana yang mengeluarkan

Klik **Simpan**.

> Data pengeluaran digunakan dalam **Laporan Laba Rugi** untuk menghitung laba bersih.

---

## 14. Laporan

Menu: **Laporan** di sidebar

### 14.1 Laporan Stok

Menampilkan kondisi stok saat ini untuk semua produk:
- Jumlah stok saat ini
- Stok minimal
- Total stok masuk dan keluar dalam periode filter
- Filter by nama, kode, atau kategori
- **Export ke Excel**

### 14.2 Laporan Penjualan

Menampilkan ringkasan penjualan dalam periode tertentu:
- Total transaksi & total omzet
- Total diskon yang diberikan
- Daftar transaksi dengan filter outlet, metode bayar, dan tanggal
- **Export ke Excel**

### 14.3 Laporan Arus Kas

Menampilkan aliran kas masuk dan keluar:
- **Kas Masuk** — dari penjualan POS
- **Kas Keluar** — dari pembelian (Purchase Order yang diterima)
- **Net** — saldo bersih per periode
- Tampilkan by **Harian** atau **Bulanan**
- Filter by outlet
- **Export ke Excel**

### 14.4 Laporan Laba Rugi (P&L)

Menampilkan laporan laba rugi per bulan dalam satu tahun:
- **Omzet** — total penjualan
- **HPP (COGS)** — harga pokok barang terjual
- **Laba Kotor** — omzet dikurangi HPP
- **Pengeluaran** — biaya operasional (dari modul Pengeluaran)
- **Laba Bersih** — laba kotor dikurangi pengeluaran
- Filter by tahun dan outlet

### 14.5 Analisis ABC

Mengklasifikasikan produk berdasarkan kontribusi terhadap total omzet:
- **Kelas A** — 0–80% omzet (produk paling vital)
- **Kelas B** — 80–95% omzet (produk pendukung)
- **Kelas C** — 95–100% omzet (produk kontribusi kecil)

Berguna untuk menentukan prioritas restok dan promosi.
- Filter by periode dan outlet
- **Export ke Excel**

### 14.6 Perbandingan Cabang

Membandingkan performa antar outlet/gudang dalam satu periode:
- Total transaksi, omzet, laba per cabang
- Rata-rata nilai transaksi per cabang
- Produk terlaris per cabang
- **Export ke Excel**

### 14.7 Peak Hours (Jam Tersibuk)

Menampilkan heatmap transaksi berdasarkan jam dan hari dalam seminggu:
- Identifikasi jam paling ramai untuk alokasi kasir
- Filter by outlet dan periode
- **Export ke Excel**

---

## 15. Manajemen Pengguna

Menu: **Pengguna** di sidebar *(hanya Admin)*

### 15.1 Daftar Pengguna

Menampilkan semua pengguna beserta role, email, dan status.

### 15.2 Tambah Pengguna

1. Klik **Tambah Pengguna**
2. Isi **Nama**, **Email**, **Role**
3. Isi **Password** (min. 8 karakter, huruf besar+kecil, angka)
4. Klik **Simpan**

### 15.3 Edit Pengguna

1. Klik tombol **Edit** pada baris pengguna
2. Ubah data (nama, email, role)
3. Klik **Simpan**

### 15.4 Reset Password

1. Klik tombol **Reset Password** pada baris pengguna
2. Masukkan password baru (min. 8 karakter, huruf besar+kecil, angka)
3. Klik **Simpan**

### 15.5 Hapus Pengguna

Klik **Hapus** pada baris pengguna, konfirmasi penghapusan.

> Tidak bisa menghapus akun Anda sendiri.

### 15.6 Override Permission per Pengguna

Untuk memberikan hak akses berbeda dari role standar:
1. Klik tombol **Permission** pada baris pengguna
2. Centang/uncentang permission yang diinginkan per modul
3. Klik **Simpan**

| Permission | Fungsi |
|---|---|
| **Lihat** | Bisa melihat daftar dan detail |
| **Tulis** | Bisa tambah dan edit |
| **Hapus** | Bisa menghapus data |

> Permission per user menggantikan permission dari role untuk user tersebut.

### 15.7 Assign Gudang ke Pengguna

Untuk membatasi kasir/staff hanya bisa akses outlet tertentu:
1. Klik **Edit** pada baris pengguna
2. Di bagian **Gudang**, centang gudang yang diizinkan
3. Klik **Simpan**

> Jika tidak ada gudang yang dipilih, pengguna bisa akses semua gudang.

### 15.8 Manajemen Role

Sub-menu: **Pengguna → Role**

- **Lihat role** — daftar role beserta permission default
- **Tambah role** — buat role baru dengan nama dan permission custom
- **Edit role** — ubah nama atau permission role
- **Hapus role** — role default (admin, staff, kasir) tidak bisa dihapus

---

## 16. Log Aktivitas

Menu: **Pengguna → Log Aktivitas** *(hanya Admin)*

Mencatat semua aktivitas penting di sistem untuk audit dan forensik.

### Informasi yang Dicatat
- **Siapa** — nama pengguna yang melakukan aksi
- **Apa** — jenis aksi (tambah, edit, hapus, reset password, dll)
- **Pada apa** — objek yang dikenai aksi (nama produk, nomor PO, dll)
- **Kapan** — waktu kejadian
- **Dari mana** — IP address pengguna
- **Perubahan** — nilai sebelum dan sesudah (untuk edit)

### Filter Log
- **Periode tanggal** (dari-sampai)
- **Kategori aksi**: Pengguna, Produk, Stok, Pembelian, Outlet, Promosi, Role

### Aksi yang Tercatat
Termasuk: login/logout, tambah/edit/hapus produk, perubahan harga, transfer stok, penerimaan PO, pembuatan retur, perubahan permission, reset password, dan lainnya.

---

## 17. Pengaturan Akun

Menu: klik avatar/nama di pojok sidebar → **Settings**

### 17.1 Edit Profil

- Ubah **Nama** dan **Email**
- Klik **Simpan**

### 17.2 Ganti Password

1. Masukkan **Password Saat Ini**
2. Masukkan **Password Baru** (min. 8 karakter, huruf besar+kecil, angka)
3. Konfirmasi password baru
4. Klik **Simpan**

### 17.3 Tema Tampilan

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
- **Void** — membatalkan transaksi/retur dan membalik stok. Data tetap tersimpan sebagai catatan audit.
- **Hapus** — menghapus data permanen (hanya untuk draft/data yang belum diproses).

### Stok Terpusat vs Per Gudang
- Stok di halaman **Produk** menampilkan total stok semua gudang
- Stok per gudang dapat dilihat di halaman detail **Gudang**
- Alert stok minim di dashboard menampilkan outlet/gudang mana yang kekurangan stok

### Jasa vs Barang
- Produk **Barang** — stok dipantau, muncul di alert stok minimum
- Produk **Jasa** — tidak ada stok, tidak masuk hitungan alert minimum

### Walk-in Customer
- Jika pelanggan tidak terdaftar, cukup kosongkan field pelanggan saat transaksi
- Transaksi akan tercatat sebagai **Walk-in**

### Session Login
- Session login otomatis berakhir setelah **60 menit** tidak aktif
- Silakan login kembali jika muncul halaman login saat sedang bekerja

### Logout
Klik avatar/nama di sidebar → **Log out**
