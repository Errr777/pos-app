<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::table('warehouses', function (Blueprint $table) {
            $table->string('phone', 20)->nullable()->after('location');
            $table->string('city', 100)->nullable()->after('phone');
        });
    }
    public function down(): void {
        Schema::table('warehouses', function (Blueprint $table) {
            $table->dropColumn(['phone', 'city']);
        });
    }
};
