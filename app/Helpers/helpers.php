<?php

use App\Helpers\HashId;

if (! function_exists('hid')) {
    /**
     * Encode an integer database ID to a URL-safe hash string.
     * Returns '' if $id is null or 0.
     */
    function hid(int|null $id): string
    {
        if ($id === null || $id === 0) {
            return '';
        }

        return HashId::encode($id);
    }
}

if (! function_exists('dhid')) {
    /**
     * Decode a hash string back to an integer ID.
     * Returns 0 on invalid/empty input (so findOrFail(0) gives a 404).
     */
    function dhid(string|null $hash): int
    {
        if ($hash === null || $hash === '') {
            return 0;
        }

        return HashId::decode($hash);
    }
}
