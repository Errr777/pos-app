<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([
            AppSettingSeeder::class,     // store name, address, phone — marks onboarding done
            WarehouseSeeder::class,      // 4 warehouses (1 main + 3 outlets)
            KategoriSeeder::class,       // 10 categories
            TagSeeder::class,            // 8 tags
            SupplierSeeder::class,       // 7 suppliers
            CustomerSeeder::class,       // 20 customers
            ItemSeeder::class,           // 60 barang + 4 jasa, tags, low-stock items
            UserSeeder::class,           // admin + 5 users (2 staff, 3 kasir)
            PromotionSeeder::class,      // 5 promotions
            HistoricalDataSeeder::class, // 2024–2026: POs, sales, expenses, transfers
        ]);
    }
}
