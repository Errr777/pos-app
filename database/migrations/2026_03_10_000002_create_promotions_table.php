<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('promotions', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('code')->unique()->nullable();
            $table->enum('type', ['percentage', 'fixed'])->default('percentage');
            $table->integer('value');
            $table->enum('applies_to', ['all', 'category', 'item'])->default('all');
            $table->unsignedBigInteger('applies_id')->nullable();
            $table->integer('min_purchase')->default(0);
            $table->integer('max_discount')->default(0);
            $table->date('start_date');
            $table->date('end_date');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('promotions');
    }
};
