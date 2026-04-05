<?php
namespace Tests\Feature;

use App\Jobs\PushSettingsToPanelJob;
use App\Models\AppSetting;
use App\Models\LicenseConfig;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class PushSettingsToPanelJobTest extends TestCase
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
        AppSetting::set('store_name',    'Toko Lokal');
        AppSetting::set('store_email',   'lokal@test.com');
        AppSetting::set('store_address', 'Jl. Lokal No. 1');
        AppSetting::set('store_phone',   '0811111111');
    }

    public function test_pushes_email_and_address_to_panel(): void
    {
        Http::fake(['*/api/license' => Http::response(['ok' => true], 200)]);

        (new PushSettingsToPanelJob())->handle();

        Http::assertSent(fn ($req) =>
            str_contains($req->url(), '/api/license') &&
            $req['contact_email']   === 'lokal@test.com' &&
            $req['contact_address'] === 'Jl. Lokal No. 1'
        );
    }

    public function test_updates_tenant_pushed_at_after_success(): void
    {
        Http::fake(['*/api/license' => Http::response(['ok' => true], 200)]);

        $this->assertNull(LicenseConfig::current()->tenant_pushed_at);

        (new PushSettingsToPanelJob())->handle();

        $this->assertNotNull(LicenseConfig::current()->tenant_pushed_at);
    }

    public function test_does_not_update_tenant_pushed_at_on_failure(): void
    {
        Http::fake(['*/api/license' => Http::response(['error' => 'bad'], 500)]);

        (new PushSettingsToPanelJob())->handle();

        $this->assertNull(LicenseConfig::current()->tenant_pushed_at);
    }
}
