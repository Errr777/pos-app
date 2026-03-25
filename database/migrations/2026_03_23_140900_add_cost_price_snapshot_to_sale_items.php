<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('sale_items', function (Blueprint $table) {
            $table->unsignedBigInteger('cost_price_snapshot')->default(0)->after('unit_price');
        });

        // Backfill existing rows from current item purchase price (subquery works on both SQLite and MySQL)
        DB::statement('
            UPDATE sale_items
            SET cost_price_snapshot = (
                SELECT harga_beli FROM items WHERE items.id = sale_items.item_id
            )
            WHERE cost_price_snapshot = 0
        ');
    }

    public function down(): void
    {
        Schema::table('sale_items', function (Blueprint $table) {
            $table->dropColumn('cost_price_snapshot');
        });
    }
};
