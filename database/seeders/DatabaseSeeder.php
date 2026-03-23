<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([
            AppSettingSeeder::class,      // store name, address, phone — marks onboarding done
            WarehouseSeeder::class,       // 4 warehouses: Toko Pusat (default) + 3 outlets
            KategoriSeeder::class,        // 10 categories
            TagSeeder::class,             // 8 tags
            SupplierSeeder::class,        // 7 suppliers
            CustomerSeeder::class,        // 20 customers
            ItemSeeder::class,            // 60 barang + 4 jasa, tags, low-stock items
            RoleSeeder::class,            // extra role: manajer (with near-full permissions)
            UserSeeder::class,            // 11 users: admin, manajer, 4 staff (per outlet), 5 kasir
            PromotionSeeder::class,       // 5 promotions
            HistoricalDataSeeder::class,  // Jan 2023–Mar 2026: POs, sales, expenses, transfers
        ]);
    }
}
