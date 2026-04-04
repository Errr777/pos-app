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

class LicenseSyncJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;
    public int $backoff = 30;

    private function bearerToken(string $licenseKey): string
    {
        $timestamp = time();
        $hmac      = hash_hmac('sha256', $licenseKey . ':' . $timestamp, $licenseKey);

        return $licenseKey . '.' . $timestamp . '.' . $hmac;
    }

    public function handle(): void
    {
        $config = LicenseConfig::current();

        if (! $config) {
            Log::warning('[LicenseSync] No license config found. Skipping.');
            return;
        }

        if (! str_starts_with((string) $config->panel_url, 'http://') && ! str_starts_with((string) $config->panel_url, 'https://')) {
            Log::error('[LicenseSync] panel_url tidak valid (harus http:// atau https://).');
            $config->update(['valid' => false, 'last_reason' => 'panel_url_invalid']);
            return;
        }

        try {
            $response = Http::timeout(10)
                ->withToken($this->bearerToken($config->license_key))
                ->withHeaders(['X-App-Url' => rtrim(config('app.url'), '/')])
                ->get(rtrim($config->panel_url, '/') . '/api/license');

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
                    'webhook_secret' => $data['webhook_secret'] ?? null,
                ]);

                // Sync business info ke app_settings
                if (! empty($data['business_name'])) {
                    AppSetting::set('store_name', $data['business_name']);
                }
                if (! empty($data['contact_phone'])) {
                    AppSetting::set('store_phone', $data['contact_phone']);
                }

                // Disable excess users (beyond max_users, sorted by id desc — newest first)
                $allUserIds = \App\Models\User::where('role', '!=', 'admin')->orderBy('id')->pluck('id');
                if ($allUserIds->count() > $maxUsers) {
                    $excessIds = $allUserIds->slice($maxUsers);
                    \App\Models\User::whereIn('id', $excessIds)->update(['is_active' => false]);
                    \App\Models\User::whereIn('id', $allUserIds->slice(0, $maxUsers))->update(['is_active' => true]);
                }

                // Disable excess outlets (beyond max_outlets, sorted by id desc — newest first)
                $allWarehouseIds = \App\Models\Warehouse::orderBy('is_default', 'desc')->orderBy('id')->pluck('id');
                if ($allWarehouseIds->count() > $maxOutlets) {
                    $excessIds = $allWarehouseIds->slice($maxOutlets);
                    \App\Models\Warehouse::whereIn('id', $excessIds)->update(['is_active' => false]);
                }

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
            $config->update(['last_reason' => 'network_error: ' . $e->getMessage()]);
        }
    }
}
