<?php

namespace Database\Seeders;

use App\Models\Customer;
use App\Models\Item;
use App\Models\Kategori;
use App\Models\Promotion;
use App\Models\SaleHeader;
use App\Models\SaleItem;
use App\Models\StockAdjustment;
use App\Models\StockTransfer;
use App\Models\Supplier;
use App\Models\Tag;
use App\Models\Transaction;
use App\Models\Warehouse;
use App\Models\WarehouseItem;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class DummyDataSeeder extends Seeder
{
    public function run(): void
    {
        $wh1 = Warehouse::find(1); // Gudang Utama
        $wh2 = Warehouse::find(2); // Gudang-2
        $adminId = 1;
        $kasirId = 3;

        // ── 1. TAGS ──────────────────────────────────────────────────────────
        $this->command->info('Seeding tags...');

        $tagDefs = [
            ['name' => 'Flash Sale',       'color' => '#ef4444'],
            ['name' => 'Promo Lebaran',    'color' => '#f59e0b'],
            ['name' => 'Produk Baru',      'color' => '#6366f1'],
            ['name' => 'Best Seller',      'color' => '#10b981'],
            ['name' => 'Premium',          'color' => '#8b5cf6'],
            ['name' => 'Makanan & Minuman','color' => '#f97316'],
        ];

        $tags = [];
        foreach ($tagDefs as $def) {
            $tag = Tag::firstOrCreate(
                ['slug' => Str::slug($def['name'])],
                $def
            );
            $tags[$def['name']] = $tag;
        }

        // ── 2. DUMMY PRODUK BARU DENGAN TAGS ─────────────────────────────────
        $this->command->info('Seeding products with tags...');

        $kategoriIds = Kategori::pluck('id', 'nama')->toArray();

        $newItems = [
            [
                'kode_item'   => 'ITM-TAG-001',
                'nama'        => 'Kurma Premium Medjool',
                'kategori'    => 'Makanan',
                'harga_beli'  => 85000,
                'harga_jual'  => 125000,
                'stok'        => 200,
                'stok_minimal'=> 20,
                'tags'        => ['Promo Lebaran', 'Makanan & Minuman', 'Premium'],
            ],
            [
                'kode_item'   => 'ITM-TAG-002',
                'nama'        => 'Sirup Rose Brand 525ml',
                'kategori'    => 'Minuman',
                'harga_beli'  => 18000,
                'harga_jual'  => 25000,
                'stok'        => 300,
                'stok_minimal'=> 30,
                'tags'        => ['Promo Lebaran', 'Makanan & Minuman', 'Flash Sale'],
            ],
            [
                'kode_item'   => 'ITM-TAG-003',
                'nama'        => 'Headphone Bluetooth Pro X',
                'kategori'    => 'Elektronik',
                'harga_beli'  => 180000,
                'harga_jual'  => 299000,
                'stok'        => 50,
                'stok_minimal'=> 5,
                'tags'        => ['Produk Baru', 'Premium', 'Best Seller'],
            ],
            [
                'kode_item'   => 'ITM-TAG-004',
                'nama'        => 'Smartwatch Sport Series 3',
                'kategori'    => 'Elektronik',
                'harga_beli'  => 350000,
                'harga_jual'  => 499000,
                'stok'        => 30,
                'stok_minimal'=> 5,
                'tags'        => ['Produk Baru', 'Premium'],
            ],
            [
                'kode_item'   => 'ITM-TAG-005',
                'nama'        => 'Madu Hutan Asli 250gr',
                'kategori'    => 'Makanan',
                'harga_beli'  => 55000,
                'harga_jual'  => 89000,
                'stok'        => 150,
                'stok_minimal'=> 15,
                'tags'        => ['Best Seller', 'Makanan & Minuman'],
            ],
            [
                'kode_item'   => 'ITM-TAG-006',
                'nama'        => 'Teh Celup Premium 50 Pcs',
                'kategori'    => 'Minuman',
                'harga_beli'  => 22000,
                'harga_jual'  => 35000,
                'stok'        => 250,
                'stok_minimal'=> 25,
                'tags'        => ['Makanan & Minuman', 'Flash Sale'],
            ],
            [
                'kode_item'   => 'ITM-TAG-007',
                'nama'        => 'Masker Wajah Korea 10pcs',
                'kategori'    => 'Kecantikan',
                'harga_beli'  => 45000,
                'harga_jual'  => 75000,
                'stok'        => 100,
                'stok_minimal'=> 10,
                'tags'        => ['Produk Baru', 'Flash Sale'],
            ],
            [
                'kode_item'   => 'ITM-TAG-008',
                'nama'        => 'Vitamin C 1000mg 30 Tablet',
                'kategori'    => 'Kesehatan',
                'harga_beli'  => 38000,
                'harga_jual'  => 65000,
                'stok'        => 200,
                'stok_minimal'=> 20,
                'tags'        => ['Best Seller', 'Produk Baru'],
            ],
        ];

        $createdItems = [];
        foreach ($newItems as $def) {
            $tagNames = $def['tags'];
            unset($def['tags']);

            $katNama    = $def['kategori'];
            $katId      = $kategoriIds[$katNama] ?? null;
            $def['id_kategori'] = $katId;
            $def['deskripsi']   = null;

            $item = Item::firstOrCreate(['kode_item' => $def['kode_item']], $def);

            // Attach tags
            $tagIds = collect($tagNames)
                ->map(fn ($n) => $tags[$n]->id ?? null)
                ->filter()
                ->toArray();
            $item->tags()->syncWithoutDetaching($tagIds);

            // Ensure WarehouseItem records exist for both warehouses
            foreach ([$wh1, $wh2] as $wh) {
                WarehouseItem::firstOrCreate(
                    ['warehouse_id' => $wh->id, 'item_id' => $item->id],
                    ['stok' => (int) ($def['stok'] / 2), 'stok_minimal' => $def['stok_minimal']]
                );
            }

            $createdItems[] = $item;
        }

        // ── 3. PELANGGAN ──────────────────────────────────────────────────────
        $this->command->info('Seeding customers...');

        $customers = [
            ['code' => 'CUST-001', 'name' => 'Budi Santoso',       'phone' => '081234567890', 'email' => 'budi@email.com',    'city' => 'Jakarta',   'notes' => 'Pelanggan tetap'],
            ['code' => 'CUST-002', 'name' => 'Siti Rahayu',        'phone' => '082345678901', 'email' => 'siti@email.com',    'city' => 'Bandung',   'notes' => null],
            ['code' => 'CUST-003', 'name' => 'Ahmad Fauzi',        'phone' => '083456789012', 'email' => null,                'city' => 'Surabaya',  'notes' => 'Reseller'],
            ['code' => 'CUST-004', 'name' => 'Dewi Kusuma',        'phone' => '084567890123', 'email' => 'dewi@email.com',    'city' => 'Semarang',  'notes' => null],
            ['code' => 'CUST-005', 'name' => 'Rizky Pratama',      'phone' => '085678901234', 'email' => 'rizky@email.com',   'city' => 'Yogyakarta','notes' => 'Grosir'],
            ['code' => 'CUST-006', 'name' => 'Rina Wulandari',     'phone' => '086789012345', 'email' => null,                'city' => 'Medan',     'notes' => null],
            ['code' => 'CUST-007', 'name' => 'Hendra Wijaya',      'phone' => '087890123456', 'email' => 'hendra@email.com',  'city' => 'Jakarta',   'notes' => 'Member VIP'],
            ['code' => 'CUST-008', 'name' => 'Nurul Hidayah',      'phone' => '088901234567', 'email' => null,                'city' => 'Makassar',  'notes' => null],
            ['code' => 'CUST-009', 'name' => 'Toko Makmur Jaya',   'phone' => '021-5551234',  'email' => 'toko@makmur.com',   'city' => 'Jakarta',   'notes' => 'Toko grosir, min. beli 10 pcs'],
            ['code' => 'CUST-010', 'name' => 'CV Mitra Sejahtera', 'phone' => '024-8882345',  'email' => 'cv@mitra.com',      'city' => 'Semarang',  'notes' => 'Corporate client'],
        ];

        $custModels = [];
        foreach ($customers as $c) {
            $custModels[] = Customer::firstOrCreate(['code' => $c['code']], array_merge($c, ['is_active' => true]));
        }

        // ── 4. SUPPLIER ───────────────────────────────────────────────────────
        $this->command->info('Seeding suppliers...');

        $suppliers = [
            ['code' => 'SUP-001', 'name' => 'PT Sumber Makmur',       'contact_person' => 'Pak Hasan',    'phone' => '021-7771234', 'email' => 'sumber@makmur.com',    'city' => 'Jakarta',  'notes' => 'Supplier elektronik utama'],
            ['code' => 'SUP-002', 'name' => 'CV Berkah Abadi',        'contact_person' => 'Bu Lestari',   'phone' => '022-8882345', 'email' => 'berkah@abadi.com',     'city' => 'Bandung',  'notes' => 'Supplier makanan & minuman'],
            ['code' => 'SUP-003', 'name' => 'UD Maju Bersama',        'contact_person' => 'Pak Joko',     'phone' => '031-9993456', 'email' => null,                   'city' => 'Surabaya', 'notes' => 'Supplier pakaian'],
            ['code' => 'SUP-004', 'name' => 'PT Nusantara Health',    'contact_person' => 'Bu Indah',     'phone' => '024-1112345', 'email' => 'info@nushealth.com',   'city' => 'Semarang', 'notes' => 'Supplier kesehatan & kecantikan'],
            ['code' => 'SUP-005', 'name' => 'Toko Grosir Langsung',   'contact_person' => 'Pak Dodo',     'phone' => '0274-5556789','email' => 'grosir@langsung.com',  'city' => 'Yogyakarta','notes' => 'Grosir serba ada'],
        ];

        foreach ($suppliers as $s) {
            Supplier::firstOrCreate(['code' => $s['code']], array_merge($s, ['is_active' => true]));
        }

        // ── 5. PROMOTIONS ─────────────────────────────────────────────────────
        $this->command->info('Seeding promotions...');

        $promoTag  = $tags['Flash Sale'];
        $promoTag2 = $tags['Promo Lebaran'];
        $elekKatId = $kategoriIds['Elektronik'] ?? 1;

        $promotions = [
            [
                'name'         => 'Flash Sale Weekend',
                'code'         => 'FLASH10',
                'type'         => 'percentage',
                'value'        => 10,
                'applies_to'   => 'tag',
                'applies_id'   => $promoTag->id,
                'min_purchase' => 0,
                'max_discount' => 50000,
                'start_date'   => now()->startOfWeek()->toDateString(),
                'end_date'     => now()->addMonths(3)->toDateString(),
                'is_active'    => true,
            ],
            [
                'name'         => 'Promo Spesial Lebaran',
                'code'         => 'LEBARAN15',
                'type'         => 'percentage',
                'value'        => 15,
                'applies_to'   => 'tag',
                'applies_id'   => $promoTag2->id,
                'min_purchase' => 50000,
                'max_discount' => 100000,
                'start_date'   => now()->toDateString(),
                'end_date'     => now()->addMonths(2)->toDateString(),
                'is_active'    => true,
            ],
            [
                'name'         => 'Diskon Elektronik',
                'code'         => 'ELEK5',
                'type'         => 'percentage',
                'value'        => 5,
                'applies_to'   => 'category',
                'applies_id'   => $elekKatId,
                'min_purchase' => 200000,
                'max_discount' => 75000,
                'start_date'   => now()->toDateString(),
                'end_date'     => now()->addMonths(6)->toDateString(),
                'is_active'    => true,
            ],
            [
                'name'         => 'Diskon Semua Produk',
                'code'         => 'ALLITEM5',
                'type'         => 'percentage',
                'value'        => 5,
                'applies_to'   => 'all',
                'applies_id'   => null,
                'min_purchase' => 100000,
                'max_discount' => 25000,
                'start_date'   => now()->toDateString(),
                'end_date'     => now()->addMonth()->toDateString(),
                'is_active'    => true,
            ],
            [
                'name'         => 'Voucher Potongan 20rb',
                'code'         => 'POTON20',
                'type'         => 'fixed',
                'value'        => 20000,
                'applies_to'   => 'all',
                'applies_id'   => null,
                'min_purchase' => 150000,
                'max_discount' => 0,
                'start_date'   => now()->subMonth()->toDateString(),
                'end_date'     => now()->addMonths(2)->toDateString(),
                'is_active'    => true,
            ],
        ];

        foreach ($promotions as $p) {
            Promotion::firstOrCreate(['code' => $p['code']], $p);
        }

        // ── 6. STOCK IN — 2 WAREHOUSES ───────────────────────────────────────
        $this->command->info('Seeding stock in/out transactions...');

        // Pick a few existing items for stock movements
        $allItems = Item::all()->take(10)->values();
        $now = now();

        $stockIns = [
            // WH1 stock in
            ['warehouse' => $wh1, 'item' => $allItems[0],  'qty' => 50,  'days_ago' => 25, 'ref' => 'PO-2026-001'],
            ['warehouse' => $wh1, 'item' => $allItems[1],  'qty' => 80,  'days_ago' => 20, 'ref' => 'PO-2026-002'],
            ['warehouse' => $wh1, 'item' => $allItems[2],  'qty' => 100, 'days_ago' => 15, 'ref' => 'PO-2026-003'],
            ['warehouse' => $wh1, 'item' => $allItems[3],  'qty' => 40,  'days_ago' => 10, 'ref' => 'PO-2026-004'],
            // WH2 stock in
            ['warehouse' => $wh2, 'item' => $allItems[4],  'qty' => 60,  'days_ago' => 22, 'ref' => 'PO-2026-005'],
            ['warehouse' => $wh2, 'item' => $allItems[5],  'qty' => 90,  'days_ago' => 18, 'ref' => 'PO-2026-006'],
            ['warehouse' => $wh2, 'item' => $allItems[6],  'qty' => 70,  'days_ago' => 12, 'ref' => 'PO-2026-007'],
            ['warehouse' => $wh2, 'item' => $allItems[7],  'qty' => 45,  'days_ago' => 7,  'ref' => 'PO-2026-008'],
            // New tagged items stock in WH1
            ['warehouse' => $wh1, 'item' => $createdItems[0], 'qty' => 100, 'days_ago' => 5, 'ref' => 'PO-2026-009'],
            ['warehouse' => $wh1, 'item' => $createdItems[2], 'qty' => 25,  'days_ago' => 3, 'ref' => 'PO-2026-010'],
            // New tagged items stock in WH2
            ['warehouse' => $wh2, 'item' => $createdItems[1], 'qty' => 150, 'days_ago' => 4, 'ref' => 'PO-2026-011'],
            ['warehouse' => $wh2, 'item' => $createdItems[4], 'qty' => 75,  'days_ago' => 2, 'ref' => 'PO-2026-012'],
        ];

        foreach ($stockIns as $s) {
            $occurredAt = $now->copy()->subDays($s['days_ago']);
            Transaction::create([
                'txn_id'       => 'TXN-IN-' . strtoupper(Str::random(8)),
                'reference'    => $s['ref'],
                'item_id'      => $s['item']->id,
                'warehouse_id' => $s['warehouse']->id,
                'occurred_at'  => $occurredAt,
                'type'         => 'stock_in',
                'amount'       => $s['qty'],
                'currency'     => 'IDR',
                'status'       => 'completed',
                'actor'        => 'admin',
                'source'       => 'purchase_order',
                'note'         => 'Penerimaan stok dari ' . $s['ref'],
            ]);

            // Update WarehouseItem stock
            $wi = WarehouseItem::firstOrNew(
                ['warehouse_id' => $s['warehouse']->id, 'item_id' => $s['item']->id]
            );
            $wi->stok = ($wi->stok ?? 0) + $s['qty'];
            $wi->stok_minimal = $wi->stok_minimal ?? 5;
            $wi->save();

            // Update item total stock
            $totalStock = WarehouseItem::where('item_id', $s['item']->id)->sum('stok');
            $s['item']->stok = $totalStock;
            $s['item']->save();
        }

        // Stock OUT
        $stockOuts = [
            ['warehouse' => $wh1, 'item' => $allItems[0], 'qty' => 10, 'days_ago' => 18, 'ref' => 'SO-2026-001'],
            ['warehouse' => $wh1, 'item' => $allItems[1], 'qty' => 20, 'days_ago' => 14, 'ref' => 'SO-2026-002'],
            ['warehouse' => $wh2, 'item' => $allItems[4], 'qty' => 15, 'days_ago' => 16, 'ref' => 'SO-2026-003'],
            ['warehouse' => $wh2, 'item' => $allItems[5], 'qty' => 30, 'days_ago' => 9,  'ref' => 'SO-2026-004'],
        ];

        foreach ($stockOuts as $s) {
            $occurredAt = $now->copy()->subDays($s['days_ago']);
            Transaction::create([
                'txn_id'       => 'TXN-OUT-' . strtoupper(Str::random(8)),
                'reference'    => $s['ref'],
                'item_id'      => $s['item']->id,
                'warehouse_id' => $s['warehouse']->id,
                'occurred_at'  => $occurredAt,
                'type'         => 'stock_out',
                'amount'       => $s['qty'],
                'currency'     => 'IDR',
                'status'       => 'completed',
                'actor'        => 'admin',
                'source'       => 'adjustment',
                'note'         => 'Pengeluaran stok ' . $s['ref'],
            ]);

            $wi = WarehouseItem::where('warehouse_id', $s['warehouse']->id)
                ->where('item_id', $s['item']->id)->first();
            if ($wi) {
                $wi->stok = max(0, $wi->stok - $s['qty']);
                $wi->save();
                $totalStock = WarehouseItem::where('item_id', $s['item']->id)->sum('stok');
                $s['item']->stok = $totalStock;
                $s['item']->save();
            }
        }

        // ── 7. STOCK TRANSFER WH1 → WH2 ──────────────────────────────────────
        $transferItem = $createdItems[0]; // Kurma Premium
        StockTransfer::create([
            'txn_id'           => 'TXN-TR-' . strtoupper(Str::random(8)),
            'from_warehouse_id'=> $wh1->id,
            'to_warehouse_id'  => $wh2->id,
            'item_id'          => $transferItem->id,
            'quantity'         => 30,
            'occurred_at'      => $now->copy()->subDays(3),
            'reference'        => 'TR-2026-001',
            'actor'            => 'admin',
            'note'             => 'Transfer stok ke Gudang Semarang',
            'status'           => 'completed',
        ]);

        // Update WarehouseItem for transfer
        $wi1 = WarehouseItem::where('warehouse_id', $wh1->id)->where('item_id', $transferItem->id)->first();
        $wi2 = WarehouseItem::firstOrNew(['warehouse_id' => $wh2->id, 'item_id' => $transferItem->id]);
        if ($wi1) {
            $wi1->stok = max(0, $wi1->stok - 30);
            $wi1->save();
        }
        $wi2->stok = ($wi2->stok ?? 0) + 30;
        $wi2->stok_minimal = $wi2->stok_minimal ?? 5;
        $wi2->save();

        // ── 8. TRANSAKSI PENJUALAN ────────────────────────────────────────────
        $this->command->info('Seeding sale transactions...');

        $saleItems = Item::where('stok', '>', 5)->take(15)->get();
        $payMethods = ['cash', 'transfer', 'qris'];

        $sales = [
            ['days_ago' => 20, 'customer' => $custModels[0], 'warehouse' => $wh1, 'items' => [[$saleItems[0], 2], [$saleItems[1], 1]], 'method' => 'cash'],
            ['days_ago' => 18, 'customer' => null,           'warehouse' => $wh1, 'items' => [[$saleItems[2], 3]], 'method' => 'qris'],
            ['days_ago' => 16, 'customer' => $custModels[1], 'warehouse' => $wh1, 'items' => [[$saleItems[3], 1], [$saleItems[4], 2]], 'method' => 'transfer'],
            ['days_ago' => 14, 'customer' => null,           'warehouse' => $wh2, 'items' => [[$saleItems[5], 4]], 'method' => 'cash'],
            ['days_ago' => 12, 'customer' => $custModels[2], 'warehouse' => $wh2, 'items' => [[$saleItems[6], 2], [$saleItems[7], 1]], 'method' => 'cash'],
            ['days_ago' => 10, 'customer' => $custModels[3], 'warehouse' => $wh1, 'items' => [[$saleItems[8], 1]], 'method' => 'qris'],
            ['days_ago' => 8,  'customer' => null,           'warehouse' => $wh1, 'items' => [[$saleItems[9], 3], [$saleItems[0], 2]], 'method' => 'cash'],
            ['days_ago' => 7,  'customer' => $custModels[4], 'warehouse' => $wh2, 'items' => [[$saleItems[1], 5]], 'method' => 'transfer'],
            ['days_ago' => 5,  'customer' => null,           'warehouse' => $wh1, 'items' => [[$saleItems[2], 2], [$saleItems[3], 1]], 'method' => 'cash'],
            ['days_ago' => 4,  'customer' => $custModels[5], 'warehouse' => $wh1, 'items' => [[$saleItems[4], 3]], 'method' => 'qris'],
            ['days_ago' => 3,  'customer' => $custModels[6], 'warehouse' => $wh2, 'items' => [[$saleItems[5], 2], [$saleItems[6], 2]], 'method' => 'cash'],
            ['days_ago' => 2,  'customer' => null,           'warehouse' => $wh1, 'items' => [[$saleItems[7], 1], [$saleItems[8], 3]], 'method' => 'transfer'],
            ['days_ago' => 1,  'customer' => $custModels[7], 'warehouse' => $wh1, 'items' => [[$saleItems[9], 2]], 'method' => 'qris'],
            // New tagged product sales
            ['days_ago' => 4,  'customer' => $custModels[8], 'warehouse' => $wh1, 'items' => [[$createdItems[0], 5], [$createdItems[1], 3]], 'method' => 'transfer'],
            ['days_ago' => 1,  'customer' => $custModels[9], 'warehouse' => $wh1, 'items' => [[$createdItems[2], 1], [$createdItems[4], 2]], 'method' => 'cash'],
        ];

        $saleCounter = SaleHeader::count() + 1;

        foreach ($sales as $sale) {
            $occurredAt = $now->copy()->subDays($sale['days_ago']);
            $subtotal   = 0;
            $lineItems  = [];

            foreach ($sale['items'] as [$saleItem, $qty]) {
                $lineTotal  = $saleItem->harga_jual * $qty;
                $subtotal  += $lineTotal;
                $lineItems[] = [
                    'item'      => $saleItem,
                    'qty'       => $qty,
                    'lineTotal' => $lineTotal,
                ];
            }

            $discount   = 0;
            $grandTotal = $subtotal - $discount;
            $saleNumber = 'INV-' . date('Ymd', strtotime($occurredAt)) . '-' . str_pad($saleCounter++, 4, '0', STR_PAD_LEFT);

            $header = SaleHeader::create([
                'sale_number'    => $saleNumber,
                'warehouse_id'   => $sale['warehouse']->id,
                'customer_id'    => $sale['customer']?->id,
                'cashier_id'     => $kasirId,
                'occurred_at'    => $occurredAt,
                'subtotal'       => $subtotal,
                'discount_amount'=> $discount,
                'tax_amount'     => 0,
                'grand_total'    => $grandTotal,
                'payment_method' => $sale['method'],
                'payment_amount' => $grandTotal,
                'change_amount'  => 0,
                'status'         => 'completed',
                'note'           => null,
            ]);

            foreach ($lineItems as $li) {
                SaleItem::create([
                    'sale_header_id'     => $header->id,
                    'item_id'            => $li['item']->id,
                    'item_name_snapshot' => $li['item']->nama,
                    'item_code_snapshot' => $li['item']->kode_item,
                    'unit_price'         => $li['item']->harga_jual,
                    'quantity'           => $li['qty'],
                    'discount_amount'    => 0,
                    'line_total'         => $li['lineTotal'],
                ]);

                // Deduct stock from warehouse
                $wi = WarehouseItem::where('warehouse_id', $sale['warehouse']->id)
                    ->where('item_id', $li['item']->id)->first();
                if ($wi && $wi->stok >= $li['qty']) {
                    $wi->stok -= $li['qty'];
                    $wi->save();
                    $li['item']->stok = WarehouseItem::where('item_id', $li['item']->id)->sum('stok');
                    $li['item']->save();
                }
            }
        }

        $this->command->info('DummyDataSeeder done!');
        $this->command->table(
            ['Entity', 'Count'],
            [
                ['Tags',       Tag::count()],
                ['Customers',  Customer::count()],
                ['Suppliers',  Supplier::count()],
                ['Promotions', Promotion::count()],
                ['Items (total)', Item::count()],
                ['Sales',      SaleHeader::count()],
                ['Stock In txns',  Transaction::where('type','stock_in')->count()],
                ['Stock Out txns', Transaction::where('type','stock_out')->count()],
                ['Transfers',  StockTransfer::count()],
            ]
        );
    }
}
