<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class WarehouseSeeder extends Seeder
{
    public function run(): void
    {
        $now = now();

        // The migration seeds WH-MAIN as default — promote it to "Toko Pusat"
        DB::table('warehouses')->where('code', 'WH-MAIN')->update([
            'code'        => 'WH-001',
            'name'        => 'Toko Pusat',
            'location'    => 'Jl. Sudirman No. 12, Jakarta Pusat',
            'city'        => 'Jakarta',
            'phone'       => '021-55001234',
            'description' => 'Outlet utama dan gudang sentral',
            'is_active'   => true,
            'is_default'  => true,
            'updated_at'  => $now,
        ]);

        // Add 3 outlet branches
        DB::table('warehouses')->insert([
            [
                'code'        => 'WH-002',
                'name'        => 'Outlet Semarang',
                'location'    => 'Jl. Pemuda No. 45, Semarang Tengah',
                'city'        => 'Semarang',
                'phone'       => '024-76542100',
                'description' => 'Outlet cabang Semarang',
                'is_active'   => true,
                'is_default'  => false,
                'created_at'  => $now,
                'updated_at'  => $now,
            ],
            [
                'code'        => 'WH-003',
                'name'        => 'Outlet Bandung',
                'location'    => 'Jl. Braga No. 88, Bandung Wetan',
                'city'        => 'Bandung',
                'phone'       => '022-42001567',
                'description' => 'Outlet cabang Bandung',
                'is_active'   => true,
                'is_default'  => false,
                'created_at'  => $now,
                'updated_at'  => $now,
            ],
            [
                'code'        => 'WH-004',
                'name'        => 'Outlet Surabaya',
                'location'    => 'Jl. Basuki Rahmat No. 33, Surabaya Pusat',
                'city'        => 'Surabaya',
                'phone'       => '031-99887766',
                'description' => 'Outlet cabang Surabaya',
                'is_active'   => true,
                'is_default'  => false,
                'created_at'  => $now,
                'updated_at'  => $now,
            ],
        ]);
    }
}
