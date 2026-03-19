<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class UserSeeder extends Seeder
{
    public function run(): void
    {
        $now = now();
        $password = Hash::make('12345678');

        $users = [
            // Admin — full access
            [
                'name'              => 'Administrator',
                'email'             => 'admin@pos.com',
                'role'              => 'admin',
                'password'          => $password,
                'email_verified_at' => $now,
                'created_at'        => $now,
                'updated_at'        => $now,
            ],
            // Staff 1
            [
                'name'              => 'Budi Santoso',
                'email'             => 'budi.santoso@pos.com',
                'role'              => 'staff',
                'password'          => $password,
                'email_verified_at' => $now,
                'created_at'        => $now,
                'updated_at'        => $now,
            ],
            // Staff 2
            [
                'name'              => 'Rina Wulandari',
                'email'             => 'rina.wulandari@pos.com',
                'role'              => 'staff',
                'password'          => $password,
                'email_verified_at' => $now,
                'created_at'        => $now,
                'updated_at'        => $now,
            ],
            // Kasir 1
            [
                'name'              => 'Dika Pratama',
                'email'             => 'dika.pratama@pos.com',
                'role'              => 'kasir',
                'password'          => $password,
                'email_verified_at' => $now,
                'created_at'        => $now,
                'updated_at'        => $now,
            ],
            // Kasir 2
            [
                'name'              => 'Sari Dewi',
                'email'             => 'sari.dewi@pos.com',
                'role'              => 'kasir',
                'password'          => $password,
                'email_verified_at' => $now,
                'created_at'        => $now,
                'updated_at'        => $now,
            ],
            // Kasir 3
            [
                'name'              => 'Fauzan Ramadhan',
                'email'             => 'fauzan.ramadhan@pos.com',
                'role'              => 'kasir',
                'password'          => $password,
                'email_verified_at' => $now,
                'created_at'        => $now,
                'updated_at'        => $now,
            ],
        ];

        foreach ($users as $user) {
            DB::table('users')->insert($user);
        }

        // Assign kasir to specific warehouses
        $whIds    = DB::table('warehouses')->orderBy('id')->pluck('id')->toArray();
        $kasirIds = DB::table('users')->where('role', 'kasir')->pluck('id')->toArray();

        // Kasir 1 → Toko Pusat + Outlet Semarang
        // Kasir 2 → Outlet Bandung
        // Kasir 3 → Outlet Surabaya
        $assignments = [
            0 => [0, 1],
            1 => [2],
            2 => [3],
        ];

        foreach ($kasirIds as $ki => $kasirId) {
            $whIndexes = $assignments[$ki] ?? [0];
            foreach ($whIndexes as $wi) {
                if (isset($whIds[$wi])) {
                    DB::table('user_warehouses')->insert([
                        'user_id'      => $kasirId,
                        'warehouse_id' => $whIds[$wi],
                    ]);
                }
            }
        }
    }
}
