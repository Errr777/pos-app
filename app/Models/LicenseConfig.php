<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LicenseConfig extends Model
{
    protected $table = 'license_config';

    protected $fillable = [
        'license_key',
        'panel_url',
        'valid',
        'status',
        'modules',
        'max_users',
        'max_outlets',
        'expires_at',
        'last_reason',
        'last_synced_at',
        'webhook_secret',
        'tenant_pushed_at',
    ];

    protected $casts = [
        'valid'           => 'boolean',
        'modules'         => 'array',
        'expires_at'      => 'datetime',
        'last_synced_at'  => 'datetime',
        'tenant_pushed_at' => 'datetime',
    ];

    /**
     * Get the single license config row (singleton pattern).
     */
    public static function current(): ?self
    {
        return static::first();
    }

    public function hasModule(string $key): bool
    {
        if (! $this->valid) {
            return false;
        }

        return in_array($key, $this->modules ?? []);
    }
}
