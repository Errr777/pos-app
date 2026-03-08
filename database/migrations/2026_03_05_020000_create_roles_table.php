<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('roles', function (Blueprint $table) {
            $table->id();
            $table->string('name', 50)->unique();
            $table->string('label', 100);
            $table->boolean('is_system')->default(false);
            $table->timestamps();
        });

        Schema::create('role_permissions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('role_id')->constrained()->onDelete('cascade');
            $table->string('module', 50);
            $table->boolean('can_view')->default(false);
            $table->boolean('can_write')->default(false);
            $table->boolean('can_delete')->default(false);
            $table->timestamps();
            $table->unique(['role_id', 'module']);
        });

        // Seed default roles
        $now = now();
        DB::table('roles')->insert([
            ['name' => 'admin',  'label' => 'Admin',  'is_system' => true,  'created_at' => $now, 'updated_at' => $now],
            ['name' => 'staff',  'label' => 'Staff',  'is_system' => false, 'created_at' => $now, 'updated_at' => $now],
            ['name' => 'kasir',  'label' => 'Kasir',  'is_system' => false, 'created_at' => $now, 'updated_at' => $now],
        ]);

        // Default permissions for staff: view+write on items & inventory, view reports
        $staffId = DB::table('roles')->where('name', 'staff')->value('id');
        $kasirId = DB::table('roles')->where('name', 'kasir')->value('id');

        $staffPerms = [
            ['module' => 'dashboard',  'can_view' => true,  'can_write' => false, 'can_delete' => false],
            ['module' => 'items',      'can_view' => true,  'can_write' => true,  'can_delete' => false],
            ['module' => 'inventory',  'can_view' => true,  'can_write' => true,  'can_delete' => false],
            ['module' => 'warehouses', 'can_view' => true,  'can_write' => true,  'can_delete' => false],
            ['module' => 'reports',    'can_view' => true,  'can_write' => false, 'can_delete' => false],
            ['module' => 'users',      'can_view' => false, 'can_write' => false, 'can_delete' => false],
        ];
        $kasirPerms = [
            ['module' => 'dashboard',  'can_view' => true,  'can_write' => false, 'can_delete' => false],
            ['module' => 'items',      'can_view' => true,  'can_write' => false, 'can_delete' => false],
            ['module' => 'inventory',  'can_view' => false, 'can_write' => false, 'can_delete' => false],
            ['module' => 'warehouses', 'can_view' => true,  'can_write' => false, 'can_delete' => false],
            ['module' => 'reports',    'can_view' => true,  'can_write' => false, 'can_delete' => false],
            ['module' => 'users',      'can_view' => false, 'can_write' => false, 'can_delete' => false],
        ];

        foreach ($staffPerms as $p) {
            DB::table('role_permissions')->insert(array_merge($p, ['role_id' => $staffId, 'created_at' => $now, 'updated_at' => $now]));
        }
        foreach ($kasirPerms as $p) {
            DB::table('role_permissions')->insert(array_merge($p, ['role_id' => $kasirId, 'created_at' => $now, 'updated_at' => $now]));
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('role_permissions');
        Schema::dropIfExists('roles');
    }
};
