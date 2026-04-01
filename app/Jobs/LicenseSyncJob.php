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

                $allowedStatuses = ['active', 'trial', 'suspended', 'expired'];
                $allowedModules  = [
                    'dashboard', 'pos', 'items', 'inventory', 'warehouses',
                    'purchase_orders', 'customers', 'suppliers', 'reports', 'returns', 'users',
                ];

                $status   = in_array($data['status'] ?? '', $allowedStatuses) ? $data['status'] : 'active';
                $modules  = array_values(array_intersect($data['modules'] ?? [], $allowedModules));
                $maxUsers = max(1, (int) ($data['max_users'] ?? 1));
                $maxOutlets = max(1, (int) ($data['max_outlets'] ?? 1));

                $config->update([
                    'valid'          => true,
                    'status'         => $status,
                    'modules'        => $modules,
                    'max_users'      => $maxUsers,
                    'max_outlets'    => $maxOutlets,
                    'expires_at'     => $data['expires_at'] ?? null,
                    'last_reason'    => null,
                    'last_synced_at' => now(),
                ]);

                Log::info('[LicenseSync] License valid. Status: ' . $status);
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
