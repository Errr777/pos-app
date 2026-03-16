<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use App\Models\Kategori;

class ItemSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Fetch real IDs from DB: ['Elektronik' => 1, 'Pakaian' => 2, ...]
        $kategoriMap = Kategori::pluck('id', 'nama')->toArray();
        $kategoriNames = array_keys($kategoriMap);

        if (empty($kategoriNames)) {
            $this->command->warn('No categories found. Run KategoriSeeder first.');
            return;
        }

        for ($i = 1; $i <= 50; $i++) {
            $nama = $kategoriNames[array_rand($kategoriNames)];
            $idKategori = $kategoriMap[$nama];

            DB::table('items')->insert([
                'kode_item'    => 'BRG-' . str_pad($i, 4, '0', STR_PAD_LEFT),
                'nama'         => 'Barang ' . $i,
                'deskripsi'    => 'Deskripsi barang ke-' . $i,
                'stok'         => rand(10, 200),
                'stok_minimal' => rand(5, 20),
                'harga_beli'   => rand(5, 50) * 1000,
                'harga_jual'   => rand(10, 100) * 1000,
                'kategori'     => $nama,
                'id_kategori'  => $idKategori,
                'created_at'   => now(),
                'updated_at'   => now(),
            ]);
        }
    }
}
