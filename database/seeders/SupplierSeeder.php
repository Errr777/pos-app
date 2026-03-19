<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class SupplierSeeder extends Seeder
{
    public function run(): void
    {
        $now = now();
        DB::table('suppliers')->insert([
            [
                'code'           => 'SUP-001',
                'name'           => 'PT Sumber Rejeki Elektronik',
                'contact_person' => 'Hendra Wijaya',
                'phone'          => '021-55009900',
                'email'          => 'hendra@sumberrejeki.co.id',
                'city'           => 'Jakarta',
                'is_active'      => true,
                'created_at'     => $now,
                'updated_at'     => $now,
            ],
            [
                'code'           => 'SUP-002',
                'name'           => 'CV Mitra Sandang Nusantara',
                'contact_person' => 'Dewi Pratiwi',
                'phone'          => '022-87654321',
                'email'          => 'dewi@mitrasandang.com',
                'city'           => 'Bandung',
                'is_active'      => true,
                'created_at'     => $now,
                'updated_at'     => $now,
            ],
            [
                'code'           => 'SUP-003',
                'name'           => 'UD Berkah Pangan Sejahtera',
                'contact_person' => 'Slamet Raharjo',
                'phone'          => '031-77665544',
                'email'          => 'slamet@berkahpangan.id',
                'city'           => 'Surabaya',
                'is_active'      => true,
                'created_at'     => $now,
                'updated_at'     => $now,
            ],
            [
                'code'           => 'SUP-004',
                'name'           => 'PT Global Pharma Indonesia',
                'contact_person' => 'dr. Anisa Permata',
                'phone'          => '024-33221100',
                'email'          => 'anisa@globalpharma.co.id',
                'city'           => 'Semarang',
                'is_active'      => true,
                'created_at'     => $now,
                'updated_at'     => $now,
            ],
            [
                'code'           => 'SUP-005',
                'name'           => 'CV Kecantikan Nusantara',
                'contact_person' => 'Rika Handayani',
                'phone'          => '021-44556677',
                'email'          => 'rika@kecantikannusantara.com',
                'city'           => 'Tangerang',
                'is_active'      => true,
                'created_at'     => $now,
                'updated_at'     => $now,
            ],
            [
                'code'           => 'SUP-006',
                'name'           => 'PT Auto Parts Indonesia',
                'contact_person' => 'Budi Santoso',
                'phone'          => '021-88990011',
                'email'          => 'budi@autoparts.co.id',
                'city'           => 'Bekasi',
                'is_active'      => true,
                'created_at'     => $now,
                'updated_at'     => $now,
            ],
            [
                'code'           => 'SUP-007',
                'name'           => 'UD Peralatan Jaya Abadi',
                'contact_person' => 'Wahyu Nugroho',
                'phone'          => '031-55443322',
                'email'          => 'wahyu@peralatanjaya.id',
                'city'           => 'Sidoarjo',
                'is_active'      => true,
                'created_at'     => $now,
                'updated_at'     => $now,
            ],
        ]);
    }
}
