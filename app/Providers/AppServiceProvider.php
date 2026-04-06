<?php

namespace App\Providers;

use App\Models\DeliveryOrder;
use App\Models\Item;
use App\Models\StockOpname;
use App\Observers\ItemObserver;
use Illuminate\Support\Facades\Route;
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

        Route::bind('deliveryOrder', fn ($value) => DeliveryOrder::findOrFail(dhid($value)));
        Route::bind('opname', fn ($value) => StockOpname::findOrFail(dhid($value)));
    }
}
