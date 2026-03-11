<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('stock_opnames', function (Blueprint $table) {
            $table->id();
            $table->string('ref_number', 50)->unique();
            $table->foreignId('warehouse_id')->constrained()->cascadeOnDelete();
            $table->string('status', 20)->default('draft'); // draft | submitted
            $table->date('date');
            $table->string('created_by', 255)->nullable();
            $table->timestamp('submitted_at')->nullable();
            $table->text('note')->nullable();
            $table->timestamps();
        });
    }
    public function down(): void { Schema::dropIfExists('stock_opnames'); }
};
