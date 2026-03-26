<?php

namespace App\Traits;

use App\Helpers\HashId;

trait HasHashId
{
    /**
     * Return the hash-encoded primary key for URL generation.
     * Laravel uses this when building routes (e.g. route('item.show', $item)).
     */
    public function getRouteKey(): string
    {
        return hid((int) $this->getKey());
    }

    /**
     * Decode the incoming hash from the URL and resolve the model by integer PK.
     * Uses ?static so PHP resolves to the concrete model class.
     */
    public function resolveRouteBinding(mixed $value, $field = null): ?static
    {
        $id = is_string($value) ? HashId::decode($value) : (int) $value;

        if ($id === 0) {
            return null; // triggers 404
        }

        /** @var static|null */
        return $this->where($field ?? $this->getRouteKeyName(), $id)->first();
    }

    /**
     * Ensure the route key column stays as the real primary key column.
     */
    public function getRouteKeyName(): string
    {
        return $this->getKeyName(); // 'id'
    }
}
