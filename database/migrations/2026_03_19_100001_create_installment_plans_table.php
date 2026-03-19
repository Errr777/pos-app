<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('installment_plans', function (Blueprint $table) {
            $table->id();
            $table->foreignId('sale_header_id')->constrained('sale_headers')->cascadeOnDelete();
            $table->foreignId('customer_id')->constrained('customers');
            $table->unsignedBigInteger('total_amount');
            $table->unsignedBigInteger('paid_amount')->default(0);
            $table->unsignedInteger('installment_count');
            $table->decimal('interest_rate', 5, 2)->default(0.00);
            $table->unsignedBigInteger('late_fee_amount')->default(0);
            $table->string('status', 20)->default('active')->index(); // active|completed|overdue|cancelled
            $table->text('note')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('installment_plans');
    }
};
