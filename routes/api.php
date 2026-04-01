<?php

use App\Http\Controllers\Api\AdminPasswordResetController;
use App\Http\Controllers\Api\HealthController;
use Illuminate\Support\Facades\Route;

Route::middleware('throttle:30,1')->group(function () {
    Route::get('/health', [HealthController::class, 'show']);
});

Route::middleware('throttle:3,60')->group(function () {
    Route::post('/admin-password-reset', [AdminPasswordResetController::class, 'reset']);
});
