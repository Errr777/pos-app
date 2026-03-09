<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sale_headers', function (Blueprint $table) {
            $table->id();
            $table->string('sale_number', 32)->unique()->index();
            $table->foreignId('warehouse_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('customer_id')->nullable()->constrained('customers')->nullOnDelete();
            $table->unsignedBigInteger('cashier_id')->nullable();
            $table->foreign('cashier_id')->references('id')->on('users')->nullOnDelete();
            $table->timestamp('occurred_at')->index();
            $table->unsignedBigInteger('subtotal')->default(0);
            $table->unsignedBigInteger('discount_amount')->default(0);
            $table->unsignedBigInteger('tax_amount')->default(0);
            $table->unsignedBigInteger('grand_total')->default(0);
            $table->string('payment_method', 30)->default('cash'); // cash, transfer, qris, card
            $table->unsignedBigInteger('payment_amount')->default(0);
            $table->unsignedBigInteger('change_amount')->default(0);
            $table->string('status', 20)->default('completed')->index(); // completed, void
            $table->text('note')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sale_headers');
    }
};
