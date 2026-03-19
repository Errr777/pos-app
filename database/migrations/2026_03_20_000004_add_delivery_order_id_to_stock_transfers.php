<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('stock_transfers', function (Blueprint $table) {
            $table->unsignedBigInteger('delivery_order_id')->nullable()->after('status');
            $table->foreign('delivery_order_id')->references('id')->on('delivery_orders')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('stock_transfers', function (Blueprint $table) {
            $table->dropForeign(['delivery_order_id']);
            $table->dropColumn('delivery_order_id');
        });
    }
};
