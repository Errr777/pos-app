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
use App\Http\Controllers\WarehouseController;
use App\Http\Controllers\StockTransferController;
use App\Http\Controllers\StockAdjustmentController;
use App\Http\Controllers\SupplierController;
use App\Http\Controllers\CustomerController;
use App\Http\Controllers\PosController;
use App\Http\Controllers\PurchaseOrderController;
use App\Http\Controllers\ReturnController;
use App\Http\Controllers\PromotionController;
use App\Http\Controllers\TagController;

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
    Route::patch('/item/{item}/tags', [ItemController::class, 'syncTags'])->name('item.sync_tags');

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

    // Stock Transfer
    Route::get('inventory/transfers',                    [StockTransferController::class, 'index'])->name('stock_transfer.index');
    Route::post('inventory/transfers',                   [StockTransferController::class, 'store'])->name('stock_transfer.store');
    Route::delete('inventory/transfers/{stockTransfer}', [StockTransferController::class, 'destroy'])->name('stock_transfer.destroy');

    // Stock Adjustment
    Route::get('inventory/adjustments',          [StockAdjustmentController::class, 'index'])->name('stock_adjustment.index');
    Route::post('inventory/adjustments',         [StockAdjustmentController::class, 'store'])->name('stock_adjustment.store');
    Route::get('inventory/adjustments/stock',    [StockAdjustmentController::class, 'warehouseStock'])->name('stock_adjustment.warehouse_stock');

    // Warehouses
    Route::get('warehouses',                                    [WarehouseController::class, 'index'])->name('warehouses.index');
    Route::get('warehouses/{warehouse}',                        [WarehouseController::class, 'show'])->name('warehouses.show');
    Route::post('warehouses',                                   [WarehouseController::class, 'store'])->name('warehouses.store');
    Route::put('warehouses/{warehouse}',                        [WarehouseController::class, 'update'])->name('warehouses.update');
    Route::delete('warehouses/{warehouse}',                     [WarehouseController::class, 'destroy'])->name('warehouses.destroy');
    Route::put('warehouses/{warehouse}/items/{item}/min',       [WarehouseController::class, 'updateItemMin'])->name('warehouses.item_min');

    // Suppliers
    Route::get('/suppliers',                [SupplierController::class, 'index'])->name('suppliers.index');
    Route::post('/suppliers',               [SupplierController::class, 'store'])->name('suppliers.store');
    Route::put('/suppliers/{supplier}',     [SupplierController::class, 'update'])->name('suppliers.update');
    Route::delete('/suppliers/{supplier}',  [SupplierController::class, 'destroy'])->name('suppliers.destroy');

    // Customers
    Route::get('/customers',               [CustomerController::class, 'index'])  ->name('customers.index');
    Route::post('/customers',              [CustomerController::class, 'store'])  ->name('customers.store');
    Route::put('/customers/{customer}',    [CustomerController::class, 'update']) ->name('customers.update');
    Route::delete('/customers/{customer}', [CustomerController::class, 'destroy'])->name('customers.destroy');

    // POS / Kasir (terminal must be before /{saleHeader} to avoid conflict)
    Route::get('pos/terminal',              [PosController::class, 'terminal'])->name('pos.terminal');
    Route::get('pos',                       [PosController::class, 'index'])   ->name('pos.index');
    Route::post('pos',                      [PosController::class, 'store'])   ->name('pos.store');
    Route::get('pos/{saleHeader}',          [PosController::class, 'show'])    ->name('pos.show');
    Route::post('pos/{saleHeader}/void',    [PosController::class, 'void'])    ->name('pos.void');

    // Returns
    Route::get('returns',                       [ReturnController::class, 'index'])->name('returns.index');
    Route::post('returns',                      [ReturnController::class, 'store'])->name('returns.store');
    Route::get('returns/{returnHeader}',        [ReturnController::class, 'show']) ->name('returns.show');
    Route::post('returns/{returnHeader}/void',  [ReturnController::class, 'void']) ->name('returns.void');

    // Reports
    Route::get('report/stock',              [ReportController::class, 'stock'])->name('Report_Stock');
    Route::get('report/stock/export/excel', [ReportController::class, 'exportStockExcel'])->name('report.stock.excel');
    Route::get('report/sales',              [ReportController::class, 'salesReport'])->name('Report_Sales');
    Route::get('report/sales/export/excel', [ReportController::class, 'exportSalesExcel'])->name('report.sales.excel');
    Route::get('report/cashflow',           [ReportController::class, 'cashReport'])->name('Report_Cashflow');
    Route::get('report/profit-loss',        [ReportController::class, 'profitLoss'])->name('Report_ProfitLoss');

    // Promotions
    Route::get('/promotions',                  [PromotionController::class, 'index'])->name('promotions.index');
    Route::post('/promotions',                 [PromotionController::class, 'store'])->name('promotions.store');
    Route::put('/promotions/{promotion}',      [PromotionController::class, 'update'])->name('promotions.update');
    Route::delete('/promotions/{promotion}',   [PromotionController::class, 'destroy'])->name('promotions.destroy');
    Route::get('/promotions/active',           [PromotionController::class, 'active'])->name('promotions.active');

    // Tags
    Route::get('/tags',          [TagController::class, 'index'])->name('tags.index');
    Route::post('/tags',         [TagController::class, 'store'])->name('tags.store');
    Route::put('/tags/{tag}',    [TagController::class, 'update'])->name('tags.update');
    Route::delete('/tags/{tag}', [TagController::class, 'destroy'])->name('tags.destroy');

    // Purchase Orders (create must be before /{purchaseOrder} wildcard)
    Route::get('purchase-orders',                               [PurchaseOrderController::class, 'index'])       ->name('po.index');
    Route::post('purchase-orders',                              [PurchaseOrderController::class, 'store'])       ->name('po.store');
    Route::get('purchase-orders/{purchaseOrder}',               [PurchaseOrderController::class, 'show'])        ->name('po.show');
    Route::post('purchase-orders/{purchaseOrder}/status',       [PurchaseOrderController::class, 'updateStatus'])->name('po.status');
    Route::post('purchase-orders/{purchaseOrder}/receive',      [PurchaseOrderController::class, 'receive'])     ->name('po.receive');
    Route::delete('purchase-orders/{purchaseOrder}',            [PurchaseOrderController::class, 'destroy'])     ->name('po.destroy');

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
    Route::post('/users/{user}/warehouses',       [UserController::class, 'updateWarehouses'])->name('users.warehouses');
});

require __DIR__.'/settings.php';
require __DIR__.'/auth.php';
