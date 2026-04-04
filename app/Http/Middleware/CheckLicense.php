<?php

namespace App\Http\Middleware;

use App\Models\LicenseConfig;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckLicense
{
    public function handle(Request $request, Closure $next): Response
    {
        // Dev bypass — set LICENSE_BYPASS=true in .env to skip all license checks
        if (config('app.license_bypass')) {
            return $next($request);
        }

        $license = LicenseConfig::current();

        // No license configured — allow access (not yet set up)
        if (! $license) {
            return $next($request);
        }

        if (! $license->valid) {
            $reason = $license->last_reason;

            if ($request->wantsJson()) {
                return response()->json([
                    'message' => 'License tidak valid.',
                    'reason'  => $reason,
                ], 403);
            }

            return redirect()->route('license.invalid')->with('reason', $reason);
        }

        return $next($request);
    }
}
