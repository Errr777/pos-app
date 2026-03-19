<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('installment_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('installment_plan_id')->constrained('installment_plans')->cascadeOnDelete();
            $table->date('due_date')->index();
            $table->unsignedBigInteger('amount_due');
            $table->unsignedBigInteger('interest_amount')->default(0);
            $table->unsignedBigInteger('late_fee_applied')->default(0);
            $table->unsignedBigInteger('amount_paid')->default(0);
            $table->timestamp('paid_at')->nullable();
            $table->string('status', 20)->default('pending')->index(); // pending|paid|overdue|partial
            $table->string('payment_method', 30)->nullable();
            $table->unsignedBigInteger('recorded_by')->nullable();
            $table->text('note')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('installment_payments');
    }
};
