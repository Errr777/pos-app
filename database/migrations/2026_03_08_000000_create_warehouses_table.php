<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('warehouses', function (Blueprint $table) {
            $table->id();
            $table->string('code', 20)->unique();
            $table->string('name', 100);
            $table->string('location', 255)->nullable();
            $table->text('description')->nullable();
            $table->boolean('is_active')->default(true);
            $table->boolean('is_default')->default(false);
            $table->timestamps();
        });

        Schema::create('warehouse_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('warehouse_id')->constrained()->onDelete('cascade');
            $table->foreignId('item_id')->constrained()->onDelete('cascade');
            $table->integer('stok')->default(0);
            $table->integer('stok_minimal')->default(0);
            $table->timestamps();
            $table->unique(['warehouse_id', 'item_id']);
        });

        // Add warehouse_id to transactions (without FK constraint for SQLite compat)
        Schema::table('transactions', function (Blueprint $table) {
            $table->unsignedBigInteger('warehouse_id')->nullable()->after('item_id');
            $table->index('warehouse_id');
        });

        // Seed default warehouse
        $now = now();
        DB::table('warehouses')->insert([
            'code'        => 'WH-MAIN',
            'name'        => 'Gudang Utama',
            'location'    => null,
            'description' => 'Gudang utama (default)',
            'is_active'   => true,
            'is_default'  => true,
            'created_at'  => $now,
            'updated_at'  => $now,
        ]);

        $whId = DB::table('warehouses')->where('code', 'WH-MAIN')->value('id');

        // Migrate existing items to warehouse_items
        $items = DB::table('items')->get(['id', 'stok', 'stok_minimal']);
        foreach ($items as $item) {
            DB::table('warehouse_items')->insert([
                'warehouse_id' => $whId,
                'item_id'      => $item->id,
                'stok'         => $item->stok,
                'stok_minimal' => $item->stok_minimal,
                'created_at'   => $now,
                'updated_at'   => $now,
            ]);
        }

        // Assign all existing transactions to default warehouse
        DB::table('transactions')->update(['warehouse_id' => $whId]);
    }

    public function down(): void
    {
        Schema::table('transactions', function (Blueprint $table) {
            $table->dropIndex(['warehouse_id']);
            $table->dropColumn('warehouse_id');
        });
        Schema::dropIfExists('warehouse_items');
        Schema::dropIfExists('warehouses');
    }
};
