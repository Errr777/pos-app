<?php

namespace App\Traits;

use Illuminate\Database\Eloquent\Builder;

trait FiltersWarehouseByUser
{
    /**
     * Apply warehouse restriction to a query based on the authenticated user.
     *
     * Usage in controllers:
     *   $this->applyWarehouseFilter($query, 'warehouse_id');
     *   $this->applyWarehouseFilter($query, 'warehouses.id');
     *
     * @param Builder $query
     * @param string  $column  The column name to filter (e.g. 'warehouse_id')
     * @return Builder
     */
    protected function applyWarehouseFilter(Builder $query, string $column = 'warehouse_id'): Builder
    {
        $ids = auth()->user()?->allowedWarehouseIds() ?? [];
        if (!empty($ids)) {
            $query->whereIn($column, $ids);
        }
        return $query;
    }

    /**
     * Get the allowed warehouse IDs for the current user.
     * Empty = all warehouses allowed.
     */
    protected function allowedWarehouseIds(): array
    {
        return auth()->user()?->allowedWarehouseIds() ?? [];
    }

    /**
     * Check if the current user can access a specific warehouse.
     */
    protected function canAccessWarehouse(int $warehouseId): bool
    {
        $ids = $this->allowedWarehouseIds();
        return empty($ids) || in_array($warehouseId, $ids);
    }
}
