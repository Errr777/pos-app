<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('transactions', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('txn_id', 64)->unique();
            $table->string('reference')->nullable()->index();
            $table->unsignedBigInteger('order_id')->nullable()->index();
            $table->unsignedBigInteger('customer_id')->nullable()->index();
            $table->unsignedBigInteger('item_id')->nullable()->index();
            $table->foreign('item_id')->references('id')->on('items')->onDelete('set null');
            $table->timestamp('occurred_at')->nullable()->index();
            $table->bigInteger('amount')->default(0);
            $table->string('currency', 10)->default('Rp');
            $table->string('status', 32)->index();
            $table->string('type', 32)->index();
            $table->bigInteger('fees')->nullable()->default(0);
            $table->bigInteger('net_amount')->nullable()->default(0);
            $table->string('actor')->nullable()->index();
            $table->string('source')->nullable()->index();
            $table->string('party')->nullable();
            $table->string('category')->nullable()->index();
            $table->string('qrcode')->nullable();
            $table->json('payment_method')->nullable();
            $table->json('metadata')->nullable();
            $table->text('note')->nullable();
            $table->timestamps();

            $table->index(['occurred_at', 'status']);
            $table->index(['occurred_at', 'type']);
            $table->index(['status', 'type']);
            $table->index(['customer_id', 'occurred_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('transactions');
    }
};