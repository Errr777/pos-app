<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sale_items', function (Blueprint $table) {
            $table->foreignId('variant_id')->nullable()->constrained('item_variants')->nullOnDelete()->after('item_id');
            $table->string('variant_name_snapshot', 100)->nullable()->after('item_code_snapshot');
        });
    }

    public function down(): void
    {
        Schema::table('sale_items', function (Blueprint $table) {
            $table->dropForeign(['variant_id']);
            $table->dropColumn(['variant_id', 'variant_name_snapshot']);
        });
    }
};
