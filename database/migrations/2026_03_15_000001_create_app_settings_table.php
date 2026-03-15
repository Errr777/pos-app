<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('app_settings', function (Blueprint $table) {
            $table->string('key')->primary();
            $table->text('value')->nullable();
            $table->timestamps();
        });

        DB::table('app_settings')->insert([
            ['key' => 'store_name',      'value' => 'Toko Saya',     'created_at' => now(), 'updated_at' => now()],
            ['key' => 'store_address',   'value' => null,            'created_at' => now(), 'updated_at' => now()],
            ['key' => 'store_phone',     'value' => null,            'created_at' => now(), 'updated_at' => now()],
            ['key' => 'store_logo',      'value' => null,            'created_at' => now(), 'updated_at' => now()],
            ['key' => 'receipt_footer',  'value' => 'Terima kasih!', 'created_at' => now(), 'updated_at' => now()],
            ['key' => 'onboarding_done', 'value' => '0',             'created_at' => now(), 'updated_at' => now()],
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('app_settings');
    }
};
