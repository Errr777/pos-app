<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sale_headers', function (Blueprint $table) {
            $table->string('invoice_number', 30)->nullable()->unique()->after('sale_number');
            $table->timestamp('invoice_issued_at')->nullable()->after('invoice_number');
        });
    }

    public function down(): void
    {
        Schema::table('sale_headers', function (Blueprint $table) {
            $table->dropUnique(['invoice_number']);
            $table->dropColumn(['invoice_number', 'invoice_issued_at']);
        });
    }
};
