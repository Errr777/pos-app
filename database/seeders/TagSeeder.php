<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class TagSeeder extends Seeder
{
    public function run(): void
    {
        $tags = [
            ['name' => 'Flash Sale',          'color' => '#ef4444'],
            ['name' => 'Best Seller',         'color' => '#f59e0b'],
            ['name' => 'Produk Baru',         'color' => '#10b981'],
            ['name' => 'Premium',             'color' => '#8b5cf6'],
            ['name' => 'Promo Ramadan',       'color' => '#06b6d4'],
            ['name' => 'Diskon Akhir Tahun',  'color' => '#ec4899'],
            ['name' => 'Makanan & Minuman',   'color' => '#84cc16'],
            ['name' => 'Limited Edition',     'color' => '#f97316'],
        ];

        $now = now();
        foreach ($tags as $tag) {
            DB::table('tags')->insert(array_merge($tag, [
                'slug'       => Str::slug($tag['name']),
                'created_at' => $now,
                'updated_at' => $now,
            ]));
        }
    }
}
