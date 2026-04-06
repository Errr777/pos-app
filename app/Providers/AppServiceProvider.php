<?php

namespace App\Providers;

use App\Models\Item;
use App\Observers\ItemObserver;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void {}

    public function boot(): void
    {
        if (config('app.env') === 'production') {
            URL::forceScheme('https');
        }

        Item::observe(ItemObserver::class);
    }
}
