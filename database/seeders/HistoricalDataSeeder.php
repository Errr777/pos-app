<?php

namespace Database\Seeders;

use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class HistoricalDataSeeder extends Seeder
{
    private int $saleCounter   = 1;
    private int $poCounter     = 1;
    private int $stkCounter    = 1;
    private int $opnameCounter = 1;

    // Seasonal revenue multiplier per month
    private array $seasonal = [
        1 => 0.80, 2 => 0.85, 3 => 1.40, 4 => 1.20,
        5 => 0.90, 6 => 0.90, 7 => 1.10, 8 => 1.00,
        9 => 0.90, 10 => 0.95, 11 => 1.10, 12 => 1.50,
    ];

    public function run(): void
    {
        // Load reference data
        $warehouses  = DB::table('warehouses')->orderBy('id')->get();
        $mainWh      = $warehouses->where('is_default', true)->first();
        $items       = DB::table('items')->where('type', 'barang')->get();
        $customers   = DB::table('customers')->pluck('id')->toArray();
        $suppliers   = DB::table('suppliers')->pluck('id')->toArray();
        $admin       = DB::table('users')->where('role', 'admin')->first();
        $kasirIds    = DB::table('users')->where('role', 'kasir')->pluck('id')->toArray();
        $whIds       = $warehouses->pluck('id')->toArray();

        if (empty($kasirIds)) {
            $kasirIds = [$admin->id];
        }

        // ─────────────────────────────────────────────────────────────────
        // LOOP: Jan 2024 → Mar 2026
        // ─────────────────────────────────────────────────────────────────
        $months = [];
        for ($y = 2024; $y <= 2026; $y++) {
            $maxM = ($y === 2026) ? 3 : 12;
            for ($m = 1; $m <= $maxM; $m++) {
                $months[] = [$y, $m];
            }
        }

        foreach ($months as [$year, $month]) {
            $isCurrentMonth = ($year === 2026 && $month === 3);
            $daysInMonth    = cal_days_in_month(CAL_GREGORIAN, $month, $year);
            $multiplier     = $this->seasonal[$month] ?? 1.0;

            // ── PURCHASE ORDERS (received, for past months only) ──────────
            if (! $isCurrentMonth) {
                $numPOs = rand(2, 4);
                for ($p = 0; $p < $numPOs; $p++) {
                    $this->createPO(
                        $year, $month, $daysInMonth,
                        $items, $suppliers, $whIds, $admin->id,
                        'received'
                    );
                }
            }

            // ── SALES ─────────────────────────────────────────────────────
            $numSales = max(6, (int) round(12 * $multiplier));
            for ($s = 0; $s < $numSales; $s++) {
                $this->createSale(
                    $year, $month, $daysInMonth,
                    $items, $customers, $whIds, $kasirIds
                );
            }

            // ── EXPENSES (per warehouse) ───────────────────────────────────
            foreach ($warehouses as $wh) {
                $this->createMonthlyExpenses($year, $month, $wh->id, $admin->id);
            }

            // ── STOCK IN (2-4 per month, mixed sources) ────────────────────
            $numIn = rand(2, 4);
            for ($i = 0; $i < $numIn; $i++) {
                $this->createStockMovement(
                    'stock_in', $year, $month, $daysInMonth,
                    $items, $whIds, $admin
                );
            }

            // ── STOCK OUT (1-2 per month, breakage/sampling) ───────────────
            $numOut = rand(1, 2);
            for ($i = 0; $i < $numOut; $i++) {
                $this->createStockMovement(
                    'stock_out', $year, $month, $daysInMonth,
                    $items, $whIds, $admin
                );
            }
        }

        // ─────────────────────────────────────────────────────────────────
        // PENDING PURCHASE ORDERS (triggers badge notification)
        // ─────────────────────────────────────────────────────────────────
        $pendingStatuses = ['draft', 'ordered', 'partial'];
        foreach ($pendingStatuses as $status) {
            $this->createPO(2026, 3, 31, $items, $suppliers, $whIds, $admin->id, $status);
        }

        // ─────────────────────────────────────────────────────────────────
        // STOCK TRANSFERS (quarterly)
        // ─────────────────────────────────────────────────────────────────
        $transferDates = [
            Carbon::create(2024, 3, 15),
            Carbon::create(2024, 6, 20),
            Carbon::create(2024, 9, 10),
            Carbon::create(2024, 12, 5),
            Carbon::create(2025, 3, 18),
            Carbon::create(2025, 6, 25),
            Carbon::create(2025, 9, 12),
            Carbon::create(2025, 12, 8),
            Carbon::create(2026, 2, 20),
        ];

        $txnCounter = 1;
        foreach ($transferDates as $date) {
            $item = $items->random();
            $fromWhId = $mainWh->id;
            $toWhId   = $whIds[array_rand(array_filter($whIds, fn($id) => $id !== $fromWhId))];
            $qty      = rand(5, 20);

            DB::table('stock_transfers')->insert([
                'txn_id'           => 'TRF-' . str_pad($txnCounter++, 6, '0', STR_PAD_LEFT),
                'from_warehouse_id'=> $fromWhId,
                'to_warehouse_id'  => $toWhId,
                'item_id'          => $item->id,
                'quantity'         => $qty,
                'occurred_at'      => $date,
                'reference'        => null,
                'actor'            => $admin->name ?? 'Admin',
                'note'             => 'Restock cabang',
                'status'           => 'completed',
                'created_at'       => $date,
                'updated_at'       => $date,
            ]);
        }

        // ─────────────────────────────────────────────────────────────────
        // STOCK ADJUSTMENTS (every 2 months)
        // ─────────────────────────────────────────────────────────────────
        $adjDates = [
            Carbon::create(2024, 2, 28),
            Carbon::create(2024, 4, 30),
            Carbon::create(2024, 6, 30),
            Carbon::create(2024, 8, 31),
            Carbon::create(2024, 10, 31),
            Carbon::create(2024, 12, 31),
            Carbon::create(2025, 2, 28),
            Carbon::create(2025, 4, 30),
            Carbon::create(2025, 6, 30),
            Carbon::create(2025, 8, 31),
            Carbon::create(2025, 10, 31),
            Carbon::create(2025, 12, 31),
        ];

        $adjCounter = 1;
        $adjReasons = ['Koreksi opname', 'Barang rusak', 'Expired', 'Barang hilang', 'Kelebihan stok'];
        foreach ($adjDates as $date) {
            $item     = $items->random();
            $whId     = $whIds[array_rand($whIds)];
            $oldQty   = rand(20, 100);
            $diff     = rand(-10, 10);
            $newQty   = max(0, $oldQty + $diff);

            DB::table('stock_adjustments')->insert([
                'txn_id'      => 'ADJ-' . str_pad($adjCounter++, 6, '0', STR_PAD_LEFT),
                'warehouse_id'=> $whId,
                'item_id'     => $item->id,
                'old_quantity'=> $oldQty,
                'new_quantity'=> $newQty,
                'difference'  => $newQty - $oldQty,
                'reason'      => $adjReasons[array_rand($adjReasons)],
                'actor'       => $admin->name ?? 'Admin',
                'occurred_at' => $date,
                'created_at'  => $date,
                'updated_at'  => $date,
            ]);
        }

        // ─────────────────────────────────────────────────────────────────
        // STOCK OPNAME (quarterly, per warehouse)
        // ─────────────────────────────────────────────────────────────────
        $opnameDates = [
            // 2024 quarters
            [2024, 1, 31, 'Q1 2024', 'submitted'],
            [2024, 4, 30, 'Q2 2024', 'submitted'],
            [2024, 7, 31, 'Q3 2024', 'submitted'],
            [2024, 10, 31, 'Q4 2024', 'submitted'],
            // 2025 quarters
            [2025, 1, 31, 'Q1 2025', 'submitted'],
            [2025, 4, 30, 'Q2 2025', 'submitted'],
            [2025, 7, 31, 'Q3 2025', 'submitted'],
            [2025, 10, 31, 'Q4 2025', 'submitted'],
            // 2026 Q1 — draft (in progress)
            [2026, 3, 19, 'Q1 2026', 'draft'],
        ];

        foreach ($opnameDates as [$y, $m, $d, $label, $opStatus]) {
            foreach ($warehouses as $wh) {
                $this->createOpname(
                    $y, $m, $d, $label, $opStatus,
                    $wh, $items, $admin
                );
            }
        }

        $this->command->info('HistoricalDataSeeder done.');
        $this->command->info("  Sales:    {$this->saleCounter} records");
        $this->command->info("  POs:      {$this->poCounter} records");
        $this->command->info("  StockIn/Out: {$this->stkCounter} records");
        $this->command->info("  Opnames:  {$this->opnameCounter} records");
    }

    // ─────────────────────────────────────────────────────────────────────
    // HELPERS
    // ─────────────────────────────────────────────────────────────────────

    private function createPO(
        int $year, int $month, int $daysInMonth,
        $items, array $suppliers, array $whIds, int $adminId,
        string $status
    ): void {
        $day      = rand(1, min(15, $daysInMonth));
        $ordDate  = Carbon::create($year, $month, $day);
        $suppId   = $suppliers[array_rand($suppliers)];
        $whId     = $whIds[array_rand($whIds)];
        $poItems  = $items->random(rand(2, 5));

        $subtotal = 0;
        $lineData = [];
        foreach ($poItems as $item) {
            $qty       = rand(20, 100);
            $price     = $item->harga_beli;
            $lineTotal = $qty * $price;
            $subtotal += $lineTotal;
            $lineData[] = [
                'item_id'            => $item->id,
                'item_name_snapshot' => $item->nama,
                'ordered_qty'        => $qty,
                'received_qty'       => in_array($status, ['received', 'partial']) ? ($status === 'partial' ? (int) round($qty * 0.5) : $qty) : 0,
                'unit_price'         => $price,
                'line_total'         => $lineTotal,
            ];
        }

        $receivedAt = null;
        if ($status === 'received' || $status === 'partial') {
            $receivedAt = $ordDate->copy()->addDays(rand(5, 14));
        }

        $poId = DB::table('purchase_orders')->insertGetId([
            'po_number'   => sprintf('PO/%04d/%02d/%04d', $year, $month, $this->poCounter++),
            'supplier_id' => $suppId,
            'warehouse_id'=> $whId,
            'ordered_by'  => $adminId,
            'received_by' => in_array($status, ['received', 'partial']) ? $adminId : null,
            'status'      => $status,
            'ordered_at'  => $ordDate,
            'expected_at' => $ordDate->copy()->addDays(7)->toDateString(),
            'received_at' => $receivedAt,
            'subtotal'    => $subtotal,
            'tax_amount'  => 0,
            'grand_total' => $subtotal,
            'note'        => null,
            'created_at'  => $ordDate,
            'updated_at'  => $ordDate,
        ]);

        foreach ($lineData as $line) {
            DB::table('purchase_order_items')->insert(array_merge($line, [
                'purchase_order_id' => $poId,
                'created_at'        => $ordDate,
                'updated_at'        => $ordDate,
            ]));
        }
    }

    private function createSale(
        int $year, int $month, int $daysInMonth,
        $items, array $customerIds, array $whIds, array $kasirIds
    ): void {
        $day        = rand(1, $daysInMonth);
        $saleDate   = Carbon::create($year, $month, $day, rand(8, 21), rand(0, 59));
        $whId       = $whIds[array_rand($whIds)];
        $cashierId  = $kasirIds[array_rand($kasirIds)];
        $customerId = rand(0, 2) === 0 ? $customerIds[array_rand($customerIds)] : null;

        $saleItemsRaw = $items->random(rand(2, 4));
        $subtotal     = 0;
        $lineData     = [];

        foreach ($saleItemsRaw as $item) {
            $qty       = rand(1, 5);
            $price     = $item->harga_jual;
            $lineTotal = $qty * $price;
            $subtotal += $lineTotal;
            $lineData[] = [
                'item_id'             => $item->id,
                'item_name_snapshot'  => $item->nama,
                'item_code_snapshot'  => $item->kode_item,
                'unit_price'          => $price,
                'quantity'            => $qty,
                'discount_amount'     => 0,
                'line_total'          => $lineTotal,
            ];
        }

        $discount = rand(0, 4) === 0 ? (int) round(rand(5, 25) * 1000) : 0;
        $grandTotal = max(0, $subtotal - $discount);
        $payMethods = ['cash', 'cash', 'cash', 'qris', 'transfer', 'card'];
        $payMethod  = $payMethods[array_rand($payMethods)];
        $payAmount  = $payMethod === 'cash'
            ? (int) (ceil($grandTotal / 10000) * 10000)
            : $grandTotal;

        $saleId = DB::table('sale_headers')->insertGetId([
            'sale_number'    => sprintf('INV/%04d/%02d/%05d', $year, $month, $this->saleCounter++),
            'warehouse_id'   => $whId,
            'customer_id'    => $customerId,
            'cashier_id'     => $cashierId,
            'occurred_at'    => $saleDate,
            'subtotal'       => $subtotal,
            'discount_amount'=> $discount,
            'tax_amount'     => 0,
            'grand_total'    => $grandTotal,
            'payment_method' => $payMethod,
            'payment_amount' => $payAmount,
            'change_amount'  => max(0, $payAmount - $grandTotal),
            'status'         => 'completed',
            'note'           => null,
            'created_at'     => $saleDate,
            'updated_at'     => $saleDate,
        ]);

        foreach ($lineData as $line) {
            DB::table('sale_items')->insert(array_merge($line, [
                'sale_header_id' => $saleId,
                'created_at'     => $saleDate,
                'updated_at'     => $saleDate,
            ]));
        }
    }

    private function createStockMovement(
        string $type,
        int $year, int $month, int $daysInMonth,
        $items, array $whIds, object $admin
    ): void {
        $day  = rand(1, $daysInMonth);
        $date = Carbon::create($year, $month, $day, rand(8, 17), rand(0, 59));
        $item = $items->random();
        $whId = $whIds[array_rand($whIds)];
        $qty  = rand(5, 50);

        $sources = ['Manual', 'Supplier', 'Purchase Order', 'Retur Barang'];
        $inParties  = ['CV Maju Jaya', 'PT Sentosa', 'UD Berkah', 'CV Prima', 'Supplier Lokal'];
        $outReasons = ['Barang rusak', 'Sample promosi', 'Barang hilang', 'Kadaluarsa', 'Koreksi stok'];
        $categories = ['Pembelian', 'Penerimaan', 'Koreksi', 'Retur', 'Sample'];

        $source   = $type === 'stock_in' ? $sources[array_rand($sources)] : 'Manual';
        $party    = $type === 'stock_in' ? $inParties[array_rand($inParties)] : null;
        $note     = $type === 'stock_out' ? $outReasons[array_rand($outReasons)] : null;
        $category = $categories[array_rand($categories)];
        $ref      = $type === 'stock_in'
            ? sprintf('STK-IN/%04d/%02d/%04d', $year, $month, $this->stkCounter)
            : sprintf('STK-OUT/%04d/%02d/%04d', $year, $month, $this->stkCounter);

        // Estimate balance (non-authoritative — for display only)
        $warehouseBalance = rand(10, 200);
        $globalBalance    = $warehouseBalance * count($whIds);

        DB::table('transactions')->insert([
            'txn_id'       => 'STK-' . strtoupper(Str::random(10)),
            'item_id'      => $item->id,
            'warehouse_id' => $whId,
            'occurred_at'  => $date,
            'amount'       => $qty,
            'currency'     => 'unit',
            'status'       => 'completed',
            'type'         => $type,
            'actor'        => $admin->name ?? 'Admin',
            'source'       => $source,
            'party'        => $party,
            'reference'    => $ref,
            'category'     => $category,
            'note'         => $note,
            'metadata'     => json_encode([
                'balance_after'        => $warehouseBalance,
                'global_balance_after' => $globalBalance,
            ]),
            'created_at'   => $date,
            'updated_at'   => $date,
        ]);

        $this->stkCounter++;
    }

    private function createOpname(
        int $year, int $month, int $day, string $label, string $status,
        object $wh, $items, object $admin
    ): void {
        $date = Carbon::create($year, $month, $day);
        $refNumber = sprintf('OPN/%04d/%s/%02d-%d', $year, $label, $this->opnameCounter, $wh->id);

        $opnameId = DB::table('stock_opnames')->insertGetId([
            'ref_number'   => $refNumber,
            'warehouse_id' => $wh->id,
            'status'       => $status,
            'date'         => $date->toDateString(),
            'created_by'   => $admin->name ?? 'Admin',
            'submitted_at' => $status === 'submitted' ? $date->copy()->addHours(rand(2, 6)) : null,
            'note'         => $status === 'draft' ? 'Sedang dalam proses penghitungan' : "Stock opname {$label}",
            'created_at'   => $date,
            'updated_at'   => $date,
        ]);

        // Pick 10-20 random items for this opname
        $opnameItems = $items->random(min(rand(10, 20), $items->count()));
        $insertRows  = [];

        foreach ($opnameItems as $item) {
            $systemQty = rand(5, 120);
            $variance  = $status === 'draft'
                ? null                          // not counted yet
                : rand(-5, 5);                  // small physical variance
            $actualQty = $variance !== null ? max(0, $systemQty + $variance) : null;

            $insertRows[] = [
                'opname_id'          => $opnameId,
                'item_id'            => $item->id,
                'item_name_snapshot' => $item->nama,
                'item_code_snapshot' => $item->kode_item,
                'system_qty'         => $systemQty,
                'actual_qty'         => $actualQty,
                'variance'           => $actualQty !== null ? ($actualQty - $systemQty) : null,
                'note'               => null,
                'created_at'         => $date,
                'updated_at'         => $date,
            ];
        }

        DB::table('stock_opname_items')->insert($insertRows);
        $this->opnameCounter++;
    }

    private function createMonthlyExpenses(int $year, int $month, int $whId, int $adminId): void
    {
        $date1 = Carbon::create($year, $month, 1)->toDateString();
        $date5 = Carbon::create($year, $month, 5)->toDateString();
        $dateMid = Carbon::create($year, $month, rand(10, 20))->toDateString();

        $now = now();
        DB::table('expenses')->insert([
            [
                'occurred_at' => $date1,
                'category'    => 'Gaji Karyawan',
                'amount'      => rand(8, 12) * 1000000,
                'description' => "Gaji karyawan bulan {$month}/{$year}",
                'warehouse_id'=> $whId,
                'created_by'  => $adminId,
                'created_at'  => $now,
                'updated_at'  => $now,
            ],
            [
                'occurred_at' => $date5,
                'category'    => 'Sewa Tempat',
                'amount'      => 5000000,
                'description' => "Sewa tempat bulan {$month}/{$year}",
                'warehouse_id'=> $whId,
                'created_by'  => $adminId,
                'created_at'  => $now,
                'updated_at'  => $now,
            ],
            [
                'occurred_at' => $dateMid,
                'category'    => 'Utilitas',
                'amount'      => rand(800, 1500) * 1000,
                'description' => 'Listrik, air, internet',
                'warehouse_id'=> $whId,
                'created_by'  => $adminId,
                'created_at'  => $now,
                'updated_at'  => $now,
            ],
        ]);

        // 1-2 variable expenses
        $varCategories = ['Transportasi', 'Pemasaran', 'Perlengkapan', 'Pemeliharaan', 'Lain-lain'];
        $numVar = rand(1, 2);
        for ($v = 0; $v < $numVar; $v++) {
            $varDate = Carbon::create($year, $month, rand(1, cal_days_in_month(CAL_GREGORIAN, $month, $year)))->toDateString();
            DB::table('expenses')->insert([
                'occurred_at' => $varDate,
                'category'    => $varCategories[array_rand($varCategories)],
                'amount'      => rand(100, 800) * 1000,
                'description' => null,
                'warehouse_id'=> $whId,
                'created_by'  => $adminId,
                'created_at'  => $now,
                'updated_at'  => $now,
            ]);
        }
    }
}
