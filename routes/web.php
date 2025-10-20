<?php

use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use App\Http\Controllers\ItemController;

Route::get('/', function () {
    return Inertia::render('welcome');
})->name('home');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('dashboard', function () {
        return Inertia::render('dashboard');
    })->name('dashboard');
    
    /* Route::get('items', function () {
        return Inertia::render('Items/Items');
    })->name('Items'); */

    Route::get('/items', [ItemController::class, 'index'])->name('items.index');
    Route::get('/items/{item}', [ItemController::class, 'show'])->name('items.show');
    Route::put('/items/{item}', [ItemController::class, 'update'])->name('items.update');
    Route::delete('/items/{item}', [ItemController::class, 'destroy'])->name('items.destroy');

    Route::get('items/add', function () {
        return Inertia::render('Items/Add_Items');
    })->name('Add_Items');
    Route::get('items/categories', function () {
        return Inertia::render('Items/Categories');
    })->name('Categories');
    Route::get('items/stock_alerts', function () {
        return Inertia::render('Items/Stock_alerts');
    })->name('stock_alerts');


    Route::get('inventory/stock_in', function () {
        return Inertia::render('inventory/Stock_In');
    })->name('Stock_In');
    Route::get('inventory/stock_out', function () {
        return Inertia::render('inventory/Stock_Out');
    })->name('Stock_Out');
    Route::get('inventory', function () {
        return Inertia::render('inventory/Stock_History');
    })->name('Stock_History');
    Route::get('inventory/stock_log', function () {
        return Inertia::render('inventory/Stock_Log');
    })->name('Stock_Log');

    Route::get('report/stock', function () {
        return Inertia::render('report/Report_Stock');
    })->name('Report_Stock');
});

require __DIR__.'/settings.php';
require __DIR__.'/auth.php';
