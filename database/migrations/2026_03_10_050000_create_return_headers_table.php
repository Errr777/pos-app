<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('return_headers', function (Blueprint $table) {
            $table->id();
            $table->string('return_number', 32)->unique()->index();
            $table->string('type', 20)->index(); // customer_return, supplier_return
            $table->foreignId('sale_header_id')->nullable()->constrained('sale_headers')->nullOnDelete();
            $table->foreignId('purchase_order_id')->nullable()->constrained('purchase_orders')->nullOnDelete();
            $table->foreignId('customer_id')->nullable()->constrained('customers')->nullOnDelete();
            $table->foreignId('supplier_id')->nullable()->constrained('suppliers')->nullOnDelete();
            $table->foreignId('warehouse_id')->nullable()->constrained()->nullOnDelete();
            $table->unsignedBigInteger('processed_by')->nullable();
            $table->foreign('processed_by')->references('id')->on('users')->nullOnDelete();
            $table->timestamp('occurred_at')->index();
            $table->string('status', 20)->default('completed'); // completed, void
            $table->unsignedBigInteger('total_amount')->default(0);
            $table->string('reason', 255)->nullable();
            $table->text('note')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('return_headers');
    }
};
