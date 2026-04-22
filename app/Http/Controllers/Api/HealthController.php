<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AppSetting;
use App\Models\LicenseConfig;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class HealthController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        $config = LicenseConfig::current();

        if (! $config || ! $config->webhook_secret || ! $this->validateBearerToken($request, $config->license_key, $config->webhook_secret)) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        return response()->json([
            'app_version'        => AppSetting::get('app_version', '1.0.0'),
            'last_deploy_at'     => AppSetting::get('last_deploy_at'),
            'db_connected'       => $this->checkDatabase(),
            'queue_running'      => $this->checkQueue(),
            'disk_usage_percent' => $this->diskUsagePercent(),
            'disk_free_mb'       => $this->diskFreeMb(),
            'timestamp'          => now()->toIso8601String(),
        ]);
    }

    private function validateBearerToken(Request $request, string $licenseKey, string $webhookSecret): bool
    {
        $header = $request->header('Authorization', '');

        if (! str_starts_with($header, 'Bearer ')) {
            return false;
        }

        $parts = explode('.', substr($header, 7), 3);

        if (count($parts) !== 3) {
            return false;
        }

        [$tokenKey, $timestamp, $hmac] = $parts;

        if ($tokenKey !== $licenseKey) {
            return false;
        }

        if (! ctype_digit($timestamp) || abs(time() - (int) $timestamp) > 300) {
            return false;
        }

        $expected = hash_hmac('sha256', $licenseKey . ':' . $timestamp, $webhookSecret);

        return hash_equals($expected, $hmac);
    }

    private function checkDatabase(): bool
    {
        try {
            DB::connection()->getPdo();
            return true;
        } catch (\Throwable) {
            return false;
        }
    }

    private function checkQueue(): ?bool
    {
        // Returns true if a queue heartbeat was written within the last 5 minutes.
        // The heartbeat is written by the queue worker via the QueueHeartbeat command.
        // Returns null if the heartbeat has never been written (not yet configured).
        $heartbeat = Cache::get('queue:heartbeat');

        if ($heartbeat === null) {
            return null;
        }

        return now()->diffInMinutes($heartbeat) < 5;
    }

    private function diskUsagePercent(): float
    {
        $total = disk_total_space('/');
        $free  = disk_free_space('/');

        if (! $total) {
            return 0.0;
        }

        return round(($total - $free) / $total * 100, 1);
    }

    private function diskFreeMb(): float
    {
        return round(disk_free_space('/') / 1048576, 1);
    }
}
