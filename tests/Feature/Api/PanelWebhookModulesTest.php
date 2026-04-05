<?php
namespace Tests\Feature\Api;

use App\Models\AppSetting;
use App\Models\LicenseConfig;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PanelWebhookModulesTest extends TestCase
{
    use RefreshDatabase;

    private string $secret = 'testsecret1234567890123456789012';

    protected function setUp(): void
    {
        parent::setUp();
        LicenseConfig::create([
            'license_key'      => 'test-key',
            'panel_url'        => 'https://panel.test',
            'valid'            => true,
            'status'           => 'active',
            'modules'          => ['pos', 'items'],
            'webhook_secret'   => $this->secret,
            'tenant_pushed_at' => null,
        ]);
    }

    private function sendEncryptedWebhook(array $payload): \Illuminate\Testing\TestResponse
    {
        $key       = hash('sha256', $this->secret, true);
        $iv        = random_bytes(16);
        $encrypted = openssl_encrypt(json_encode($payload), 'aes-256-cbc', $key, OPENSSL_RAW_DATA, $iv);
        $body      = ['enc' => base64_encode($encrypted), 'iv' => base64_encode($iv)];
        $rawBody   = json_encode($body);
        $sig       = 'sha256=' . hash_hmac('sha256', $rawBody, $this->secret);

        return $this->withHeaders(['X-Signature' => $sig, 'Content-Type' => 'application/json'])
                    ->postJson('/api/panel-webhook', $body);
    }

    public function test_modules_updated_updates_license_config(): void
    {
        $this->sendEncryptedWebhook([
            'event'     => 'license.modules_updated',
            'modules'   => ['pos', 'items', 'reports'],
            'timestamp' => time(),
        ])->assertOk();

        $this->assertEqualsCanonicalizing(
            ['pos', 'items', 'reports'],
            LicenseConfig::current()->modules
        );
    }

    public function test_modules_updated_syncs_business_info_when_panel_is_newer(): void
    {
        $this->sendEncryptedWebhook([
            'event'           => 'license.modules_updated',
            'modules'         => ['pos'],
            'business_name'   => 'Toko ABC',
            'contact_email'   => 'abc@example.com',
            'contact_address' => 'Jl. Merdeka No. 1',
            'timestamp'       => time() + 60,
        ])->assertOk();

        $this->assertEquals('Toko ABC',         AppSetting::get('store_name'));
        $this->assertEquals('abc@example.com',  AppSetting::get('store_email'));
        $this->assertEquals('Jl. Merdeka No. 1', AppSetting::get('store_address'));
    }

    public function test_modules_updated_skips_business_info_when_tenant_is_newer(): void
    {
        LicenseConfig::current()->update(['tenant_pushed_at' => now()]);
        AppSetting::set('store_name', 'Toko Lokal');

        $this->sendEncryptedWebhook([
            'event'         => 'license.modules_updated',
            'modules'       => ['pos'],
            'business_name' => 'Toko Panel',
            'timestamp'     => now()->subMinute()->timestamp,
        ])->assertOk();

        $this->assertEquals('Toko Lokal', AppSetting::get('store_name'));
    }
}
