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
        Schema::create('license_config', function (Blueprint $table) {
            $table->id();
            $table->string('license_key');
            $table->string('panel_url');
            $table->boolean('valid')->default(false);
            $table->string('status')->nullable();
            $table->json('modules')->nullable();
            $table->unsignedInteger('max_users')->default(5);
            $table->unsignedInteger('max_outlets')->default(2);
            $table->timestamp('expires_at')->nullable();
            $table->string('last_reason')->nullable();
            $table->timestamp('last_synced_at')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('license_config');
    }
};
