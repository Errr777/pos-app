<?php

namespace App\Jobs;

use App\Models\AppSetting;
use App\Models\LicenseConfig;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class PushSettingsToPanelJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 2;

    public function handle(): void
    {
        $config = LicenseConfig::current();

        if (! $config || ! $config->valid || ! $config->panel_url) {
            return;
        }

        $timestamp = time();
        $hmac      = hash_hmac('sha256', $config->license_key . ':' . $timestamp, $config->license_key);
        $token     = $config->license_key . '.' . $timestamp . '.' . $hmac;

        $payload = array_filter([
            'business_name' => AppSetting::get('store_name'),
            'contact_phone' => AppSetting::get('store_phone'),
        ]);

        if (empty($payload)) {
            return;
        }

        try {
            Http::timeout(8)
                ->withToken($token)
                ->withHeaders(['X-App-Url' => rtrim(config('app.url'), '/')])
                ->patch(rtrim($config->panel_url, '/') . '/api/license', $payload);
        } catch (\Throwable $e) {
            Log::warning('[PushSettings] Failed to push settings to panel: ' . $e->getMessage());
        }
    }
}
