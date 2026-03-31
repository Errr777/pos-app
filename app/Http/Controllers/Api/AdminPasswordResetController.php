<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\LicenseConfig;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class AdminPasswordResetController extends Controller
{
    public function reset(Request $request): JsonResponse
    {
        $key = $request->header('X-License-Key');
        $license = LicenseConfig::current();

        if (! $license || ! $key || $key !== $license->license_key) {
            return response()->json(['error' => 'unauthorized'], 401);
        }

        $admin = User::where('role', 'admin')->orderBy('id')->first();

        if (! $admin) {
            return response()->json(['error' => 'no_admin_found'], 404);
        }

        $tempPassword = Str::password(12, symbols: false);

        $admin->update(['password' => Hash::make($tempPassword)]);

        return response()->json([
            'ok'            => true,
            'admin_email'   => $admin->email,
            'temp_password' => $tempPassword,
        ]);
    }
}
