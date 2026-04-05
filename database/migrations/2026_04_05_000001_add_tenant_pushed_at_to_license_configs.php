<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::table('license_config', function (Blueprint $table) {
            $table->timestamp('tenant_pushed_at')->nullable()->after('last_synced_at');
        });
    }

    public function down(): void {
        Schema::table('license_config', function (Blueprint $table) {
            $table->dropColumn('tenant_pushed_at');
        });
    }
};
