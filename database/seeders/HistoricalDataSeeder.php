<?php

namespace Database\Seeders;

use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Generates realistic historical POS data from Jan 2023 → Mar 2026.
 *
 * Volume per month:
 *   Sales      : 50–100 transactions (seasonal multiplier applied)
 *   POs        : 3–6 (only for completed months)
 *   Expenses   : 5–8 per warehouse, differentiated by outlet size / city
 *   Stock In   : 3–6 / month
 *   Stock Out  : 1–3 / month
 *
 * Seasonal multiplier (realistic Indonesian retail):
 *   Mar (pre-Lebaran) 1.50 · Apr (Lebaran) 1.30 · Dec (Christmas/NYE) 1.60
 *   Jan (post-holiday) 0.75 · Feb 0.80
 */
class HistoricalDataSeeder extends Seeder
{
    private int $saleCounter    = 1;
    private int $poCounter      = 1;
    private int $stkCounter     = 1;
    private int $opnameCounter  = 1;
    private int $transferCounter = 1;
    private int $adjCounter     = 1;

    /** Monthly seasonal multiplier (realistic Indonesian retail cycle) */
    private array $seasonal = [
        1  => 0.75,   // Jan — post-holiday slump
        2  => 0.80,   // Feb — slow
        3  => 1.50,   // Mar — pre-Lebaran shopping peak
        4  => 1.30,   // Apr — Lebaran / Idul Fitri
        5  => 0.90,   // May — normalise
        6  => 0.90,   // Jun
        7  => 1.10,   // Jul — school season
        8  => 1.05,   // Aug — Independence Day / back-to-school
        9  => 0.90,   // Sep
        10 => 0.95,   // Oct
        11 => 1.15,   // Nov — 11.11 promo
        12 => 1.60,   // Dec — Christmas / NYE peak
    ];

