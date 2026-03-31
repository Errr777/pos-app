<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('sale_payment_splits', function (Blueprint $table) {
            $table->id();
            $table->foreignId('sale_header_id')->constrained()->cascadeOnDelete();
            $table->string('payment_method', 30);
            $table->unsignedBigInteger('amount');
            $table->timestamps();
            $table->index('sale_header_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('sale_payment_splits');
    }
};
