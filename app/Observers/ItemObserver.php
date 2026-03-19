<?php

namespace App\Observers;

use App\Models\Item;
use App\Models\Warehouse;
use App\Models\WarehouseItemPrice;
use Illuminate\Support\Facades\DB;

class ItemObserver
{
    /**
     * When a new item is created, seed outlet prices for all warehouses
     * using the global harga_jual as the default.
     */
    public function created(Item $item): void
    {
        $warehouses = Warehouse::where('is_active', true)->pluck('id');
        $now        = now();

        $rows = $warehouses->map(fn ($whId) => [
            'warehouse_id' => $whId,
            'item_id'      => $item->id,
            'harga_jual'   => $item->harga_jual,
            'created_at'   => $now,
            'updated_at'   => $now,
        ])->all();

        DB::table('warehouse_item_prices')->insertOrIgnore($rows);
    }

    /**
     * When the global harga_jual changes, update the main outlet's price
     * to stay in sync. Other outlets keep their overrides untouched.
     */
    public function updated(Item $item): void
    {
        if (! $item->wasChanged('harga_jual')) {
            return;
        }

        $mainWarehouse = Warehouse::where('is_default', true)->first();
        if (! $mainWarehouse) {
            return;
        }

        WarehouseItemPrice::updateOrCreate(
            ['warehouse_id' => $mainWarehouse->id, 'item_id' => $item->id],
            ['harga_jual' => $item->harga_jual]
        );
    }
}
