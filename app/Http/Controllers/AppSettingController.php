<?php

namespace App\Http\Controllers;

use App\Jobs\PushSettingsToPanelJob;
use App\Models\AppSetting;
use App\Models\Warehouse;
use Illuminate\Http\Request;
use Inertia\Inertia;

class AppSettingController extends Controller
{
    public function edit(): \Inertia\Response
    {
        abort_unless(auth()->user()->role === 'admin', 403);

        $defaultWarehouse = Warehouse::where('is_default', true)->first();

        return Inertia::render('settings/store', [
            'settings' => AppSetting::allAsArray(),
            'outlet'   => $defaultWarehouse ? [
                'name'  => $defaultWarehouse->name,
                'city'  => $defaultWarehouse->city,
                'phone' => $defaultWarehouse->phone,
            ] : null,
        ]);
    }

    public function update(Request $request): \Illuminate\Http\RedirectResponse
    {
        abort_unless(auth()->user()->role === 'admin', 403);

        $validated = $request->validate([
            'store_name'     => ['required', 'string', 'max:100'],
            'store_address'  => ['nullable', 'string', 'max:255'],
            'store_phone'    => ['nullable', 'string', 'max:30'],
            'receipt_footer' => ['nullable', 'string', 'max:255'],
            'store_logo'     => ['nullable', 'image', 'max:2048'],
            'outlet_name'    => ['nullable', 'string', 'max:100'],
            'outlet_city'    => ['nullable', 'string', 'max:100'],
            'outlet_phone'   => ['nullable', 'string', 'max:20'],
        ]);

        if ($request->hasFile('store_logo')) {
            $path = $request->file('store_logo')->store('logos', 'public');
            AppSetting::set('store_logo', $path);
        }

        foreach (['store_name', 'store_address', 'store_phone', 'receipt_footer'] as $key) {
            if (array_key_exists($key, $validated)) {
                AppSetting::set($key, $validated[$key]);
            }
        }

        $warehouse = Warehouse::where('is_default', true)->first();
        if ($warehouse && $request->has('outlet_name')) {
            $warehouse->update([
                'name'  => $validated['outlet_name'] ?? $warehouse->name,
                'city'  => $validated['outlet_city'] ?? null,
                'phone' => $validated['outlet_phone'] ?? null,
            ]);
        }

        PushSettingsToPanelJob::dispatch();

        return back()->with('success', 'Pengaturan toko berhasil disimpan.');
    }
}
