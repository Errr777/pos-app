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
        $license = LicenseConfig::current();

        if (! $license || ! $license->webhook_secret || ! $this->validateBearerToken($request, $license->license_key, $license->webhook_secret)) {
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

    private function validateBearerToken(Request $request, string $licenseKey, string $webhookSecret): bool
    {
        $header = $request->header('Authorization', '');

        if (! str_starts_with($header, 'Bearer ')) {
            return false;
        }

        $parts = explode('.', substr($header, 7), 3);

        if (count($parts) !== 3) {
            return false;
        }

        [$tokenKey, $timestamp, $hmac] = $parts;

        if ($tokenKey !== $licenseKey) {
            return false;
        }

        if (! ctype_digit($timestamp) || abs(time() - (int) $timestamp) > 300) {
            return false;
        }

        $expected = hash_hmac('sha256', $licenseKey . ':' . $timestamp, $webhookSecret);

        return hash_equals($expected, $hmac);
    }
}
