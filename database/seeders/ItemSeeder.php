<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ItemSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $kategoriList = ['Elektronik', 'Pakaian', 'Makanan', 'Minuman', 'Peralatan Rumah', 'Aksesoris'];

        for ($i = 1; $i <= 50; $i++) {
            $kategori = $kategoriList[array_rand($kategoriList)];
            $idKategori = array_search($kategori, $kategoriList) + 1;

            DB::table('items')->insert([
                'kode_item'   => 'BRG-' . str_pad($i, 4, '0', STR_PAD_LEFT),
                'nama'          => 'Barang ' . $i,
                'deskripsi'     => 'Deskripsi barang ke-' . $i,                
                'stok'          => rand(10, 200),
                'stok_minimal'  => rand(5, 20),
                'kategori'      => $kategori,
                'id_kategori'   => $idKategori,
                'created_at'    => now(),
                'updated_at'    => now(),
            ]);
        }
    }
}
