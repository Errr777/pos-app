<?php

use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use App\Http\Controllers\ItemController;
use App\Http\Controllers\KategoriController;
use App\Http\Controllers\StockMovementController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\ReportController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\RoleController;

Route::get('/', function () {
    return Inertia::render('welcome');
})->name('home');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('dashboard', [DashboardController::class, 'index'])->name('dashboard');

    // Items
    Route::get('/item', [ItemController::class, 'index'])->name('item.index');
    Route::get('/item/{item}', [ItemController::class, 'show'])->name('item.show');
    Route::get('/tambah_item', [ItemController::class, 'create'])->name('item.tambah');
    Route::post('/item', [ItemController::class, 'store'])->name('item.store');
    Route::put('/item/{item}', [ItemController::class, 'update'])->name('item.update');
    Route::delete('/item/{item}', [ItemController::class, 'destroy'])->name('item.destroy');

    Route::get('/stock_alerts', [ItemController::class, 'lowStock'])->name('item.low_stock');

    // Categories
    Route::get('/category', [KategoriController::class, 'index'])->name('kategori.index');
    Route::get('/category/{kategori}', [KategoriController::class, 'show'])->name('kategori.show');
    Route::post('/category', [KategoriController::class, 'store'])->name('kategori.store');
    Route::put('/category/{kategori}', [KategoriController::class, 'update'])->name('kategori.update');
    Route::delete('/category/{kategori}', [KategoriController::class, 'destroy'])->name('kategori.destroy');

    Route::get('items/add', function () {
        return Inertia::render('Items/Add_Items');
    })->name('Add_Items');
    Route::get('items/categories', function () {
        return Inertia::render('Items/Categories');
    })->name('Categories');
    Route::get('items/stock_alerts', function () {
        return Inertia::render('Items/Stock_alerts');
    })->name('stock_alerts');

    // Inventory
    Route::get('inventory/stock_in',  [StockMovementController::class, 'stockIn'])->name('Stock_In');
    Route::get('inventory/stock_out', [StockMovementController::class, 'stockOut'])->name('Stock_Out');
    Route::get('inventory/stock_log', [StockMovementController::class, 'log'])->name('Stock_Log');
    Route::get('inventory',           [StockMovementController::class, 'history'])->name('Stock_History');

    Route::post('inventory/stock',                 [StockMovementController::class, 'store'])->name('stock.store');
    Route::put('inventory/stock/{transaction}',    [StockMovementController::class, 'update'])->name('stock.update');
    Route::delete('inventory/stock/{transaction}', [StockMovementController::class, 'destroy'])->name('stock.destroy');

    // Reports
    Route::get('report/stock',    [ReportController::class, 'stock'])->name('Report_Stock');
    Route::get('report/sales',    [ReportController::class, 'salesReport'])->name('Report_Sales');
    Route::get('report/cashflow', [ReportController::class, 'cashReport'])->name('Report_Cashflow');

    // Role Management (must be before /users/{user} wildcard)
    Route::get('/users/roles',                        [RoleController::class, 'index'])->name('users.roles');
    Route::post('/users/roles',                       [RoleController::class, 'store'])->name('roles.store');
    Route::put('/users/roles/{role}',                 [RoleController::class, 'update'])->name('roles.update');
    Route::delete('/users/roles/{role}',              [RoleController::class, 'destroy'])->name('roles.destroy');
    Route::post('/users/roles/{role}/permissions',    [RoleController::class, 'updatePermissions'])->name('roles.permissions');

    // User Management
    Route::get('/users',                          [UserController::class, 'index'])->name('users.index');
    Route::post('/users',                         [UserController::class, 'store'])->name('users.store');
    Route::put('/users/{user}',                   [UserController::class, 'update'])->name('users.update');
    Route::delete('/users/{user}',                [UserController::class, 'destroy'])->name('users.destroy');
    Route::post('/users/{user}/reset-password',  [UserController::class, 'resetPassword'])->name('users.reset_password');
    Route::post('/users/{user}/permissions',      [UserController::class, 'updatePermissions'])->name('users.permissions');
});

require __DIR__.'/settings.php';
require __DIR__.'/auth.php';
