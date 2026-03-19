<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class AppSettingSeeder extends Seeder
{
    public function run(): void
    {
        $now = now();

        $settings = [
            'store_name'     => 'Nusantara Store',
            'store_address'  => 'Jl. Sudirman No. 12, Jakarta Pusat',
            'store_phone'    => '021-55001234',
            'receipt_footer' => 'Terima kasih telah berbelanja di Nusantara Store! • nusantarastore.id',
            'store_logo'     => null,
            'onboarding_done'=> '1',
        ];

        foreach ($settings as $key => $value) {
            DB::table('app_settings')
                ->where('key', $key)
                ->update(['value' => $value, 'updated_at' => $now]);
        }
    }
}
