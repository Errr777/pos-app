<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class PromotionSeeder extends Seeder
{
    public function run(): void
    {
        $tagMap = DB::table('tags')->pluck('id', 'name');
        $catMap = DB::table('kategoris')->pluck('id', 'nama');

        $now = now();
        DB::table('promotions')->insert([
            [
                'name'        => 'Flash Sale Spesial',
                'code'        => 'FLASH10',
                'type'        => 'percentage',
                'value'       => 10,
                'applies_to'  => 'tag',
                'applies_id'  => $tagMap['Flash Sale'] ?? null,
                'min_purchase'=> 50000,
                'max_discount'=> 50000,
                'start_date'  => '2026-01-01',
                'end_date'    => '2026-12-31',
                'is_active'   => true,
                'created_at'  => $now,
                'updated_at'  => $now,
            ],
            [
                'name'        => 'Promo Ramadan 15%',
                'code'        => 'RAMADAN15',
                'type'        => 'percentage',
                'value'       => 15,
                'applies_to'  => 'tag',
                'applies_id'  => $tagMap['Promo Ramadan'] ?? null,
                'min_purchase'=> 100000,
                'max_discount'=> 75000,
                'start_date'  => '2026-02-20',
                'end_date'    => '2026-04-10',
                'is_active'   => true,
                'created_at'  => $now,
                'updated_at'  => $now,
            ],
            [
                'name'        => 'Diskon Elektronik 8%',
                'code'        => 'ELEK8',
                'type'        => 'percentage',
                'value'       => 8,
                'applies_to'  => 'category',
                'applies_id'  => $catMap['Elektronik'] ?? null,
                'min_purchase'=> 500000,
                'max_discount'=> 200000,
                'start_date'  => '2026-01-01',
                'end_date'    => '2026-12-31',
                'is_active'   => true,
                'created_at'  => $now,
                'updated_at'  => $now,
            ],
            [
                'name'        => 'Diskon Semua Produk 5%',
                'code'        => 'ALL5',
                'type'        => 'percentage',
                'value'       => 5,
                'applies_to'  => 'all',
                'applies_id'  => null,
                'min_purchase'=> 200000,
                'max_discount'=> 30000,
                'start_date'  => '2026-03-01',
                'end_date'    => '2026-03-31',
                'is_active'   => true,
                'created_at'  => $now,
                'updated_at'  => $now,
            ],
            [
                'name'        => 'Potongan Rp 25.000',
                'code'        => 'POTON25',
                'type'        => 'fixed',
                'value'       => 25000,
                'applies_to'  => 'all',
                'applies_id'  => null,
                'min_purchase'=> 250000,
                'max_discount'=> 25000,
                'start_date'  => '2026-01-01',
                'end_date'    => '2026-12-31',
                'is_active'   => true,
                'created_at'  => $now,
                'updated_at'  => $now,
            ],
        ]);
    }
}
