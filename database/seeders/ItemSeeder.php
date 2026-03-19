<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class ItemSeeder extends Seeder
{
    public function run(): void
    {
        $catMap  = DB::table('kategoris')->pluck('id', 'nama');
        $tagMap  = DB::table('tags')->pluck('id', 'name');
        $whIds   = DB::table('warehouses')->orderBy('id')->pluck('id')->toArray();
        $supIds  = DB::table('suppliers')->pluck('id')->toArray();

        // ─────────────────────────────────────────────────────────────────
        // Items definition:  [nama, kategori, harga_beli, harga_jual, stok, stok_minimal, low_stock?, tags[], supplier_idx]
        // low_stock = true  → stok <= stok_minimal (triggers notification)
        // ─────────────────────────────────────────────────────────────────
        $itemDefs = [
            // ── Elektronik ───────────────────────────────────────────────
            ['Smartphone Samsung A15',     'Elektronik',            2000000, 2800000, 45, 10, false, ['Best Seller', 'Flash Sale'], 0],
            ['Earphone Bluetooth TWS',     'Elektronik',             150000,  250000, 80, 15, false, ['Best Seller'],               0],
            ['Charger Fast Charging 65W',  'Elektronik',              80000,  150000,  4, 10, true,  ['Produk Baru'],               0], // LOW STOCK
            ['Power Bank 20000mAh',        'Elektronik',             200000,  350000, 60, 10, false, [],                            0],
            ['Kabel Data USB-C 1m',        'Elektronik',              15000,   35000, 120, 20, false, ['Flash Sale'],               0],
            ['Laptop Stand Aluminum',      'Elektronik',             120000,  220000, 35, 10, false, ['Produk Baru', 'Premium'],    0],

            // ── Pakaian ──────────────────────────────────────────────────
            ['Kaos Polos Premium',         'Pakaian',                 45000,   89000, 150, 20, false, ['Best Seller'],              1],
            ['Kemeja Batik Pria',          'Pakaian',                120000,  250000,  70, 15, false, ['Promo Ramadan'],            1],
            ['Celana Chino Slim Fit',      'Pakaian',                150000,  299000,  55, 10, false, [],                           1],
            ['Jaket Bomber Varsity',       'Pakaian',                250000,  450000,  40, 10, false, ['Premium'],                  1],
            ['Dress Midi Floral',          'Pakaian',                180000,  350000,  45, 10, false, ['Produk Baru'],              1],
            ['Hoodie Fleece Oversize',     'Pakaian',                200000,  389000,  60, 15, false, ['Best Seller', 'Flash Sale'],1],

            // ── Makanan ──────────────────────────────────────────────────
            ['Kopi Arabika Premium 250g',  'Makanan',                 45000,   85000,  90, 20, false, ['Makanan & Minuman', 'Best Seller'], 2],
            ['Biskuit Gandum Oat 400g',    'Makanan',                 12000,   22000, 200, 30, false, ['Makanan & Minuman'],        2],
            ['Coklat Batang 100g',         'Makanan',                 18000,   35000,   5, 20, true,  ['Flash Sale', 'Makanan & Minuman'], 2], // LOW STOCK
            ['Mie Instant Goreng Pack',    'Makanan',                  3000,    5500, 500, 50, false, ['Makanan & Minuman'],        2],
            ['Kurma Medjool Premium 500g', 'Makanan',                 75000,  145000,  80, 15, false, ['Premium', 'Promo Ramadan'],2],
            ['Keripik Tempe Renyah',       'Makanan',                  8000,   15000, 300, 50, false, ['Makanan & Minuman'],        2],

            // ── Minuman ──────────────────────────────────────────────────
            ['Air Mineral 1.5L',           'Minuman',                  4000,    7500,   8, 30, true,  ['Makanan & Minuman'],        2], // LOW STOCK
            ['Teh Botol Manis 350ml',      'Minuman',                  4500,    8000, 400, 50, false, ['Makanan & Minuman'],        2],
            ['Jus Jeruk Segar 300ml',      'Minuman',                  8000,   15000, 120, 20, false, ['Makanan & Minuman', 'Produk Baru'], 2],
            ['Susu Full Cream 1L',         'Minuman',                 15000,   25000, 180, 30, false, ['Makanan & Minuman'],        2],
            ['Minuman Energi 250ml',       'Minuman',                  7000,   12000, 250, 40, false, ['Makanan & Minuman'],        2],
            ['Yogurt Drink Berry 200ml',   'Minuman',                  8000,   16000,  70, 20, false, ['Produk Baru', 'Makanan & Minuman'], 2],

            // ── Peralatan Rumah Tangga ───────────────────────────────────
            ['Sapu Lantai Premium',        'Peralatan Rumah Tangga',  25000,   45000,  80, 15, false, [],                           6],
            ['Ember Plastik 20L',          'Peralatan Rumah Tangga',  18000,   35000, 100, 20, false, [],                           6],
            ['Panci Stainless 24cm',       'Peralatan Rumah Tangga', 120000,  250000,  50, 10, false, ['Best Seller'],              6],
            ['Lampu LED 10W',              'Peralatan Rumah Tangga',  15000,   35000,   6, 15, true,  ['Flash Sale'],               6], // LOW STOCK
            ['Dispenser Galon Standing',   'Peralatan Rumah Tangga', 350000,  650000,  20,  5, false, ['Premium'],                  6],
            ['Rak Piring Stainless',       'Peralatan Rumah Tangga',  80000,  150000,  35, 10, false, [],                           6],

            // ── Aksesoris ────────────────────────────────────────────────
            ['Dompet Kulit Pria Slim',     'Aksesoris',              120000,  250000,  60, 10, false, ['Premium', 'Best Seller'],   1],
            ['Tas Selempang Mini',         'Aksesoris',              150000,  299000,  55, 10, false, ['Produk Baru'],              1],
            ['Jam Tangan Analog Pria',     'Aksesoris',              200000,  399000,  40, 10, false, ['Premium'],                  1],
            ['Kacamata Hitam Polarized',   'Aksesoris',              100000,  199000,  65, 15, false, ['Flash Sale'],               1],
            ['Ikat Pinggang Kulit',        'Aksesoris',               80000,  150000,  70, 15, false, [],                           1],
            ['Kalung Silver 925',          'Aksesoris',              250000,  450000,  25,  5, false, ['Premium', 'Limited Edition'],1],

            // ── Otomotif ─────────────────────────────────────────────────
            ['Oli Mesin 10W-40 1L',        'Otomotif',                60000,   95000,   3, 10, true,  [],                           5], // LOW STOCK
            ['Filter Udara Motor',         'Otomotif',                35000,   65000,  80, 15, false, [],                           5],
            ['Busi NGK Standard',          'Otomotif',                25000,   45000, 100, 20, false, [],                           5],
            ['Rantai Motor 428H 110L',     'Otomotif',                80000,  150000,  45, 10, false, [],                           5],
            ['Pengharum Mobil Freshener',  'Otomotif',                15000,   30000, 150, 25, false, ['Flash Sale'],               5],
            ['Kit Poles Mobil Premium',    'Otomotif',                45000,   90000,  60, 10, false, ['Premium'],                  5],

            // ── Kesehatan ────────────────────────────────────────────────
            ['Masker KN95 isi 10',         'Kesehatan',               25000,   50000,   4, 10, true,  [],                           3], // LOW STOCK
            ['Vitamin C 500mg isi 30',     'Kesehatan',               45000,   90000, 120, 20, false, ['Best Seller'],              3],
            ['Termometer Digital',         'Kesehatan',               80000,  150000,  40, 10, false, ['Produk Baru'],              3],
            ['Plester Luka 100pcs',        'Kesehatan',               15000,   30000, 200, 30, false, [],                           3],
            ['Hand Sanitizer 500ml',       'Kesehatan',               25000,   50000,  90, 20, false, [],                           3],
            ['Timbangan Badan Digital',    'Kesehatan',              120000,  250000,  30,  5, false, ['Produk Baru'],              3],

            // ── Kecantikan ───────────────────────────────────────────────
            ['Vitamin C Serum 30ml',       'Kecantikan',              80000,  175000,  70, 15, false, ['Best Seller', 'Premium'],   4],
            ['Pelembab Wajah SPF50',       'Kecantikan',             120000,  250000,  60, 10, false, ['Premium'],                  4],
            ['Lipstik Matte Tahan Lama',   'Kecantikan',              45000,   95000,   5, 10, true,  ['Flash Sale'],               4], // LOW STOCK
            ['Sabun Wajah Gentle Foam',    'Kecantikan',              35000,   75000, 100, 20, false, ['Best Seller'],              4],
            ['Parfum Roll-On 10ml',        'Kecantikan',              30000,   65000,  80, 15, false, ['Limited Edition'],          4],
            ['Masker Rambut Keratin 250ml','Kecantikan',              50000,   95000,  55, 10, false, ['Produk Baru'],              4],

            // ── Alat Tulis Kantor ────────────────────────────────────────
            ['Pulpen Gel 0.5mm isi 12',    'Alat Tulis Kantor',        5000,   10000,   6, 20, true,  [],                           6], // LOW STOCK
            ['Buku Tulis A5 100lbr',       'Alat Tulis Kantor',        8000,   15000, 400, 50, false, [],                           6],
            ['Sticky Note 100lbr Warna',   'Alat Tulis Kantor',       10000,   20000, 250, 30, false, [],                           6],
            ['Stapler + Isi 24/6',         'Alat Tulis Kantor',       25000,   50000,  80, 15, false, [],                           6],
            ['Spidol Whiteboard 4pcs',     'Alat Tulis Kantor',       12000,   22000, 120, 20, false, [],                           6],
            ['Penggaris Besi 30cm',        'Alat Tulis Kantor',        5000,   10000, 200, 30, false, [],                           6],
        ];

        $now = now();
        foreach ($itemDefs as $idx => $def) {
            [$nama, $katNama, $hargaBeli, $hargaJual, $stok, $stokMin, $lowStock, $tagNames, $supIdx] = $def;

            $kodeItem   = 'BRG-' . str_pad($idx + 1, 3, '0', STR_PAD_LEFT);
            $idKategori = $catMap[$katNama] ?? null;
            $supId      = $supIds[$supIdx] ?? null;

            // If low_stock, set stok below stok_minimal
            if ($lowStock) {
                $stok = rand(1, (int) ($stokMin * 0.4));
            }

            $itemId = DB::table('items')->insertGetId([
                'kode_item'            => $kodeItem,
                'nama'                 => $nama,
                'deskripsi'            => $nama . ' berkualitas tinggi, cocok untuk kebutuhan sehari-hari.',
                'stok'                 => $stok,
                'stok_minimal'         => $stokMin,
                'harga_beli'           => $hargaBeli,
                'harga_jual'           => $hargaJual,
                'kategori'             => $katNama,
                'id_kategori'          => $idKategori,
                'type'                 => 'barang',
                'preferred_supplier_id'=> $supId,
                'created_at'           => $now,
                'updated_at'           => $now,
            ]);

            // Distribute stock across warehouses (main gets ~50%, others split the rest)
            $stockSplits = $this->splitStock($stok, count($whIds));
            foreach ($whIds as $i => $whId) {
                DB::table('warehouse_items')->insert([
                    'warehouse_id' => $whId,
                    'item_id'      => $itemId,
                    'stok'         => $stockSplits[$i],
                    'stok_minimal' => $i === 0 ? $stokMin : (int) ceil($stokMin * 0.5),
                    'created_at'   => $now,
                    'updated_at'   => $now,
                ]);
            }

            // Attach tags
            foreach ($tagNames as $tagName) {
                $tagId = $tagMap[$tagName] ?? null;
                if ($tagId) {
                    DB::table('item_tag')->insert([
                        'item_id' => $itemId,
                        'tag_id'  => $tagId,
                    ]);
                }
            }
        }

        // ── 4 Jasa items ─────────────────────────────────────────────────
        $jasaItems = [
            ['Instalasi AC Split',       'Elektronik',  150000,  300000],
            ['Servis Elektronik',        'Elektronik',   75000,  150000],
            ['Pengiriman Express',       'Aksesoris',    25000,   50000],
            ['Konsultasi IT 1 Jam',      'Elektronik',  200000,  400000],
        ];

        foreach ($jasaItems as $ji => $j) {
            [$nama, $katNama, $hargaBeli, $hargaJual] = $j;
            $idKategori = $catMap[$katNama] ?? null;
            DB::table('items')->insert([
                'kode_item'   => 'JSA-' . str_pad($ji + 1, 3, '0', STR_PAD_LEFT),
                'nama'        => $nama,
                'deskripsi'   => 'Layanan jasa profesional: ' . $nama,
                'stok'        => 0,
                'stok_minimal'=> 0,
                'harga_beli'  => $hargaBeli,
                'harga_jual'  => $hargaJual,
                'kategori'    => $katNama,
                'id_kategori' => $idKategori,
                'type'        => 'jasa',
                'created_at'  => $now,
                'updated_at'  => $now,
            ]);
        }
    }

    private function splitStock(int $total, int $count): array
    {
        if ($count === 1) {
            return [$total];
        }
        // Main warehouse gets ~50%, rest split equally
        $main  = (int) round($total * 0.5);
        $rest  = $total - $main;
        $each  = (int) floor($rest / ($count - 1));
        $splits = [$main];
        for ($i = 1; $i < $count; $i++) {
            $splits[] = $each;
        }
        // Remainder goes to last warehouse
        $splits[$count - 1] += $rest - ($each * ($count - 1));
        return $splits;
    }
}
