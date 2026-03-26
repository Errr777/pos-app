<?php

namespace App\Helpers;

use Hashids\Hashids;

class HashId
{
    private static ?Hashids $instance = null;

    private static function instance(): Hashids
    {
        if (self::$instance === null) {
            self::$instance = new Hashids(
                salt: config('app.hash_id_salt', 'fallback-salt-change-me'),
                minHashLength: 8,
                alphabet: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890'
            );
        }

        return self::$instance;
    }

    public static function encode(int $id): string
    {
        return self::instance()->encode($id);
    }

    /**
     * Returns 0 (not null) on invalid input so findOrFail(0) triggers a clean 404.
     */
    public static function decode(string $hash): int
    {
        if ($hash === '' || $hash === '0') {
            return 0;
        }

        $decoded = self::instance()->decode($hash);

        return isset($decoded[0]) ? (int) $decoded[0] : 0;
    }
}
