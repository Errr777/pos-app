<?php

namespace Database\Seeders;

use App\Models\Warehouse;
use Illuminate\Database\Seeder;

class WarehouseSeeder extends Seeder
{
    public function run(): void
    {
        $warehouses = [
            [
                'code'        => 'WH-001',
                'name'        => 'Gudang Utama',
                'city'        => 'Jakarta',
                'location'    => 'Jl. Raya Kebon Jeruk No. 10, Jakarta Barat',
                'phone'       => '021-53671234',
                'description' => 'Gudang pusat dan outlet utama',
                'is_active'   => true,
                'is_default'  => true,
            ],
            [
                'code'        => 'WH-002',
                'name'        => 'Outlet Semarang',
                'city'        => 'Semarang',
                'location'    => 'Jl. Pandanaran No. 25, Semarang Tengah',
                'phone'       => '024-84512345',
                'description' => 'Cabang Semarang',
                'is_active'   => true,
                'is_default'  => false,
            ],
            [
                'code'        => 'WH-003',
                'name'        => 'Outlet Bandung',
                'city'        => 'Bandung',
                'location'    => 'Jl. Dago No. 88, Bandung',
                'phone'       => '022-25123456',
                'description' => 'Cabang Bandung',
                'is_active'   => true,
                'is_default'  => false,
            ],
        ];

        foreach ($warehouses as $wh) {
            Warehouse::firstOrCreate(['code' => $wh['code']], $wh);
        }
    }
}
