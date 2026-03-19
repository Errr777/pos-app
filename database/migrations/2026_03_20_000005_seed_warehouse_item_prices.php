<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Seed warehouse_item_prices for all existing warehouse-item combinations
     * using the global harga_jual as default price.
     */
    public function up(): void
    {
        $now = now();

        // Build rows: every warehouse × every item (barang only, jasa has no sell price)
        $warehouses = DB::table('warehouses')->pluck('id');
        $items = DB::table('items')->select('id', 'harga_jual')->get();

        $rows = [];
        foreach ($warehouses as $whId) {
            foreach ($items as $item) {
                $rows[] = [
                    'warehouse_id' => $whId,
                    'item_id' => $item->id,
                    'harga_jual' => $item->harga_jual,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            }
        }

        // Insert in chunks to avoid hitting query limits
        foreach (array_chunk($rows, 500) as $chunk) {
            DB::table('warehouse_item_prices')->insertOrIgnore($chunk);
        }
    }

    public function down(): void
    {
        DB::table('warehouse_item_prices')->truncate();
    }
};