    public function run(): void
    {
        // ── Load reference data ──────────────────────────────────────────────
        $warehouses = DB::table('warehouses')->orderBy('id')->get();
        $mainWh     = $warehouses->firstWhere('is_default', true);
        $items      = DB::table('items')->where('type', 'barang')->get();
        $customers  = DB::table('customers')->pluck('id')->toArray();
        $suppliers  = DB::table('suppliers')->pluck('id')->toArray();
        $admin      = DB::table('users')->where('role', 'admin')->first();
        $whIds      = $warehouses->pluck('id')->toArray();

        // All kasir IDs (fallback pool)
        $kasirIds = DB::table('users')->where('role', 'kasir')->pluck('id')->toArray();
        if (empty($kasirIds)) {
            $kasirIds = [$admin->id];
        }

        // Build kasir-per-warehouse map from user_warehouses assignments
        $kasirByWarehouse = $this->buildKasirMap($kasirIds, $whIds);

        // ── Monthly loop: Jan 2023 → Mar 2026 ───────────────────────────────
        $months = [];
        for ($y = 2023; $y <= 2026; $y++) {
            $maxM = ($y === 2026) ? 3 : 12;
            for ($m = 1; $m <= $maxM; $m++) {
                $months[] = [$y, $m];
            }
        }

        foreach ($months as [$year, $month]) {
            $isCurrentMonth = ($year === 2026 && $month === 3);
            $daysInMonth    = cal_days_in_month(CAL_GREGORIAN, $month, $year);
            $multiplier     = $this->seasonal[$month] ?? 1.0;

            // ── PURCHASE ORDERS (received, skip current month) ─────────────
            if (! $isCurrentMonth) {
                $numPOs = rand(3, 6);
                for ($p = 0; $p < $numPOs; $p++) {
                    $this->createPO(
                        $year, $month, $daysInMonth,
                        $items, $suppliers, $whIds, $admin->id,
                        'received'
                    );
                }
            }

            // ── SALES ──────────────────────────────────────────────────────
            // Minimum 50 / month; scales up in peak seasons
            $numSales = (int) max(50, round(65 * $multiplier));
            for ($s = 0; $s < $numSales; $s++) {
                $this->createSale(
                    $year, $month, $daysInMonth,
                    $items, $customers,
                    $whIds, $mainWh->id,
                    $kasirIds, $kasirByWarehouse
                );
            }

            // ── EXPENSES (per warehouse, sized to outlet) ──────────────────
            foreach ($warehouses as $wh) {
                $this->createMonthlyExpenses($year, $month, $wh, $admin->id);
            }

            // ── STOCK IN (3–6 per month) ───────────────────────────────────
            $numIn = rand(3, 6);
            for ($i = 0; $i < $numIn; $i++) {
                $this->createStockMovement(
                    'stock_in', $year, $month, $daysInMonth,
                    $items, $whIds, $admin
                );
            }

            // ── STOCK OUT (1–3 per month, breakage / sampling) ────────────
            $numOut = rand(1, 3);
            for ($i = 0; $i < $numOut; $i++) {
                $this->createStockMovement(
                    'stock_out', $year, $month, $daysInMonth,
                    $items, $whIds, $admin
                );
            }
        }

        // ── PENDING PURCHASE ORDERS (current month — shows badge) ───────────
        foreach (['draft', 'ordered', 'partial'] as $status) {
            $this->createPO(2026, 3, 31, $items, $suppliers, $whIds, $admin->id, $status);
        }

        // ── STOCK TRANSFERS (quarterly 2023–2026) ────────────────────────────
        $transferDates = [
            Carbon::create(2023, 3, 20),
            Carbon::create(2023, 6, 15),
            Carbon::create(2023, 9, 8),
            Carbon::create(2023, 12, 6),
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

        $fromWhId = $mainWh->id;
        foreach ($transferDates as $date) {
            $item    = $items->random();
            $others  = array_values(array_filter($whIds, fn($id) => $id !== $fromWhId));
            $toWhId  = $others[array_rand($others)];
            $qty     = rand(5, 25);

            DB::table('stock_transfers')->insert([
                'txn_id'            => 'TRF-' . str_pad($this->transferCounter++, 6, '0', STR_PAD_LEFT),
                'from_warehouse_id' => $fromWhId,
                'to_warehouse_id'   => $toWhId,
                'item_id'           => $item->id,
                'quantity'          => $qty,
                'occurred_at'       => $date,
                'reference'         => null,
                'actor'             => $admin->name ?? 'Admin',
                'note'              => 'Restock cabang',
                'status'            => 'completed',
                'created_at'        => $date,
                'updated_at'        => $date,
            ]);
        }

        // ── STOCK ADJUSTMENTS (every 2 months, 2023–2025) ───────────────────
        $adjDates = [];
        for ($y = 2023; $y <= 2025; $y++) {
            for ($m = 2; $m <= 12; $m += 2) {
                $lastDay = cal_days_in_month(CAL_GREGORIAN, $m, $y);
                $adjDates[] = Carbon::create($y, $m, $lastDay);
            }
        }

        $adjReasons = ['Koreksi opname', 'Barang rusak', 'Expired', 'Barang hilang', 'Kelebihan stok', 'Selisih hitung'];
        foreach ($adjDates as $date) {
            $item   = $items->random();
            $whId   = $whIds[array_rand($whIds)];
            $oldQty = rand(20, 100);
            $diff   = rand(-12, 8);
            $newQty = max(0, $oldQty + $diff);

            DB::table('stock_adjustments')->insert([
                'txn_id'       => 'ADJ-' . str_pad($this->adjCounter++, 6, '0', STR_PAD_LEFT),
                'warehouse_id' => $whId,
                'item_id'      => $item->id,
                'old_quantity' => $oldQty,
                'new_quantity' => $newQty,
                'difference'   => $newQty - $oldQty,
                'reason'       => $adjReasons[array_rand($adjReasons)],
                'actor'        => $admin->name ?? 'Admin',
                'occurred_at'  => $date,
                'created_at'   => $date,
                'updated_at'   => $date,
            ]);
        }

        // ── STOCK OPNAME (quarterly per warehouse 2023–2026) ─────────────────
        $opnameDates = [
            // 2023
            [2023,  1, 31, 'Q1 2023', 'submitted'],
            [2023,  4, 30, 'Q2 2023', 'submitted'],
            [2023,  7, 31, 'Q3 2023', 'submitted'],
            [2023, 10, 31, 'Q4 2023', 'submitted'],
            // 2024
            [2024,  1, 31, 'Q1 2024', 'submitted'],
            [2024,  4, 30, 'Q2 2024', 'submitted'],
            [2024,  7, 31, 'Q3 2024', 'submitted'],
            [2024, 10, 31, 'Q4 2024', 'submitted'],
            // 2025
            [2025,  1, 31, 'Q1 2025', 'submitted'],
            [2025,  4, 30, 'Q2 2025', 'submitted'],
            [2025,  7, 31, 'Q3 2025', 'submitted'],
            [2025, 10, 31, 'Q4 2025', 'submitted'],
            // 2026 Q1 — in progress (draft)
            [2026,  3, 19, 'Q1 2026', 'draft'],
        ];

        foreach ($opnameDates as [$y, $m, $d, $label, $opStatus]) {
            foreach ($warehouses as $wh) {
                $this->createOpname($y, $m, $d, $label, $opStatus, $wh, $items, $admin);
            }
        }

        // ── Summary ──────────────────────────────────────────────────────────
        $this->command->info('HistoricalDataSeeder done.');
        $this->command->info("  Sales    : {$this->saleCounter}");
        $this->command->info("  POs      : {$this->poCounter}");
        $this->command->info("  StockMov : {$this->stkCounter}");
        $this->command->info("  Transfers: {$this->transferCounter}");
        $this->command->info("  Adj      : {$this->adjCounter}");
        $this->command->info("  Opnames  : {$this->opnameCounter}");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // HELPERS
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Build a warehouse_id → [kasir_ids] map from user_warehouses assignments.
     * Falls back to all kasir IDs for warehouses with no assignment.
     */
    private function buildKasirMap(array $kasirIds, array $whIds): array
    {
        $map = [];
        foreach ($kasirIds as $kasirId) {
            $assigned = DB::table('user_warehouses')
                ->where('user_id', $kasirId)
                ->pluck('warehouse_id')
                ->toArray();
            foreach ($assigned as $wId) {
                $map[$wId][] = $kasirId;
            }
        }
        // Ensure every warehouse has at least one kasir
        foreach ($whIds as $wId) {
            if (empty($map[$wId])) {
                $map[$wId] = $kasirIds;
            }
        }
        return $map;
    }

    /**
     * Weighted warehouse pick — main outlet gets ~40% of all sales.
     */
    private function pickWarehouseId(array $whIds, int $mainWhId): int
    {
        if (rand(1, 10) <= 4) {
            return $mainWhId;
        }
        $others = array_values(array_filter($whIds, fn($id) => $id !== $mainWhId));
        return $others[array_rand($others)];
    }

    // ── CREATE PO ────────────────────────────────────────────────────────────
    private function createPO(
        int $year, int $month, int $daysInMonth,
        $items, array $suppliers, array $whIds, int $adminId,
        string $status
    ): void {
        $day     = rand(1, min(15, $daysInMonth));
        $ordDate = Carbon::create($year, $month, $day);
        $suppId  = $suppliers[array_rand($suppliers)];
        $whId    = $whIds[array_rand($whIds)];
        $poItems = $items->random(rand(2, 6));

        $subtotal = 0;
        $lineData = [];
        foreach ($poItems as $item) {
            $qty       = rand(20, 120);
            $price     = $item->harga_beli;
            $lineTotal = $qty * $price;
            $subtotal += $lineTotal;
            $lineData[] = [
                'item_id'            => $item->id,
                'item_name_snapshot' => $item->nama,
                'ordered_qty'        => $qty,
                'received_qty'       => match ($status) {
                    'received' => $qty,
                    'partial'  => (int) round($qty * 0.5),
                    default    => 0,
                },
                'unit_price'  => $price,
                'line_total'  => $lineTotal,
            ];
        }

        $receivedAt = in_array($status, ['received', 'partial'])
            ? $ordDate->copy()->addDays(rand(5, 14))
            : null;

        $poId = DB::table('purchase_orders')->insertGetId([
            'po_number'    => sprintf('PO/%04d/%02d/%04d', $year, $month, $this->poCounter++),
            'supplier_id'  => $suppId,
            'warehouse_id' => $whId,
            'ordered_by'   => $adminId,
            'received_by'  => $receivedAt ? $adminId : null,
            'status'       => $status,
            'ordered_at'   => $ordDate,
            'expected_at'  => $ordDate->copy()->addDays(7)->toDateString(),
            'received_at'  => $receivedAt,
            'subtotal'     => $subtotal,
            'tax_amount'   => 0,
            'grand_total'  => $subtotal,
            'note'         => null,
            'created_at'   => $ordDate,
            'updated_at'   => $ordDate,
        ]);

        foreach ($lineData as $line) {
            DB::table('purchase_order_items')->insert(array_merge($line, [
                'purchase_order_id' => $poId,
                'created_at'        => $ordDate,
                'updated_at'        => $ordDate,
            ]));
        }
    }

    // ── CREATE SALE ──────────────────────────────────────────────────────────
    private function createSale(
        int $year, int $month, int $daysInMonth,
        $items, array $customerIds, array $whIds, int $mainWhId,
        array $kasirIds, array $kasirByWarehouse
    ): void {
        $day      = rand(1, $daysInMonth);
        $hour     = rand(8, 21);
        $minute   = rand(0, 59);
        $saleDate = Carbon::create($year, $month, $day, $hour, $minute);

        // Main outlet gets ~40% of volume; others share the rest
        $whId      = $this->pickWarehouseId($whIds, $mainWhId);
        $cashierId = ($kasirByWarehouse[$whId] ?? $kasirIds)[
            array_rand($kasirByWarehouse[$whId] ?? $kasirIds)
        ];

        // 30% chance of a registered customer; rest walk-in
        $customerId = rand(1, 10) <= 3 ? $customerIds[array_rand($customerIds)] : null;

        // 70% normal (2–3 items), 30% larger purchase (4–6 items)
        $numItems    = rand(1, 10) <= 7 ? rand(2, 3) : rand(4, 6);
        $saleItems   = $items->random(min($numItems, $items->count()));
        $subtotal    = 0;
        $lineData    = [];

        foreach ($saleItems as $item) {
            $qty       = rand(1, 5);
            $price     = $item->harga_jual;
            $lineTotal = $qty * $price;
            $subtotal += $lineTotal;
            $lineData[] = [
                'item_id'            => $item->id,
                'item_name_snapshot' => $item->nama,
                'item_code_snapshot' => $item->kode_item,
                'unit_price'         => $price,
                'quantity'           => $qty,
                'discount_amount'    => 0,
                'line_total'         => $lineTotal,
            ];
        }

        // ~15% chance of a small discount
        $discount   = rand(1, 100) <= 15 ? (int) round(rand(5, 30) * 1000) : 0;
        $grandTotal = max(0, $subtotal - $discount);

        // Payment mix: cash 55%, qris 25%, transfer 20%
        $methodRoll = rand(1, 100);
        $payMethod  = match (true) {
            $methodRoll <= 55 => 'cash',
            $methodRoll <= 80 => 'qris',
            default           => 'transfer',
        };

        $payAmount = $payMethod === 'cash'
            ? (int) (ceil($grandTotal / 10000) * 10000)
            : $grandTotal;

        $saleId = DB::table('sale_headers')->insertGetId([
            'sale_number'     => sprintf('TRX/%04d/%02d/%05d', $year, $month, $this->saleCounter++),
            'warehouse_id'    => $whId,
            'customer_id'     => $customerId,
            'cashier_id'      => $cashierId,
            'occurred_at'     => $saleDate,
            'subtotal'        => $subtotal,
            'discount_amount' => $discount,
            'tax_amount'      => 0,
            'grand_total'     => $grandTotal,
            'payment_method'  => $payMethod,
            'payment_amount'  => $payAmount,
            'change_amount'   => max(0, $payAmount - $grandTotal),
            'status'          => 'completed',
            'note'            => null,
            'created_at'      => $saleDate,
            'updated_at'      => $saleDate,
        ]);

        foreach ($lineData as $line) {
            DB::table('sale_items')->insert(array_merge($line, [
                'sale_header_id' => $saleId,
                'created_at'     => $saleDate,
                'updated_at'     => $saleDate,
            ]));
        }
    }

    // ── CREATE STOCK MOVEMENT ─────────────────────────────────────────────────
    private function createStockMovement(
        string $type,
        int $year, int $month, int $daysInMonth,
        $items, array $whIds, object $admin
    ): void {
        $day  = rand(1, $daysInMonth);
        $date = Carbon::create($year, $month, $day, rand(8, 17), rand(0, 59));
        $item = $items->random();
        $whId = $whIds[array_rand($whIds)];
        $qty  = rand(5, 60);

        $inParties  = [
            'CV Maju Jaya', 'PT Sentosa Makmur', 'UD Berkah Pangan',
            'CV Prima Sejahtera', 'Supplier Lokal', 'PT Nusa Indah',
        ];
        $outReasons = [
            'Barang rusak', 'Sample promosi', 'Barang hilang',
            'Kadaluarsa', 'Koreksi stok', 'Pemakaian internal',
        ];
        $sources    = ['Manual', 'Supplier', 'Purchase Order', 'Retur Barang'];

        $party = $type === 'stock_in' ? $inParties[array_rand($inParties)] : null;
        $note  = $type === 'stock_out' ? $outReasons[array_rand($outReasons)] : null;
        $prefix = $type === 'stock_in' ? 'STK-IN' : 'STK-OUT';
        $ref   = sprintf('%s/%04d/%02d/%04d', $prefix, $year, $month, $this->stkCounter);

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
            'source'       => $sources[array_rand($sources)],
            'party'        => $party,
            'reference'    => $ref,
            'category'     => $type === 'stock_in' ? 'Penerimaan' : 'Pengeluaran',
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

    // ── CREATE MONTHLY EXPENSES ───────────────────────────────────────────────
    /**
     * Realistic expense breakdown per outlet.
     *
     * Toko Pusat (Jakarta, 5 staff):
     *   Salary 22–28 juta · Rent 15–18 juta · Electricity 2–3.5 juta
     *   Internet 500–900 rb · BPJS 2–3 juta
     *
     * Branch outlets (2–3 staff):
     *   Salary 10–14 juta · Rent 5–9 juta (varies by city)
     *   Electricity 800 rb–1.5 juta · Internet 250–450 rb · BPJS 700 rb–1.2 juta
     */
    private function createMonthlyExpenses(int $year, int $month, object $wh, int $adminId): void
    {
        $isMain  = (bool) $wh->is_default;
        $city    = $wh->city ?? '';
        $now     = now();
        $days    = cal_days_in_month(CAL_GREGORIAN, $month, $year);

        // Salary — scales with headcount per outlet
        $salary = $isMain
            ? rand(22, 28) * 1_000_000
            : rand(10, 14) * 1_000_000;

        // Rent — city-sensitive
        $rent = match ($city) {
            'Jakarta'  => rand(15, 18) * 1_000_000,
            'Surabaya' => rand(7, 10)  * 1_000_000,
            'Bandung'  => rand(6, 9)   * 1_000_000,
            'Semarang' => rand(5, 8)   * 1_000_000,
            default    => rand(5, 8)   * 1_000_000,
        };

        // Fixed utilities
        $electricity = $isMain ? rand(2000, 3500) * 1_000 : rand(800, 1500) * 1_000;
        $internet    = $isMain ? rand(500, 900)   * 1_000 : rand(250, 450)  * 1_000;
        $bpjs        = $isMain ? rand(2000, 3000) * 1_000 : rand(700, 1200) * 1_000;

        $d1  = Carbon::create($year, $month, 1)->toDateString();
        $d3  = Carbon::create($year, $month, 3)->toDateString();
        $d5  = Carbon::create($year, $month, 5)->toDateString();
        $d10 = Carbon::create($year, $month, 10)->toDateString();

        $fixed = [
            [$d1,  'Gaji Karyawan',        $salary,      "Gaji karyawan bulan {$month}/{$year}"],
            [$d5,  'Sewa Tempat',           $rent,        "Sewa tempat bulan {$month}/{$year}"],
            [$d3,  'BPJS Ketenagakerjaan',  $bpjs,        "Iuran BPJS bulan {$month}/{$year}"],
            [$d10, 'Listrik & Air',         $electricity, 'Tagihan listrik dan air'],
            [$d10, 'Internet & Telepon',    $internet,    'Tagihan internet dan telepon'],
        ];

        foreach ($fixed as [$date, $cat, $amount, $desc]) {
            DB::table('expenses')->insert([
                'occurred_at'  => $date,
                'category'     => $cat,
                'amount'       => $amount,
                'description'  => $desc,
                'warehouse_id' => $wh->id,
                'created_by'   => $adminId,
                'created_at'   => $now,
                'updated_at'   => $now,
            ]);
        }

        // Variable expenses (1–3 per month, more for main outlet)
        $varOptions = [
            ['Perlengkapan Toko',      rand(200,  800) * 1_000, 'Pembelian perlengkapan dan alat tulis'],
            ['Transportasi',           rand(100,  500) * 1_000, 'Ongkos pengiriman dan transportasi'],
            ['Pemeliharaan Peralatan', rand(150,  700) * 1_000, 'Service AC, komputer, mesin kasir'],
            ['Pemasaran & Promosi',    rand(200, 1500) * 1_000, 'Iklan, brosur, media sosial'],
            ['Kebersihan',             rand(100,  400) * 1_000, 'Jasa kebersihan dan produk kebersihan'],
            ['Konsumsi Rapat',         rand(50,   300) * 1_000, null],
            ['Lain-lain',              rand(50,   400) * 1_000, null],
        ];
        shuffle($varOptions);
        $numVar = rand(1, $isMain ? 3 : 2);
        for ($v = 0; $v < $numVar; $v++) {
            [$cat, $amount, $desc] = $varOptions[$v];
            $varDate = Carbon::create($year, $month, rand(1, $days))->toDateString();
            DB::table('expenses')->insert([
                'occurred_at'  => $varDate,
                'category'     => $cat,
                'amount'       => $amount,
                'description'  => $desc,
                'warehouse_id' => $wh->id,
                'created_by'   => $adminId,
                'created_at'   => $now,
                'updated_at'   => $now,
            ]);
        }
    }

    // ── CREATE STOCK OPNAME ───────────────────────────────────────────────────
    private function createOpname(
        int $year, int $month, int $day, string $label, string $status,
        object $wh, $items, object $admin
    ): void {
        $date      = Carbon::create($year, $month, $day);
        $refNumber = sprintf('OPN/%04d/%s/%02d-%d', $year, $label, $this->opnameCounter, $wh->id);

        $opnameId = DB::table('stock_opnames')->insertGetId([
            'ref_number'   => $refNumber,
            'warehouse_id' => $wh->id,
            'status'       => $status,
            'date'         => $date->toDateString(),
            'created_by'   => $admin->name ?? 'Admin',
            'submitted_at' => $status === 'submitted'
                ? $date->copy()->addHours(rand(2, 6))
                : null,
            'note' => $status === 'draft'
                ? 'Sedang dalam proses penghitungan'
                : "Stock opname {$label}",
            'created_at' => $date,
            'updated_at' => $date,
        ]);

        $opnameItems = $items->random(min(rand(10, 20), $items->count()));
        $rows        = [];

        foreach ($opnameItems as $item) {
            $systemQty = rand(5, 120);
            $variance  = $status === 'draft' ? null : rand(-6, 6);
            $actualQty = $variance !== null ? max(0, $systemQty + $variance) : null;

            $rows[] = [
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

        DB::table('stock_opname_items')->insert($rows);
        $this->opnameCounter++;
    }
}
