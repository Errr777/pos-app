<?php

namespace App\Jobs;

use App\Models\LicenseConfig;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class LicenseSyncJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;
    public int $backoff = 30;

    public function handle(): void
    {
        $config = LicenseConfig::current();

        if (! $config) {
            Log::warning('[LicenseSync] No license config found. Skipping.');
            return;
        }

        try {
            $response = Http::timeout(10)
                ->get("{$config->panel_url}/api/license/{$config->license_key}");

            if ($response->successful()) {
                $data = $response->json();

                $config->update([
                    'valid'          => true,
                    'status'         => $data['status'],
                    'modules'        => $data['modules'],
                    'max_users'      => $data['max_users'],
                    'max_outlets'    => $data['max_outlets'],
                    'expires_at'     => $data['expires_at'],
                    'last_reason'    => null,
                    'last_synced_at' => now(),
                ]);

                Log::info('[LicenseSync] License valid. Status: ' . $data['status']);
                return;
            }

            // 403 or 404 — license invalid
            $data = $response->json();
            $config->update([
                'valid'          => false,
                'last_reason'    => $data['reason'] ?? 'unknown',
                'last_synced_at' => now(),
            ]);

            Log::warning('[LicenseSync] License invalid. Reason: ' . ($data['reason'] ?? 'unknown'));

        } catch (\Exception $e) {
            // Network error — keep existing valid state, don't invalidate
            Log::error('[LicenseSync] Failed to reach panel: ' . $e->getMessage());
        }
    }
}
