<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('stock_adjustments', function (Blueprint $table) {
            $table->id();
            $table->string('txn_id', 30)->unique();
            $table->foreignId('warehouse_id')->constrained('warehouses');
            $table->foreignId('item_id')->constrained('items');
            $table->integer('old_quantity');   // stock before adjustment
            $table->integer('new_quantity');   // stock after adjustment
            $table->integer('difference');     // new - old (can be negative)
            $table->string('reason', 255)->nullable();
            $table->string('actor', 255)->nullable();
            $table->dateTime('occurred_at');
            $table->text('note')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stock_adjustments');
    }
};
