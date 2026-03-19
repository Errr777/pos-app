<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('installment_plans', function (Blueprint $table) {
            $table->string('invoice_number', 30)->nullable()->unique()->after('id');
            $table->timestamp('invoice_issued_at')->nullable()->after('invoice_number');
        });
    }
    public function down(): void
    {
        Schema::table('installment_plans', function (Blueprint $table) {
            $table->dropUnique(['invoice_number']);
            $table->dropColumn(['invoice_number', 'invoice_issued_at']);
        });
    }
};
