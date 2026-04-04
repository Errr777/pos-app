<?php

namespace App\Http\Middleware;

use App\Models\LicenseConfig;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RequireModule
{
    public function handle(Request $request, Closure $next, string $module): Response
    {
        // Dev bypass
        if (config('app.license_bypass')) {
            return $next($request);
        }

        $license = LicenseConfig::current();

        // No license configured — allow everything (not yet set up)
        if (! $license || ! $license->valid) {
            return $next($request);
        }

        if (! $license->hasModule($module)) {
            if ($request->wantsJson()) {
                return response()->json([
                    'message' => "Modul '{$module}' tidak termasuk dalam paket lisensi Anda.",
                ], 403);
            }

            return redirect()->route('dashboard')->with(
                'error',
                "Modul ini tidak termasuk dalam paket lisensi Anda. Hubungi administrator."
            );
        }

        return $next($request);
    }
}
