<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('stock_opname_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('opname_id')->constrained('stock_opnames')->cascadeOnDelete();
            $table->foreignId('item_id')->nullable()->constrained('items')->nullOnDelete();
            $table->string('item_name_snapshot', 150);
            $table->string('item_code_snapshot', 100)->nullable();
            $table->integer('system_qty')->default(0);
            $table->integer('actual_qty')->nullable();
            $table->integer('variance')->nullable();
            $table->string('note', 500)->nullable();
            $table->unique(['opname_id', 'item_id']);
            $table->timestamps();
        });
    }
    public function down(): void { Schema::dropIfExists('stock_opname_items'); }
};
