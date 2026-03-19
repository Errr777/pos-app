<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class CustomerSeeder extends Seeder
{
    public function run(): void
    {
        $now = now();
        DB::table('customers')->insert([
            ['code' => 'CUST-001', 'name' => 'Andi Firmansyah',        'phone' => '081234567801', 'email' => 'andi.f@gmail.com',         'city' => 'Jakarta',   'is_active' => true, 'created_at' => $now, 'updated_at' => $now],
            ['code' => 'CUST-002', 'name' => 'Budi Hartono',           'phone' => '081234567802', 'email' => 'budi.h@gmail.com',          'city' => 'Depok',     'is_active' => true, 'created_at' => $now, 'updated_at' => $now],
            ['code' => 'CUST-003', 'name' => 'Citra Lestari',          'phone' => '081234567803', 'email' => 'citra.l@gmail.com',         'city' => 'Bandung',   'is_active' => true, 'created_at' => $now, 'updated_at' => $now],
            ['code' => 'CUST-004', 'name' => 'Dimas Nugraha',          'phone' => '081234567804', 'email' => 'dimas.n@yahoo.com',         'city' => 'Bogor',     'is_active' => true, 'created_at' => $now, 'updated_at' => $now],
            ['code' => 'CUST-005', 'name' => 'Eka Putri Rahayu',       'phone' => '081234567805', 'email' => 'eka.pr@gmail.com',          'city' => 'Semarang',  'is_active' => true, 'created_at' => $now, 'updated_at' => $now],
            ['code' => 'CUST-006', 'name' => 'Fajar Setiawan',         'phone' => '081234567806', 'email' => 'fajar.s@gmail.com',         'city' => 'Surabaya',  'is_active' => true, 'created_at' => $now, 'updated_at' => $now],
            ['code' => 'CUST-007', 'name' => 'Gita Maharani',          'phone' => '081234567807', 'email' => 'gita.m@hotmail.com',        'city' => 'Yogyakarta','is_active' => true, 'created_at' => $now, 'updated_at' => $now],
            ['code' => 'CUST-008', 'name' => 'Hendra Kusuma',          'phone' => '081234567808', 'email' => 'hendra.k@gmail.com',        'city' => 'Malang',    'is_active' => true, 'created_at' => $now, 'updated_at' => $now],
            ['code' => 'CUST-009', 'name' => 'Indah Permata Sari',     'phone' => '081234567809', 'email' => 'indah.ps@gmail.com',        'city' => 'Medan',     'is_active' => true, 'created_at' => $now, 'updated_at' => $now],
            ['code' => 'CUST-010', 'name' => 'Joko Santoso',           'phone' => '081234567810', 'email' => 'joko.s@yahoo.com',          'city' => 'Solo',      'is_active' => true, 'created_at' => $now, 'updated_at' => $now],
            ['code' => 'CUST-011', 'name' => 'Kartika Dewi',           'phone' => '081234567811', 'email' => 'kartika.d@gmail.com',       'city' => 'Makassar',  'is_active' => true, 'created_at' => $now, 'updated_at' => $now],
            ['code' => 'CUST-012', 'name' => 'Lukman Hakim',           'phone' => '081234567812', 'email' => 'lukman.h@gmail.com',        'city' => 'Palembang', 'is_active' => true, 'created_at' => $now, 'updated_at' => $now],
            ['code' => 'CUST-013', 'name' => 'Maya Anggraeni',         'phone' => '081234567813', 'email' => 'maya.a@gmail.com',          'city' => 'Balikpapan','is_active' => true, 'created_at' => $now, 'updated_at' => $now],
            ['code' => 'CUST-014', 'name' => 'Nanda Prasetyo',         'phone' => '081234567814', 'email' => 'nanda.p@yahoo.com',         'city' => 'Pontianak', 'is_active' => true, 'created_at' => $now, 'updated_at' => $now],
            ['code' => 'CUST-015', 'name' => 'Olivia Santika',         'phone' => '081234567815', 'email' => 'olivia.s@gmail.com',        'city' => 'Denpasar',  'is_active' => true, 'created_at' => $now, 'updated_at' => $now],
            ['code' => 'CUST-016', 'name' => 'PT Maju Bersama',        'phone' => '021-44556600', 'email' => 'purchasing@majubersama.co.id','city' => 'Jakarta',  'is_active' => true, 'created_at' => $now, 'updated_at' => $now],
            ['code' => 'CUST-017', 'name' => 'CV Toko Sejahtera',      'phone' => '022-33441100', 'email' => 'order@tokosejahtera.com',   'city' => 'Bandung',   'is_active' => true, 'created_at' => $now, 'updated_at' => $now],
            ['code' => 'CUST-018', 'name' => 'UD Warung Barokah',      'phone' => '031-66778899', 'email' => 'warungbarokah@gmail.com',   'city' => 'Surabaya',  'is_active' => true, 'created_at' => $now, 'updated_at' => $now],
            ['code' => 'CUST-019', 'name' => 'Priskila Wulandari',     'phone' => '081234567819', 'email' => 'priskila.w@gmail.com',      'city' => 'Manado',    'is_active' => true, 'created_at' => $now, 'updated_at' => $now],
            ['code' => 'CUST-020', 'name' => 'Rizky Ramadhan',         'phone' => '081234567820', 'email' => 'rizky.r@gmail.com',         'city' => 'Pekanbaru', 'is_active' => true, 'created_at' => $now, 'updated_at' => $now],
        ]);
    }
}
