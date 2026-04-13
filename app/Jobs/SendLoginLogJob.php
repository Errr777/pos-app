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

class SendLoginLogJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries  = 1; // fire-and-forget — jangan retry jika panel unreachable
    public int $timeout = 8;

    public function __construct(
        private readonly string $ipAddress,
        private readonly string $loggedInAt,
    ) {}

    private function bearerToken(string $licenseKey): string
    {
        $timestamp = time();
        $hmac      = hash_hmac('sha256', $licenseKey . ':' . $timestamp, $licenseKey);
        return $licenseKey . '.' . $timestamp . '.' . $hmac;
    }

    public function handle(): void
    {
        $config = LicenseConfig::current();

        if (! $config || ! $config->panel_url) {
            return; // belum setup, lewati
        }

        try {
            Http::timeout($this->timeout)
                ->withToken($this->bearerToken($config->license_key))
                ->postJson(rtrim($config->panel_url, '/') . '/api/login-log', [
                    'ip_address'   => $this->ipAddress,
                    'logged_in_at' => $this->loggedInAt,
                ]);
        } catch (\Throwable $e) {
            Log::warning('[SendLoginLog] Gagal kirim login log ke panel: ' . $e->getMessage());
        }
    }
}
