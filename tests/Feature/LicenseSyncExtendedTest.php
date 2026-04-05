<?php
namespace Tests\Feature;

use App\Jobs\LicenseSyncJob;
use App\Models\AppSetting;
use App\Models\LicenseConfig;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class LicenseSyncExtendedTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        LicenseConfig::create([
            'license_key' => 'test-key',
            'panel_url'   => 'https://panel.test',
            'valid'       => true,
            'status'      => 'active',
            'modules'     => ['pos'],
        ]);
    }

    private function fakeApiResponse(array $overrides = []): void
    {
        Http::fake([
            '*/api/license' => Http::response(array_merge([
                'ok'              => true,
                'valid'           => true,
                'status'          => 'active',
                'modules'         => ['pos'],
                'max_users'       => 5,
                'max_outlets'     => 2,
                'expires_at'      => now()->addYear()->toIso8601String(),
                'webhook_secret'  => 'secret',
                'business_name'   => 'Toko XYZ',
                'contact_email'   => 'xyz@example.com',
                'contact_phone'   => '08123456789',
                'contact_address' => 'Jl. Sudirman No. 5',
            ], $overrides), 200),
        ]);
    }

    public function test_sync_saves_contact_email(): void
    {
        $this->fakeApiResponse();
        (new LicenseSyncJob())->handle();
        $this->assertEquals('xyz@example.com', AppSetting::get('store_email'));
    }

    public function test_sync_saves_contact_address(): void
    {
        $this->fakeApiResponse();
        (new LicenseSyncJob())->handle();
        $this->assertEquals('Jl. Sudirman No. 5', AppSetting::get('store_address'));
    }
}
