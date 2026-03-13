<?php

namespace Database\Seeders;

use App\Models\Customer;
use App\Models\Expense;
use App\Models\Item;
use App\Models\Kategori;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderItem;
use App\Models\ReturnHeader;
use App\Models\ReturnItem;
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
use Carbon\Carbon;

class FullYearSeeder extends Seeder
{
    public function run(): void
    {
        $this->command->info('=== FullYearSeeder: Jan 2025 – Mar 2026 ===');

        $wh1     = Warehouse::find(1);
        $wh2     = Warehouse::find(2);
        $wh3     = Warehouse::find(3);
        $whs     = [$wh1, $wh2, $wh3];
        $adminId = 1;
        $kasirId = 3;

        // ── CUSTOMERS (add more) ─────────────────────────────────────────────
        $this->command->info('Seeding extra customers...');
        $extraCustomers = [
            ['code'=>'CUST-011','name'=>'Tono Hartanto',    'phone'=>'08111000011','email'=>null,                'city'=>'Jakarta',    'notes'=>null],
            ['code'=>'CUST-012','name'=>'Yuli Astuti',      'phone'=>'08111000012','email'=>'yuli@mail.com',    'city'=>'Surabaya',   'notes'=>null],
            ['code'=>'CUST-013','name'=>'Faisal Rahman',    'phone'=>'08111000013','email'=>null,                'city'=>'Bandung',    'notes'=>'Reseller'],
            ['code'=>'CUST-014','name'=>'Mega Pertiwi',     'phone'=>'08111000014','email'=>'mega@mail.com',    'city'=>'Medan',      'notes'=>null],
            ['code'=>'CUST-015','name'=>'Dito Kusuma',      'phone'=>'08111000015','email'=>null,                'city'=>'Semarang',   'notes'=>'Grosir'],
            ['code'=>'CUST-016','name'=>'Eko Prasetyo',     'phone'=>'08111000016','email'=>'eko@mail.com',     'city'=>'Yogyakarta', 'notes'=>null],
            ['code'=>'CUST-017','name'=>'Lia Santoso',      'phone'=>'08111000017','email'=>null,                'city'=>'Jakarta',    'notes'=>null],
            ['code'=>'CUST-018','name'=>'PT Sinar Abadi',   'phone'=>'021-5559876','email'=>'info@sinar.com',   'city'=>'Jakarta',    'notes'=>'Corporate'],
            ['code'=>'CUST-019','name'=>'Warung Bu Nanik',  'phone'=>'08111000019','email'=>null,                'city'=>'Semarang',   'notes'=>'Langganan'],
            ['code'=>'CUST-020','name'=>'CV Gemilang',      'phone'=>'022-5554321','email'=>'cv@gemilang.com',  'city'=>'Bandung',    'notes'=>'Reseller grosir'],
        ];
        foreach ($extraCustomers as $c) {
            Customer::firstOrCreate(['code' => $c['code']], array_merge($c, ['is_active' => true]));
        }
        $customers = Customer::all()->values();

        // ── EXTRA SUPPLIER ───────────────────────────────────────────────────
        $extraSuppliers = [
            ['code'=>'SUP-006','name'=>'PT Global Tech',      'contact_person'=>'Pak Arif', 'phone'=>'021-4441122','email'=>'global@tech.com',  'city'=>'Jakarta',  'notes'=>'Supplier aksesori digital'],
            ['code'=>'SUP-007','name'=>'CV Herbal Nusantara', 'contact_person'=>'Bu Sari',  'phone'=>'031-3332211','email'=>null,               'city'=>'Surabaya', 'notes'=>'Produk herbal & wellness'],
        ];
        foreach ($extraSuppliers as $s) {
            Supplier::firstOrCreate(['code' => $s['code']], array_merge($s, ['is_active' => true]));
        }
        $suppliers = Supplier::all()->values();

        // ── EXTRA ITEMS (jasa + more barang) ────────────────────────────────
        $this->command->info('Seeding extra items (barang + jasa)...');
        $kategoriMap = Kategori::pluck('id', 'nama')->toArray();

        $extraItems = [
            // Barang tambahan
            ['type'=>'barang','kode_item'=>'ITM-EX-001','nama'=>'Kopi Arabika 200gr',  'harga_beli'=>35000,'harga_jual'=>55000,'stok'=>200,'stok_minimal'=>20,'kategori'=>'Makanan'],
            ['type'=>'barang','kode_item'=>'ITM-EX-002','nama'=>'Mineral Water 600ml',  'harga_beli'=>2000, 'harga_jual'=>4000, 'stok'=>500,'stok_minimal'=>50,'kategori'=>'Minuman'],
            ['type'=>'barang','kode_item'=>'ITM-EX-003','nama'=>'Sabun Cuci Piring 1kg','harga_beli'=>12000,'harga_jual'=>18000,'stok'=>150,'stok_minimal'=>15,'kategori'=>'Rumah Tangga'],
            ['type'=>'barang','kode_item'=>'ITM-EX-004','nama'=>'Lampu LED 10W',         'harga_beli'=>15000,'harga_jual'=>25000,'stok'=>100,'stok_minimal'=>10,'kategori'=>'Elektronik'],
            ['type'=>'barang','kode_item'=>'ITM-EX-005','nama'=>'Baju Polo Pria L',      'harga_beli'=>45000,'harga_jual'=>85000,'stok'=>80, 'stok_minimal'=>8,'kategori'=>'Pakaian'],
            ['type'=>'barang','kode_item'=>'ITM-EX-006','nama'=>'Celana Jeans Slim 32',  'harga_beli'=>95000,'harga_jual'=>175000,'stok'=>60,'stok_minimal'=>6,'kategori'=>'Pakaian'],
            ['type'=>'barang','kode_item'=>'ITM-EX-007','nama'=>'Toner Wajah 150ml',     'harga_beli'=>55000,'harga_jual'=>95000,'stok'=>90, 'stok_minimal'=>10,'kategori'=>'Kecantikan'],
            ['type'=>'barang','kode_item'=>'ITM-EX-008','nama'=>'Suplemen Omega-3 60pcs','harga_beli'=>65000,'harga_jual'=>110000,'stok'=>120,'stok_minimal'=>12,'kategori'=>'Kesehatan'],
            // Jasa
            ['type'=>'jasa', 'kode_item'=>'SVC-001','nama'=>'Jasa Instalasi AC',     'harga_beli'=>0,'harga_jual'=>250000,'stok'=>0,'stok_minimal'=>0,'kategori'=>null],
            ['type'=>'jasa', 'kode_item'=>'SVC-002','nama'=>'Jasa Servis HP',         'harga_beli'=>0,'harga_jual'=>75000, 'stok'=>0,'stok_minimal'=>0,'kategori'=>null],
            ['type'=>'jasa', 'kode_item'=>'SVC-003','nama'=>'Jasa Pengiriman Lokal',  'harga_beli'=>0,'harga_jual'=>15000, 'stok'=>0,'stok_minimal'=>0,'kategori'=>null],
            ['type'=>'jasa', 'kode_item'=>'SVC-004','nama'=>'Konsultasi Teknis 1 Jam','harga_beli'=>0,'harga_jual'=>150000,'stok'=>0,'stok_minimal'=>0,'kategori'=>null],
        ];

        $allNewItems = [];
        foreach ($extraItems as $def) {
            $katNama    = $def['kategori'];
            $katId      = $katNama ? ($kategoriMap[$katNama] ?? null) : null;
            $item = Item::firstOrCreate(['kode_item' => $def['kode_item']], [
                'type'         => $def['type'],
                'nama'         => $def['nama'],
                'deskripsi'    => null,
                'harga_beli'   => $def['harga_beli'],
                'harga_jual'   => $def['harga_jual'],
                'stok'         => $def['stok'],
                'stok_minimal' => $def['stok_minimal'],
                'kategori'     => $katNama,
                'id_kategori'  => $katId,
            ]);

            if ($def['type'] === 'barang') {
                foreach ($whs as $wh) {
                    WarehouseItem::firstOrCreate(
                        ['warehouse_id' => $wh->id, 'item_id' => $item->id],
                        ['stok' => (int)($def['stok'] / 3), 'stok_minimal' => $def['stok_minimal']]
                    );
                }
            }
            $allNewItems[] = $item;
        }

        // Collect all sellable items for sales
        $allItems   = Item::where('type', 'barang')->where('harga_jual', '>', 0)->get()->values();
        $jasaItems  = Item::where('type', 'jasa')->get()->values();

        // ── BUILD MONTHS (Jan 2025 – Mar 2026) ───────────────────────────────
        $months = [];
        $start  = Carbon::create(2025, 1, 1);
        $end    = Carbon::create(2026, 3, 31);
        $cursor = $start->copy();
        while ($cursor->lte($end)) {
            $months[] = $cursor->copy();
            $cursor->addMonth();
        }

        // Seasonal multipliers (Ramadan/Lebaran peak in Mar-Apr 2025, Dec high, Jan low)
        $seasonalWeight = [
            1 => 0.7,  2 => 0.8,  3 => 1.4, // Jan low, Mar = Ramadan
            4 => 1.3,  5 => 0.9,  6 => 0.9,
            7 => 1.0,  8 => 1.0,  9 => 1.0,
            10 => 1.1, 11 => 1.1, 12 => 1.5, // Dec peak
        ];

        // ── PURCHASE ORDERS ──────────────────────────────────────────────────
        $this->command->info('Seeding purchase orders...');
        $poCounter = 1;

        foreach ($months as $month) {
            $numPOs = rand(1, 3);
            for ($p = 0; $p < $numPOs; $p++) {
                $supplier   = $suppliers->random();
                $warehouse  = collect($whs)->random();
                $orderedAt  = $month->copy()->addDays(rand(1, 10));
                $expectedAt = $orderedAt->copy()->addDays(rand(5, 14));
                $receivedAt = $expectedAt->copy()->addDays(rand(0, 3));

                $poItems = $allItems->random(rand(2, 5));
                $subtotal = 0;
                $lines = [];
                foreach ($poItems as $item) {
                    $qty   = rand(10, 50);
                    $price = $item->harga_beli > 0 ? $item->harga_beli : rand(5000, 50000);
                    $line  = $qty * $price;
                    $subtotal += $line;
                    $lines[] = ['item' => $item, 'qty' => $qty, 'price' => $price, 'line' => $line];
                }

                $poNumber = 'PO-' . $orderedAt->format('Ym') . '-' . str_pad($poCounter++, 3, '0', STR_PAD_LEFT);

                $po = PurchaseOrder::create([
                    'po_number'    => $poNumber,
                    'supplier_id'  => $supplier->id,
                    'warehouse_id' => $warehouse->id,
                    'ordered_by'   => $adminId,
                    'received_by'  => $adminId,
                    'status'       => 'received',
                    'ordered_at'   => $orderedAt,
                    'expected_at'  => $expectedAt,
                    'received_at'  => $receivedAt,
                    'subtotal'     => $subtotal,
                    'tax_amount'   => 0,
                    'grand_total'  => $subtotal,
                    'note'         => null,
                ]);

                foreach ($lines as $line) {
                    PurchaseOrderItem::create([
                        'purchase_order_id'  => $po->id,
                        'item_id'            => $line['item']->id,
                        'item_name_snapshot' => $line['item']->nama,
                        'ordered_qty'        => $line['qty'],
                        'received_qty'       => $line['qty'],
                        'unit_price'         => $line['price'],
                        'line_total'         => $line['line'],
                    ]);

                    // Stock in from PO
                    $wi = WarehouseItem::firstOrNew(['warehouse_id' => $warehouse->id, 'item_id' => $line['item']->id]);
                    $wi->stok = ($wi->stok ?? 0) + $line['qty'];
                    $wi->stok_minimal = $wi->stok_minimal ?? 5;
                    $wi->save();

                    Transaction::create([
                        'txn_id'       => 'TXN-PO-' . Str::random(8),
                        'reference'    => $poNumber,
                        'item_id'      => $line['item']->id,
                        'warehouse_id' => $warehouse->id,
                        'occurred_at'  => $receivedAt,
                        'type'         => 'stock_in',
                        'amount'       => $line['qty'],
                        'currency'     => 'IDR',
                        'status'       => 'completed',
                        'actor'        => 'admin',
                        'source'       => 'purchase_order',
                        'note'         => 'Penerimaan dari ' . $poNumber,
                    ]);
                }

                // Update item total stok
                foreach ($lines as $line) {
                    $total = WarehouseItem::where('item_id', $line['item']->id)->sum('stok');
                    $line['item']->stok = $total;
                    $line['item']->save();
                }
            }
        }

        // ── SALES (10-20 per month, seasonal) ────────────────────────────────
        $this->command->info('Seeding 15 months of sales...');
        $saleCounter = SaleHeader::count() + 1;
        $payMethods  = ['cash', 'cash', 'cash', 'qris', 'qris', 'transfer', 'card'];

        foreach ($months as $month) {
            $weight  = $seasonalWeight[$month->month] ?? 1.0;
            $numSales = (int) round(rand(12, 20) * $weight);

            for ($s = 0; $s < $numSales; $s++) {
                $warehouse  = collect($whs)->random();
                $customer   = rand(0, 2) === 0 ? $customers->random() : null;
                $dayOffset  = rand(0, $month->daysInMonth - 1);
                $occurredAt = $month->copy()->addDays($dayOffset)->setHour(rand(8, 21))->setMinute(rand(0, 59));

                // Ensure we don't go beyond today
                if ($occurredAt->gt(now())) {
                    $occurredAt = now()->subHours(rand(1, 72));
                }

                // Build cart (2-4 items, optionally include jasa)
                $numItems  = rand(1, 4);
                $cartItems = $allItems->random(min($numItems, $allItems->count()))->values();

                // ~30% chance add a jasa item
                if ($jasaItems->count() > 0 && rand(0, 9) < 3) {
                    $cartItems = $cartItems->push($jasaItems->random());
                }

                $subtotal = 0;
                $lines    = [];
                foreach ($cartItems as $item) {
                    $qty      = rand(1, 5);
                    $price    = $item->harga_jual;
                    $lineTot  = $price * $qty;
                    $subtotal += $lineTot;
                    $lines[]  = ['item' => $item, 'qty' => $qty, 'lineTotal' => $lineTot];
                }

                $discount   = rand(0, 3) === 0 ? round(rand(5000, 25000) / 1000) * 1000 : 0;
                $grandTotal = max(0, $subtotal - $discount);
                $payMethod  = $payMethods[array_rand($payMethods)];
                $saleNum    = 'INV-' . $occurredAt->format('Ymd') . '-' . str_pad($saleCounter++, 4, '0', STR_PAD_LEFT);

                $header = SaleHeader::create([
                    'sale_number'     => $saleNum,
                    'warehouse_id'    => $warehouse->id,
                    'customer_id'     => $customer?->id,
                    'cashier_id'      => $kasirId,
                    'occurred_at'     => $occurredAt,
                    'subtotal'        => $subtotal,
                    'discount_amount' => $discount,
                    'tax_amount'      => 0,
                    'grand_total'     => $grandTotal,
                    'payment_method'  => $payMethod,
                    'payment_amount'  => $grandTotal,
                    'change_amount'   => 0,
                    'status'          => 'completed',
                    'note'            => null,
                ]);

                foreach ($lines as $li) {
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

                    // Deduct stock for barang
                    if (($li['item']->type ?? 'barang') === 'barang') {
                        $wi = WarehouseItem::where('warehouse_id', $warehouse->id)
                            ->where('item_id', $li['item']->id)->first();
                        if ($wi && $wi->stok >= $li['qty']) {
                            $wi->stok = max(0, $wi->stok - $li['qty']);
                            $wi->save();
                        }
                    }
                }
            }
        }

        // ── RETURNS (a few per quarter) ──────────────────────────────────────
        $this->command->info('Seeding returns...');
        $completedSales = SaleHeader::where('status', 'completed')->inRandomOrder()->limit(20)->get();
        $returnCounter  = 1;

        foreach ($completedSales->take(12) as $sale) {
            $saleItem = SaleItem::where('sale_header_id', $sale->id)->first();
            if (!$saleItem) continue;

            $returnAt  = Carbon::parse($sale->occurred_at)->addDays(rand(1, 5));
            if ($returnAt->gt(now())) continue;

            $returnNum = 'RTN-' . $returnAt->format('Ymd') . '-' . str_pad($returnCounter++, 3, '0', STR_PAD_LEFT);
            $qtyReturn = 1;
            $lineTotal = $saleItem->unit_price * $qtyReturn;

            $rh = ReturnHeader::create([
                'return_number'  => $returnNum,
                'sale_header_id' => $sale->id,
                'warehouse_id'   => $sale->warehouse_id,
                'processed_by'   => $kasirId,
                'customer_id'    => $sale->customer_id,
                'occurred_at'    => $returnAt,
                'type'           => 'refund',
                'reason'         => collect(['Produk cacat','Salah pesan','Tidak sesuai deskripsi','Barang rusak'])->random(),
                'total_amount'   => $lineTotal,
                'status'         => 'completed',
                'note'           => null,
            ]);

            ReturnItem::create([
                'return_header_id'   => $rh->id,
                'item_id'            => $saleItem->item_id,
                'item_name_snapshot' => $saleItem->item_name_snapshot,
                'quantity'           => $qtyReturn,
                'unit_price'         => $saleItem->unit_price,
                'line_total'         => $lineTotal,
                'condition'          => 'good',
            ]);

            // Restore stock
            $wi = WarehouseItem::where('warehouse_id', $sale->warehouse_id)
                ->where('item_id', $saleItem->item_id)->first();
            if ($wi) {
                $wi->stok += $qtyReturn;
                $wi->save();
            }
        }

        // ── STOCK ADJUSTMENTS ────────────────────────────────────────────────
        $this->command->info('Seeding stock adjustments...');
        $adjReasons = ['Barang hilang','Rusak dalam penyimpanan','Koreksi opname','Expired','Kelebihan stok'];
        $adjCounter = 1;

        foreach ($months as $i => $month) {
            if ($i % 2 !== 0) continue; // every other month
            $adjAt = $month->copy()->addDays(rand(15, 25));
            if ($adjAt->gt(now())) continue;

            $warehouse = collect($whs)->random();
            $item      = $allItems->random();
            $qty       = rand(1, 10);
            $type      = rand(0, 1) ? 'add' : 'subtract';

            $wi = WarehouseItem::where('warehouse_id', $warehouse->id)->where('item_id', $item->id)->first();
            $oldQty = $wi ? $wi->stok : 0;
            $newQty = max(0, $type === 'add' ? $oldQty + $qty : $oldQty - $qty);
            $diff   = $newQty - $oldQty;

            StockAdjustment::create([
                'txn_id'       => 'TXN-ADJ-' . Str::random(8),
                'warehouse_id' => $warehouse->id,
                'item_id'      => $item->id,
                'old_quantity' => $oldQty,
                'new_quantity' => $newQty,
                'difference'   => $diff,
                'reason'       => collect($adjReasons)->random(),
                'actor'        => 'admin',
                'occurred_at'  => $adjAt,
                'note'         => null,
            ]);

            if ($wi) {
                $wi->stok = $newQty;
                $wi->save();
            }
        }

        // ── STOCK TRANSFERS ──────────────────────────────────────────────────
        $this->command->info('Seeding stock transfers...');
        $trCounter = 1;

        foreach ($months as $i => $month) {
            if ($i % 3 !== 0) continue; // quarterly
            $trAt = $month->copy()->addDays(rand(5, 20));
            if ($trAt->gt(now())) continue;

            $item = $allItems->random();
            $from = $wh1;
            $to   = rand(0, 1) ? $wh2 : $wh3;
            $qty  = rand(5, 20);

            StockTransfer::create([
                'txn_id'           => 'TXN-TR-' . Str::random(8),
                'from_warehouse_id'=> $from->id,
                'to_warehouse_id'  => $to->id,
                'item_id'          => $item->id,
                'quantity'         => $qty,
                'occurred_at'      => $trAt,
                'reference'        => 'TR-' . str_pad($trCounter++, 3, '0', STR_PAD_LEFT),
                'actor'            => 'admin',
                'note'             => 'Distribusi stok antar gudang',
                'status'           => 'completed',
            ]);

            $wi1 = WarehouseItem::where('warehouse_id', $from->id)->where('item_id', $item->id)->first();
            $wi2 = WarehouseItem::firstOrNew(['warehouse_id' => $to->id, 'item_id' => $item->id]);
            if ($wi1 && $wi1->stok >= $qty) {
                $wi1->stok -= $qty;
                $wi1->save();
            }
            $wi2->stok = ($wi2->stok ?? 0) + $qty;
            $wi2->stok_minimal = $wi2->stok_minimal ?? 5;
            $wi2->save();
        }

        // ── EXPENSES ────────────────────────────────────────────────────────
        $this->command->info('Seeding expenses...');
        $expCategories = array_keys(Expense::CATEGORIES);

        // Fixed monthly costs
        $fixedExpenses = [
            ['category' => 'Gaji',    'min' => 8000000,  'max' => 12000000, 'desc' => 'Gaji karyawan bulan ini'],
            ['category' => 'Sewa',    'min' => 5000000,  'max' => 5000000,  'desc' => 'Sewa toko bulanan'],
            ['category' => 'Utilitas','min' => 800000,   'max' => 1500000,  'desc' => 'Listrik, air, internet'],
        ];

        // Variable expenses
        $varExpenses = [
            ['category' => 'Transportasi', 'min' => 200000, 'max' => 800000,  'desc' => 'Ongkos kirim & BBM'],
            ['category' => 'Pemasaran',    'min' => 300000, 'max' => 2000000, 'desc' => 'Iklan media sosial'],
            ['category' => 'Perlengkapan', 'min' => 100000, 'max' => 600000,  'desc' => 'ATK dan perlengkapan toko'],
            ['category' => 'Pemeliharaan', 'min' => 150000, 'max' => 1000000, 'desc' => 'Perawatan peralatan'],
            ['category' => 'Lain-lain',    'min' => 50000,  'max' => 500000,  'desc' => 'Pengeluaran lain-lain'],
        ];

        foreach ($months as $month) {
            if ($month->gt(now())) continue;

            // Fixed
            foreach ($fixedExpenses as $exp) {
                $amount = rand($exp['min'], $exp['max']);
                $amount = round($amount / 1000) * 1000;
                $date   = $month->copy()->addDays(rand(1, 5));

                foreach ($whs as $wh) {
                    Expense::create([
                        'occurred_at'  => $date,
                        'category'     => $exp['category'],
                        'amount'       => (int)($amount / 3),
                        'description'  => $exp['desc'],
                        'warehouse_id' => $wh->id,
                        'created_by'   => $adminId,
                    ]);
                }
            }

            // Variable (2-4 random variable expenses per month)
            $picked = collect($varExpenses)->shuffle()->take(rand(2, 4));
            foreach ($picked as $exp) {
                $amount = rand($exp['min'], $exp['max']);
                $amount = round($amount / 1000) * 1000;
                $date   = $month->copy()->addDays(rand(1, $month->daysInMonth - 1));
                $wh     = collect($whs)->random();

                Expense::create([
                    'occurred_at'  => $date,
                    'category'     => $exp['category'],
                    'amount'       => $amount,
                    'description'  => $exp['desc'],
                    'warehouse_id' => $wh->id,
                    'created_by'   => $adminId,
                ]);
            }
        }

        // ── UPDATE ITEM TOTAL STOK ────────────────────────────────────────────
        $this->command->info('Recalculating item stock totals...');
        Item::where('type', 'barang')->each(function ($item) {
            $total      = WarehouseItem::where('item_id', $item->id)->sum('stok');
            $item->stok = max(0, (int)$total);
            $item->save();
        });

        // ── SUMMARY ──────────────────────────────────────────────────────────
        $this->command->info('Done!');
        $this->command->table(
            ['Entity', 'Total'],
            [
                ['Warehouses',       Warehouse::count()],
                ['Customers',        Customer::count()],
                ['Suppliers',        Supplier::count()],
                ['Items (barang)',    Item::where('type','barang')->count()],
                ['Items (jasa)',      Item::where('type','jasa')->count()],
                ['Purchase Orders',  PurchaseOrder::count()],
                ['Sales',            SaleHeader::count()],
                ['Returns',          ReturnHeader::count()],
                ['Expenses',         Expense::count()],
                ['Stock Adjustments',StockAdjustment::count()],
                ['Stock Transfers',  StockTransfer::count()],
                ['Transactions',     Transaction::count()],
            ]
        );
    }
}
