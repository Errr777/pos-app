<?php

namespace App\Http\Middleware;

use App\Models\AppSetting;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureOnboardingComplete
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        // Only check for authenticated admins
        if (!$user || $user->role !== 'admin') {
            return $next($request);
        }

        // Skip if already on the onboarding route
        if ($request->routeIs('onboarding.*')) {
            return $next($request);
        }

        // Redirect to onboarding if not done
        if (AppSetting::get('onboarding_done', '0') !== '1') {
            return redirect()->route('onboarding.index');
        }

        return $next($request);
    }
}
