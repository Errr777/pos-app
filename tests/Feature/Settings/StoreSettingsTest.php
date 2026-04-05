<?php
// tests/Feature/Settings/StoreSettingsTest.php
namespace Tests\Feature\Settings;

use App\Models\AppSetting;
use App\Models\User;
use App\Models\Warehouse;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class StoreSettingsTest extends TestCase
{
    use RefreshDatabase;

    private function adminUser(): User
    {
        return User::factory()->create(['role' => 'admin', 'is_active' => true]);
    }

    protected function setUp(): void
    {
        parent::setUp();
        AppSetting::set('onboarding_done', '1');
    }

    public function test_settings_page_includes_outlet_data(): void
    {
        $admin = $this->adminUser();
        Warehouse::where('is_default', true)->update(['is_default' => false]);
        Warehouse::create([
            'code' => 'MAIN', 'name' => 'Outlet Pusat',
            'city' => 'Jakarta', 'phone' => '021-111',
            'is_active' => true, 'is_default' => true,
        ]);

        $response = $this->actingAs($admin)->get('/settings/store');

        $response->assertOk();
        $response->assertInertia(fn ($page) =>
            $page->has('outlet')
                 ->where('outlet.name', 'Outlet Pusat')
                 ->where('outlet.city', 'Jakarta')
        );
    }

    public function test_outlet_fields_are_saved(): void
    {
        $admin = $this->adminUser();
        AppSetting::set('store_name', 'Toko A');
        Warehouse::where('is_default', true)->update(['is_default' => false]);
        Warehouse::create([
            'code' => 'MAIN', 'name' => 'Lama',
            'is_active' => true, 'is_default' => true,
        ]);

        $this->actingAs($admin)->post('/settings/store', [
            'store_name'   => 'Toko A',
            'outlet_name'  => 'Outlet Baru',
            'outlet_city'  => 'Bandung',
            'outlet_phone' => '022-222',
        ])->assertSessionHasNoErrors();

        $warehouse = Warehouse::where('is_default', true)->first();
        $this->assertEquals('Outlet Baru', $warehouse->name);
        $this->assertEquals('Bandung', $warehouse->city);
        $this->assertEquals('022-222', $warehouse->phone);
    }

    public function test_outlet_not_required_when_no_default_warehouse(): void
    {
        $admin = $this->adminUser();
        AppSetting::set('store_name', 'Toko A');

        $response = $this->actingAs($admin)->post('/settings/store', [
            'store_name' => 'Toko A',
        ]);

        $response->assertSessionHasNoErrors();
    }
}
