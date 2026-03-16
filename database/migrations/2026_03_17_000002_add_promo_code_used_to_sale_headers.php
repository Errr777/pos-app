<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sale_headers', function (Blueprint $table) {
            $table->string('promo_code_used', 100)->nullable()->after('note');
        });
    }

    public function down(): void
    {
        Schema::table('sale_headers', function (Blueprint $table) {
            $table->dropColumn('promo_code_used');
        });
    }
};
