<?php
namespace Tests\Feature\Api;

use App\Models\LicenseConfig;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PanelWebhookDecryptTest extends TestCase
{
    use RefreshDatabase;

    private string $secret = 'testsecret1234567890123456789012';

    protected function setUp(): void
    {
        parent::setUp();
        LicenseConfig::create([
            'license_key'    => 'test-key',
            'panel_url'      => 'https://panel.test',
            'valid'          => true,
            'status'         => 'active',
            'modules'        => ['pos', 'items'],
            'webhook_secret' => $this->secret,
        ]);
    }

    private function encryptedBody(array $payload): array
    {
        $key       = hash('sha256', $this->secret, true);
        $iv        = random_bytes(16);
        $encrypted = openssl_encrypt(json_encode($payload), 'aes-256-cbc', $key, OPENSSL_RAW_DATA, $iv);
        return ['enc' => base64_encode($encrypted), 'iv' => base64_encode($iv)];
    }

    private function signedHeaders(string $body): array
    {
        return [
            'X-Signature'  => 'sha256=' . hash_hmac('sha256', $body, $this->secret),
            'Content-Type' => 'application/json',
        ];
    }

    public function test_encrypted_test_event_is_accepted(): void
    {
        $payload = ['event' => 'test', 'timestamp' => time()];
        $encBody = $this->encryptedBody($payload);
        $rawBody = json_encode($encBody);

        $response = $this->withHeaders($this->signedHeaders($rawBody))
                         ->postJson('/api/panel-webhook', $encBody);

        $response->assertOk()->assertJson(['ok' => true]);
    }

    public function test_invalid_signature_rejected(): void
    {
        $payload = ['event' => 'test'];
        $encBody = $this->encryptedBody($payload);

        $response = $this->withHeaders([
            'X-Signature'  => 'sha256=badsignature',
            'Content-Type' => 'application/json',
        ])->postJson('/api/panel-webhook', $encBody);

        $response->assertStatus(401);
    }

    public function test_decryption_failure_returns_400(): void
    {
        $badBody = ['enc' => 'notbase64!!', 'iv' => base64_encode(random_bytes(16))];
        $raw     = json_encode($badBody);
        $sig     = 'sha256=' . hash_hmac('sha256', $raw, $this->secret);

        $response = $this->withHeaders(['X-Signature' => $sig, 'Content-Type' => 'application/json'])
                         ->postJson('/api/panel-webhook', $badBody);

        $response->assertStatus(400);
    }
}
