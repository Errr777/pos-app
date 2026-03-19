<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('delivery_order_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('delivery_order_id')->constrained('delivery_orders')->cascadeOnDelete();
            $table->foreignId('item_id')->constrained('items');
            $table->string('item_name_snapshot', 255);
            $table->string('item_code_snapshot', 100)->nullable();
            $table->unsignedInteger('quantity');
            $table->unsignedBigInteger('unit_price');        // outlet price at time of creation
            $table->unsignedInteger('quantity_received')->nullable(); // null = not yet confirmed
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('delivery_order_items');
    }
};
