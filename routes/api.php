<?php

use App\Http\Controllers\Api\AdminPasswordResetController;
use App\Http\Controllers\Api\HealthController;
use Illuminate\Support\Facades\Route;

Route::middleware('throttle:30,1')->group(function () {
    Route::get('/health', [HealthController::class, 'show']);
    Route::post('/admin-password-reset', [AdminPasswordResetController::class, 'reset']);
});
