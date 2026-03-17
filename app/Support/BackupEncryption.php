<?php

namespace App\Support;

class BackupEncryption
{
    private const CIPHER = 'AES-256-CBC';
    private const IV_LEN = 16;

    public static function encryptFile(string $sourcePath, string $destPath): void
    {
        $plain = file_get_contents($sourcePath);
        $iv    = random_bytes(self::IV_LEN);
        $enc   = openssl_encrypt($plain, self::CIPHER, self::key(), OPENSSL_RAW_DATA, $iv);
        file_put_contents($destPath, $iv . $enc);
    }

    public static function decryptToTemp(string $encPath): string
    {
        $raw     = file_get_contents($encPath);
        $iv      = substr($raw, 0, self::IV_LEN);
        $enc     = substr($raw, self::IV_LEN);
        $plain   = openssl_decrypt($enc, self::CIPHER, self::key(), OPENSSL_RAW_DATA, $iv);
        if ($plain === false) {
            throw new \RuntimeException('Dekripsi gagal. File mungkin rusak atau kunci tidak cocok.');
        }
        $tmp = tempnam(sys_get_temp_dir(), 'db_restore_') . '.sql';
        file_put_contents($tmp, $plain);
        return $tmp;
    }

    private static function key(): string
    {
        $appKey = config('app.key');
        return substr(base64_decode(str_replace('base64:', '', $appKey)), 0, 32);
    }
}
