<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class KategoriSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $kategoris = [
            ['nama_kategori' => 'Elektronik', 'deskripsi' => 'Barang-barang elektronik seperti gadget, TV, dan komputer.'],
            ['nama_kategori' => 'Pakaian', 'deskripsi' => 'Segala jenis pakaian pria, wanita, dan anak.'],
            ['nama_kategori' => 'Makanan', 'deskripsi' => 'Produk makanan siap saji dan kemasan.'],
            ['nama_kategori' => 'Minuman', 'deskripsi' => 'Berbagai jenis minuman ringan dan kemasan.'],
            ['nama_kategori' => 'Peralatan Rumah Tangga', 'deskripsi' => 'Peralatan dan perlengkapan rumah tangga sehari-hari.'],
            ['nama_kategori' => 'Aksesoris', 'deskripsi' => 'Aksesoris fashion, gadget, dan kendaraan.'],
            ['nama_kategori' => 'Otomotif', 'deskripsi' => 'Produk dan perlengkapan untuk kendaraan.'],
            ['nama_kategori' => 'Kesehatan', 'deskripsi' => 'Produk perawatan tubuh dan kesehatan.'],
            ['nama_kategori' => 'Kecantikan', 'deskripsi' => 'Kosmetik dan produk kecantikan lainnya.'],
            ['nama_kategori' => 'Alat Tulis Kantor', 'deskripsi' => 'Alat tulis dan perlengkapan kantor.'],
        ];

        DB::table('kategoris')->insert($kategoris);
    }
}