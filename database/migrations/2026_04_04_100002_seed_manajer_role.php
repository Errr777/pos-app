<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Skip if already exists
        if (DB::table('roles')->where('name', 'manajer')->exists()) {
            return;
        }

        $now   = now();
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
        $canDeleteModules = ['items', 'suppliers', 'customers', 'pos', 'purchase_orders', 'returns'];

        foreach ($modules as $module) {
            DB::table('role_permissions')->insert([
                'role_id'    => $mgrId,
                'module'     => $module,
                'can_view'   => true,
                'can_write'  => $module !== 'users',
                'can_delete' => in_array($module, $canDeleteModules),
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }

    public function down(): void
    {
        $mgrId = DB::table('roles')->where('name', 'manajer')->value('id');
        if ($mgrId) {
            DB::table('role_permissions')->where('role_id', $mgrId)->delete();
            DB::table('roles')->where('id', $mgrId)->delete();
        }
    }
};
