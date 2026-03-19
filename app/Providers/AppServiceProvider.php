<?php

namespace App\Providers;

use App\Models\Item;
use App\Observers\ItemObserver;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void {}

    public function boot(): void
    {
        Item::observe(ItemObserver::class);
    }
}
