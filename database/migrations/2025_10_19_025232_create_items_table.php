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
        Schema::create('items', function (Blueprint $table) {
            $table->id();
            $table->string('kode_item', 50)->unique();
            $table->string('nama', 100);
            $table->string('deskripsi', 255)->nullable();
            $table->integer('stok')->default(0);
            $table->integer('stok_minimal')->default(0);
            $table->string('kategori', 100)->nullable();
            $table->unsignedBigInteger('id_kategori')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('items');
    }
};
