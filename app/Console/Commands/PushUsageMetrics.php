<?php

namespace App\Console\Commands;

use App\Models\LicenseConfig;
use App\Models\SaleHeader;
use App\Models\User;
use App\Models\Warehouse;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class PushUsageMetrics extends Command
{
    protected $signature = 'app:push-usage-metrics';

    protected $description = 'Push daily usage metrics to the SaaS panel';

    private function bearerToken(string $licenseKey): string
    {
        $timestamp = time();
        $hmac      = hash_hmac('sha256', $licenseKey . ':' . $timestamp, $licenseKey);

        return $licenseKey . '.' . $timestamp . '.' . $hmac;
    }

    public function handle(): int
    {
        $license = LicenseConfig::current();

        if (! $license || ! $license->license_key || ! $license->panel_url) {
            $this->warn('License not configured — skipping metrics push.');
            return 0;
        }

        if (! str_starts_with((string) $license->panel_url, 'https://')) {
            $this->error('panel_url bukan HTTPS. Metrics push dibatalkan demi keamanan.');
            Log::error('PushUsageMetrics: panel_url bukan HTTPS. Dibatalkan.');
            return 1;
        }

        $today = now()->toDateString();

        $transactionsCount = SaleHeader::whereDate('occurred_at', $today)
            ->where('status', 'completed')
            ->count();

        // Active users: logged in within the last 30 days
        $activeUsersCount = User::whereNotNull('last_login_at')
            ->where('last_login_at', '>=', now()->subDays(30))
            ->count();

        $outletCount = Warehouse::where('is_active', true)->count();

        $url = rtrim($license->panel_url, '/') . '/api/metrics';

        try {
            $response = Http::timeout(10)
                ->withToken($this->bearerToken($license->license_key))
                ->post($url, [
                'metric_date'        => $today,
                'transactions_count' => $transactionsCount,
                'active_users_count' => $activeUsersCount,
                'outlet_count'       => $outletCount,
            ]);

            if ($response->successful()) {
                $this->info("Metrics pushed: tx={$transactionsCount} users={$activeUsersCount} outlets={$outletCount}");
                return 0;
            }

            $this->error("Metrics push failed: HTTP {$response->status()}");
            Log::warning('PushUsageMetrics: non-200 response', [
                'status' => $response->status(),
                'body'   => $response->body(),
            ]);
        } catch (\Exception $e) {
            $this->error("Metrics push exception: {$e->getMessage()}");
            Log::error('PushUsageMetrics: exception', ['message' => $e->getMessage()]);
        }

        return 1;
    }
}
