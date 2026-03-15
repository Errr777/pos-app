<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Cache;

class AppSetting extends Model
{
    protected $primaryKey = 'key';
    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = ['key', 'value'];

    /** Get a setting value, with optional fallback. */
    public static function get(string $key, mixed $default = null): mixed
    {
        return Cache::remember("app_setting:{$key}", 3600, function () use ($key, $default) {
            $row = static::find($key);
            return $row ? $row->value : $default;
        });
    }

    /** Set a setting value and clear its cache (individual key + bulk). */
    public static function set(string $key, mixed $value): void
    {
        static::updateOrCreate(['key' => $key], ['value' => $value]);
        Cache::forget("app_setting:{$key}");
        Cache::forget('app_settings_all');
    }

    /** Return all settings as an associative array (cached for 1 hour). */
    public static function allAsArray(): array
    {
        return Cache::remember('app_settings_all', 3600, function () {
            return static::all()->pluck('value', 'key')->toArray();
        });
    }
}
