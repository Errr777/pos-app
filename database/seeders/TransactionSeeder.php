<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Item;
use App\Models\Transaction;
use App\Models\Warehouse;
use App\Models\WarehouseItem;
use Illuminate\Support\Str;

class TransactionSeeder extends Seeder
{
    public function run(): void
    {
        $items = Item::all();
        if ($items->isEmpty()) return;

        // Get default warehouse (created by warehouse migration)
        $warehouse = Warehouse::where('is_default', true)->first() ?? Warehouse::first();
        if (!$warehouse) return;

        $warehouseId = $warehouse->id;

        $suppliers = ['PT Sumber Rejeki', 'CV Mitra Abadi', 'UD Maju Jaya', 'PT Distributor Prima'];
        $receivers = ['Outlet A', 'Customer B', 'Produksi', 'Divisi Gudang', 'Toko Cabang 1'];
        $actors    = ['Admin', 'Kasir', 'Gudang'];
        $sources   = ['Manual', 'Purchase Order', 'Sales Order', 'Adjustment'];
        $notes     = ['Stok masuk dari supplier', 'Pengiriman batch reguler', 'Restock gudang', 'Penyesuaian stok', null, null, null];

        foreach ($items as $item) {
            $runningBalance = 0;

            // Seed 3-7 stock_in records per item (spread over last 90 days)
            $stockInCount = rand(3, 7);
            for ($i = 0; $i < $stockInCount; $i++) {
                $qty = rand(10, 100);
                $runningBalance += $qty;

                Transaction::create([
                    'txn_id'       => 'STK-IN-' . strtoupper(Str::random(8)),
                    'item_id'      => $item->id,
                    'warehouse_id' => $warehouseId,
                    'occurred_at'  => now()->subDays(rand(30, 90))->startOfDay(),
                    'amount'       => $qty,
                    'currency'     => 'unit',
                    'status'       => 'completed',
                    'type'         => 'stock_in',
                    'actor'        => $actors[array_rand($actors)],
                    'source'       => $sources[array_rand($sources)],
                    'party'        => $suppliers[array_rand($suppliers)],
                    'reference'    => 'IN-' . rand(10000, 99999),
                    'category'     => $item->kategori,
                    'qrcode'       => $item->kode_item,
                    'metadata'     => ['balance_after' => $runningBalance, 'global_balance_after' => $runningBalance],
                    'note'         => $notes[array_rand($notes)],
                ]);
            }

            // Seed 1-4 stock_out records per item (spread over last 30 days)
            $stockOutCount = rand(1, 4);
            for ($i = 0; $i < $stockOutCount; $i++) {
                if ($runningBalance <= 0) break;

                $maxOut = max(1, (int) ($runningBalance * 0.4));
                $qty    = rand(1, $maxOut);
                $runningBalance -= $qty;

                Transaction::create([
                    'txn_id'       => 'STK-OUT-' . strtoupper(Str::random(8)),
                    'item_id'      => $item->id,
                    'warehouse_id' => $warehouseId,
                    'occurred_at'  => now()->subDays(rand(0, 29))->startOfDay(),
                    'amount'       => $qty,
                    'currency'     => 'unit',
                    'status'       => 'completed',
                    'type'         => 'stock_out',
                    'actor'        => $actors[array_rand($actors)],
                    'source'       => $sources[array_rand($sources)],
                    'party'        => $receivers[array_rand($receivers)],
                    'reference'    => 'OUT-' . rand(10000, 99999),
                    'category'     => $item->kategori,
                    'qrcode'       => $item->kode_item,
                    'metadata'     => ['balance_after' => max(0, $runningBalance), 'global_balance_after' => max(0, $runningBalance)],
                    'note'         => fake()->optional(0.4)->sentence(),
                ]);
            }

            $finalBalance = max(0, $runningBalance);

            // Update item stock to match the computed running balance
            $item->update(['stok' => $finalBalance]);

            // Sync warehouse_items.stok to match
            WarehouseItem::updateOrCreate(
                ['warehouse_id' => $warehouseId, 'item_id' => $item->id],
                ['stok' => $finalBalance]
            );
        }
    }
}
