<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('warehouse_item_prices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('warehouse_id')->constrained('warehouses')->cascadeOnDelete();
            $table->foreignId('item_id')->constrained('items')->cascadeOnDelete();
            $table->unsignedBigInteger('harga_jual')->default(0);
            $table->timestamps();
            $table->unique(['warehouse_id', 'item_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('warehouse_item_prices');
    }
};
