<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('delivery_orders', function (Blueprint $table) {
            $table->id();
            $table->string('do_number', 32)->unique()->index();
            $table->foreignId('from_warehouse_id')->constrained('warehouses');
            $table->foreignId('to_warehouse_id')->constrained('warehouses');
            // status: pending | confirmed | cancelled
            $table->string('status', 20)->default('pending')->index();
            // Sender (person dispatching from main outlet)
            $table->unsignedBigInteger('sender_id')->nullable();
            $table->foreign('sender_id')->references('id')->on('users')->nullOnDelete();
            $table->string('sender_name', 100)->nullable();
            // Recipient (person confirming receipt at outlet)
            $table->unsignedBigInteger('recipient_id')->nullable();
            $table->foreign('recipient_id')->references('id')->on('users')->nullOnDelete();
            $table->string('recipient_name', 100)->nullable();
            // Timestamps for events
            $table->timestamp('sent_at')->nullable();
            $table->timestamp('confirmed_at')->nullable();
            $table->text('note')->nullable();
            // Creator
            $table->unsignedBigInteger('created_by')->nullable();
            $table->foreign('created_by')->references('id')->on('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('delivery_orders');
    }
};
