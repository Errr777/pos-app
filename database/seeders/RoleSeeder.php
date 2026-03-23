<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * Adds the 'manajer' role with near-full permissions.
 *
 * Default roles (admin / staff / kasir) are seeded by the migration.
 * This seeder adds business-level roles that can be customised.
 *
 * Role capabilities:
 *   manajer  — view + write on all modules; can delete products/customers/POs/etc.
 *              cannot write/delete users (only admin can do that)
 */
class RoleSeeder extends Seeder
{
    public function run(): void
    {
        $now = now();

        // ── Manajer ─────────────────────────────────────────────────────────
        $mgrId = DB::table('roles')->insertGetId([
            'name'       => 'manajer',
            'label'      => 'Manajer',
            'is_system'  => false,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        $modules = [
            'dashboard', 'items', 'inventory', 'warehouses', 'reports',
            'suppliers', 'customers', 'pos', 'purchase_orders', 'returns', 'users',
        ];

        // Modules where manajer can also delete records
        $canDeleteModules = ['items', 'suppliers', 'customers', 'pos', 'purchase_orders', 'returns'];

        foreach ($modules as $module) {
            DB::table('role_permissions')->insert([
                'role_id'    => $mgrId,
                'module'     => $module,
                'can_view'   => true,
                'can_write'  => $module !== 'users',   // no user management
                'can_delete' => in_array($module, $canDeleteModules),
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }
}
