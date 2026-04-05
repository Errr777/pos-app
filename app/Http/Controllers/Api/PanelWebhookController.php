<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\LicenseConfig;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class PanelWebhookController extends Controller
{
    public function receive(Request $request): JsonResponse
    {
        $config = LicenseConfig::current();

        if (! $config || ! $config->webhook_secret) {
            return response()->json(['error' => 'webhook_not_configured'], 403);
        }

        if (! $this->verifySignature($request, $config->webhook_secret)) {
            return response()->json(['error' => 'invalid_signature'], 401);
        }

        // Decrypt payload if encrypted
        $raw = $request->all();
        if (isset($raw['enc'], $raw['iv'])) {
            $payload = $this->decryptPayload($raw, $config->webhook_secret);
            if ($payload === null) {
                return response()->json(['error' => 'decryption_failed'], 400);
            }
        } else {
            $payload = $raw;
        }

        $event = $payload['event'] ?? null;

        Log::info("[PanelWebhook] Event received: {$event}", ['payload' => $payload]);

        match ($event) {
            'license.suspended', 'license.expired'  => $this->handleLicenseInactive($event, $payload),
            'license.activated', 'license.extended'  => $this->handleLicenseActive($event, $payload),
            'monitor.down'                           => $this->handleMonitorDown($payload),
            'test'                                   => Log::info("[PanelWebhook] Test event received"),
            default                                  => Log::info("[PanelWebhook] Unhandled event: {$event}"),
        };

        return response()->json(['ok' => true]);
    }

    private function decryptPayload(array $body, string $secret): ?array
    {
        try {
            $key       = hash('sha256', $secret, true);
            $decrypted = openssl_decrypt(
                base64_decode($body['enc']),
                'aes-256-cbc',
                $key,
                OPENSSL_RAW_DATA,
                base64_decode($body['iv'])
            );
            return $decrypted !== false ? json_decode($decrypted, true) : null;
        } catch (\Throwable) {
            return null;
        }
    }

    private function verifySignature(Request $request, string $secret): bool
    {
        $signature = $request->header('X-Signature', '');

        if (! str_starts_with($signature, 'sha256=')) {
            return false;
        }

        $expected = 'sha256=' . hash_hmac('sha256', $request->getContent(), $secret);

        return hash_equals($expected, $signature);
    }

    private function handleLicenseInactive(string $event, array $payload): void
    {
        // Force immediate re-sync to update local license state
        \App\Jobs\LicenseSyncJob::dispatch();

        Log::warning("[PanelWebhook] License inactive via webhook: {$event}", [
            'status' => $payload['status'] ?? null,
        ]);
    }

    private function handleLicenseActive(string $event, array $payload): void
    {
        // Force immediate re-sync to pick up updated modules/expiry
        \App\Jobs\LicenseSyncJob::dispatch();

        Log::info("[PanelWebhook] License reactivated via webhook: {$event}");
    }

    private function handleMonitorDown(array $payload): void
    {
        Log::warning('[PanelWebhook] Monitor down alert received from panel', [
            'downtime_started_at' => $payload['downtime_started_at'] ?? null,
            'response_time_ms'    => $payload['response_time_ms'] ?? null,
        ]);
    }
}
