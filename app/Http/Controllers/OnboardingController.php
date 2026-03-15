<?php

namespace App\Http\Controllers;

use App\Models\AppSetting;
use App\Models\Warehouse;
use Illuminate\Http\Request;
use Inertia\Inertia;

class OnboardingController extends Controller
{
    public function index(): \Inertia\Response
    {
        abort_unless(auth()->user()->role === 'admin', 403);

        return Inertia::render('onboarding/Index', [
            'settings' => AppSetting::allAsArray(),
        ]);
    }

    public function store(Request $request): \Illuminate\Http\RedirectResponse
    {
        abort_unless(auth()->user()->role === 'admin', 403);

        $validated = $request->validate([
            'store_name'     => ['required', 'string', 'max:100'],
            'store_address'  => ['nullable', 'string', 'max:255'],
            'store_phone'    => ['nullable', 'string', 'max:30'],
            'receipt_footer' => ['nullable', 'string', 'max:255'],
            'store_logo'     => ['nullable', 'image', 'max:2048'],
            'outlet_name'    => ['required', 'string', 'max:100'],
            'outlet_city'    => ['nullable', 'string', 'max:100'],
            'outlet_phone'   => ['nullable', 'string', 'max:30'],
        ]);

        // Save store settings
        AppSetting::set('store_name',     $validated['store_name']);
        AppSetting::set('store_address',  $validated['store_address'] ?? '');
        AppSetting::set('store_phone',    $validated['store_phone'] ?? '');
        AppSetting::set('receipt_footer', $validated['receipt_footer'] ?? 'Terima kasih!');

        if ($request->hasFile('store_logo')) {
            $path = $request->file('store_logo')->store('logos', 'public');
            AppSetting::set('store_logo', $path);
        }

        // Create or update default outlet (warehouse)
        $existing = Warehouse::where('is_default', true)->first();
        $outletData = [
            'name'       => $validated['outlet_name'],
            'city'       => $validated['outlet_city'] ?? null,
            'phone'      => $validated['outlet_phone'] ?? null,
            'is_active'  => true,
            'is_default' => true,
        ];

        if ($existing) {
            $existing->update($outletData);
        } else {
            Warehouse::create(array_merge($outletData, [
                'code'    => 'MAIN',
                'address' => $validated['store_address'] ?? null,
            ]));
        }

        // Mark onboarding as done
        AppSetting::set('onboarding_done', '1');

        return redirect()->route('dashboard')->with('success', 'Selamat datang! Toko Anda sudah siap.');
    }
}
