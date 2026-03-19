<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class KategoriSeeder extends Seeder
{
    public function run(): void
    {
        DB::table('kategoris')->insert([
            ['nama' => 'Elektronik',             'deskripsi' => 'Gadget, aksesoris digital, dan perangkat elektronik.'],
            ['nama' => 'Pakaian',                'deskripsi' => 'Busana pria, wanita, dan anak-anak.'],
            ['nama' => 'Makanan',                'deskripsi' => 'Produk makanan kemasan, snack, dan bahan pangan.'],
            ['nama' => 'Minuman',                'deskripsi' => 'Minuman ringan, jus, air mineral, dan minuman kesehatan.'],
            ['nama' => 'Peralatan Rumah Tangga', 'deskripsi' => 'Peralatan dapur, kebersihan, dan perlengkapan rumah.'],
            ['nama' => 'Aksesoris',              'deskripsi' => 'Tas, dompet, jam tangan, dan aksesori fashion.'],
            ['nama' => 'Otomotif',               'deskripsi' => 'Suku cadang, pelumas, dan perlengkapan kendaraan.'],
            ['nama' => 'Kesehatan',              'deskripsi' => 'Obat-obatan, vitamin, dan alat kesehatan.'],
            ['nama' => 'Kecantikan',             'deskripsi' => 'Skincare, kosmetik, dan perawatan rambut.'],
            ['nama' => 'Alat Tulis Kantor',      'deskripsi' => 'Alat tulis, kertas, dan perlengkapan kantor.'],
        ]);
    }
}
