<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

/**
 * Seeds 11 realistic users across 4 outlets.
 *
 * Demo password for ALL users: 12345678
 *
 * Org structure
 * ─────────────────────────────────────────────────────────────
 * admin           Administrator          → all outlets (no restriction)
 * manajer         Budi Santoso           → all outlets (no restriction)
 * staff           Rina Wulandari         → Toko Pusat (WH-001)
 * staff           Ahmad Fauzi            → Outlet Semarang (WH-002)
 * staff           Dewi Anggraeni         → Outlet Bandung (WH-003)
 * staff           Wahyu Tri Pamungkas    → Outlet Surabaya (WH-004)
 * kasir           Dika Pratama           → Toko Pusat (WH-001)
 * kasir           Sari Dewi              → Toko Pusat (WH-001)
 * kasir           Fauzan Ramadhan        → Outlet Semarang (WH-002)
 * kasir           Nita Rahayu            → Outlet Bandung (WH-003)
 * kasir           Rizal Efendi           → Outlet Surabaya (WH-004)
 * ─────────────────────────────────────────────────────────────
 */
class UserSeeder extends Seeder
{
    public function run(): void
    {
        $now = now();
        $pwd = Hash::make('12345678');

        // ── User definitions ────────────────────────────────────────────────
        // [name, email, role]
        $users = [
            ['Administrator',        'admin@pos.com',            'admin'],
            ['Budi Santoso',         'budi.santoso@pos.com',     'manajer'],   // Manager Operasional
            ['Rina Wulandari',       'rina.wulandari@pos.com',   'staff'],     // Staff Gudang Pusat
            ['Ahmad Fauzi',          'ahmad.fauzi@pos.com',      'staff'],     // Kepala Toko Semarang
            ['Dewi Anggraeni',       'dewi.anggraeni@pos.com',   'staff'],     // Kepala Toko Bandung
            ['Wahyu Tri Pamungkas',  'wahyu.tri@pos.com',        'staff'],     // Kepala Toko Surabaya
            ['Dika Pratama',         'dika.pratama@pos.com',     'kasir'],     // Kasir Pusat (shift 1)
            ['Sari Dewi',            'sari.dewi@pos.com',        'kasir'],     // Kasir Pusat (shift 2)
            ['Fauzan Ramadhan',      'fauzan.ramadhan@pos.com',  'kasir'],     // Kasir Semarang
            ['Nita Rahayu',          'nita.rahayu@pos.com',      'kasir'],     // Kasir Bandung
            ['Rizal Efendi',         'rizal.efendi@pos.com',     'kasir'],     // Kasir Surabaya
        ];

        foreach ($users as [$name, $email, $role]) {
            DB::table('users')->insert([
                'name'              => $name,
                'email'             => $email,
                'role'              => $role,
                'password'          => $pwd,
                'email_verified_at' => $now,
                'created_at'        => $now,
                'updated_at'        => $now,
            ]);
        }

        // ── Warehouse assignments ────────────────────────────────────────────
        // Fetch IDs in creation order (WH-001 → WH-004)
        $whIds = DB::table('warehouses')->orderBy('id')->pluck('id', 'code');

        $wh001 = $whIds['WH-001'] ?? null;
        $wh002 = $whIds['WH-002'] ?? null;
        $wh003 = $whIds['WH-003'] ?? null;
        $wh004 = $whIds['WH-004'] ?? null;

        // [email => [warehouse_ids]]
        // Admin and manajer have NO entries → access all warehouses
        $assignments = [
            'rina.wulandari@pos.com'  => [$wh001],
            'ahmad.fauzi@pos.com'     => [$wh002],
            'dewi.anggraeni@pos.com'  => [$wh003],
            'wahyu.tri@pos.com'       => [$wh004],
            'dika.pratama@pos.com'    => [$wh001],
            'sari.dewi@pos.com'       => [$wh001],
            'fauzan.ramadhan@pos.com' => [$wh002],
            'nita.rahayu@pos.com'     => [$wh003],
            'rizal.efendi@pos.com'    => [$wh004],
        ];

        $userIds = DB::table('users')->pluck('id', 'email');

        foreach ($assignments as $email => $warehouseIds) {
            $userId = $userIds[$email] ?? null;
            if (! $userId) {
                continue;
            }
            foreach (array_filter($warehouseIds) as $whId) {
                DB::table('user_warehouses')->insert([
                    'user_id'      => $userId,
                    'warehouse_id' => $whId,
                ]);
            }
        }
    }
}
