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
            ['nama' => 'Elektronik', 'deskripsi' => 'Barang-barang elektronik seperti gadget, TV, dan komputer.'],
            ['nama' => 'Pakaian', 'deskripsi' => 'Segala jenis pakaian pria, wanita, dan anak.'],
            ['nama' => 'Makanan', 'deskripsi' => 'Produk makanan siap saji dan kemasan.'],
            ['nama' => 'Minuman', 'deskripsi' => 'Berbagai jenis minuman ringan dan kemasan.'],
            ['nama' => 'Peralatan Rumah Tangga', 'deskripsi' => 'Peralatan dan perlengkapan rumah tangga sehari-hari.'],
            ['nama' => 'Aksesoris', 'deskripsi' => 'Aksesoris fashion, gadget, dan kendaraan.'],
            ['nama' => 'Otomotif', 'deskripsi' => 'Produk dan perlengkapan untuk kendaraan.'],
            ['nama' => 'Kesehatan', 'deskripsi' => 'Produk perawatan tubuh dan kesehatan.'],
            ['nama' => 'Kecantikan', 'deskripsi' => 'Kosmetik dan produk kecantikan lainnya.'],
            ['nama' => 'Alat Tulis Kantor', 'deskripsi' => 'Alat tulis dan perlengkapan kantor.'],
        ];

        DB::table('kategoris')->insert($kategoris);
    }
}