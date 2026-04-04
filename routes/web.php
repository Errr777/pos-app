<?php

use App\Http\Controllers\AppSettingController;
use App\Http\Controllers\AuditLogController;
use App\Http\Controllers\BackupController;
use App\Http\Controllers\CustomerController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\DeliveryOrderController;
use App\Http\Controllers\ExpenseController;
use App\Http\Controllers\InstallmentController;
use App\Http\Controllers\ItemController;
use App\Http\Controllers\ItemVariantController;
use App\Http\Controllers\KategoriController;
use App\Http\Controllers\OnboardingController;
use App\Http\Controllers\PosController;
use App\Http\Controllers\PromotionController;
use App\Http\Controllers\PurchaseOrderController;
use App\Http\Controllers\ReportController;
use App\Http\Controllers\ReturnController;
use App\Http\Controllers\RoleController;
use App\Http\Controllers\StockAdjustmentController;
use App\Http\Controllers\StockMovementController;
use App\Http\Controllers\StockOpnameController;
use App\Http\Controllers\StockTransferController;
use App\Http\Controllers\SupplierController;
use App\Http\Controllers\TagController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\WarehouseController;
use App\Http\Controllers\WarehouseItemPriceController;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::get('/', function () {
    return Inertia::render('welcome', [
        'hasAdmin' => \App\Models\User::where('role', 'admin')->exists(),
    ]);
})->name('home');

// License invalid page (accessible without auth)
Route::get('/license-invalid', fn () => Inertia::render('LicenseInvalid'))->name('license.invalid');

// Onboarding (separate group without the onboarding middleware)
Route::middleware(['auth', 'verified'])->prefix('onboarding')->name('onboarding.')->group(function () {
    Route::get('/', [OnboardingController::class, 'index'])->name('index');
    Route::post('/', [OnboardingController::class, 'store'])->name('store');
});

Route::middleware(['auth', 'verified', 'onboarding', 'license', 'throttle:300,1'])->group(function () {
    Route::get('dashboard', [DashboardController::class, 'index'])->name('dashboard');

    // Items
    Route::middleware('module:items')->group(function () {
        Route::get('/item', [ItemController::class, 'index'])->name('item.index');
        Route::get('/item/print-labels', [ItemController::class, 'printLabels'])->name('item.print_labels');
        Route::get('/item/{item}', [ItemController::class, 'show'])->name('item.show');
        Route::get('/tambah_item', [ItemController::class, 'create'])->name('item.tambah');
        Route::post('/item', [ItemController::class, 'store'])->name('item.store');
        Route::put('/item/{item}', [ItemController::class, 'update'])->name('item.update');
        Route::delete('/item/{item}', [ItemController::class, 'destroy'])->name('item.destroy');
        Route::patch('/item/{item}/tags', [ItemController::class, 'syncTags'])->name('item.sync_tags');
        Route::get('/item/{item}/variants', [ItemVariantController::class, 'index'])->name('item.variants.index');
        Route::post('/item/{item}/variants', [ItemVariantController::class, 'store'])->name('item.variants.store');
        Route::put('/item/{item}/variants/{variant}', [ItemVariantController::class, 'update'])->name('item.variants.update');
        Route::delete('/item/{item}/variants/{variant}', [ItemVariantController::class, 'destroy'])->name('item.variants.destroy');
        Route::get('/stock_alerts', [ItemController::class, 'lowStock'])->name('item.low_stock');
        Route::get('/category', [KategoriController::class, 'index'])->name('kategori.index');
        Route::get('/category/{kategori}', [KategoriController::class, 'show'])->name('kategori.show');
        Route::post('/category', [KategoriController::class, 'store'])->name('kategori.store');
        Route::put('/category/{kategori}', [KategoriController::class, 'update'])->name('kategori.update');
        Route::delete('/category/{kategori}', [KategoriController::class, 'destroy'])->name('kategori.destroy');
        Route::get('items/add', fn () => Inertia::render('Items/Add_Items'))->name('Add_Items');
        Route::get('items/stock_alerts', fn () => Inertia::render('Items/Stock_alerts'))->name('stock_alerts');
    });

    // Inventory
    Route::middleware('module:inventory')->group(function () {
        Route::get('inventory/stock_in', [StockMovementController::class, 'stockIn'])->name('Stock_In');
        Route::get('inventory/stock_out', [StockMovementController::class, 'stockOut'])->name('Stock_Out');
        Route::get('inventory/stock_out/items', [StockMovementController::class, 'stockOutItems'])->name('stock_out.items');
        Route::get('inventory/stock_log', [StockMovementController::class, 'log'])->name('Stock_Log');
        Route::get('inventory', [StockMovementController::class, 'history'])->name('Stock_History');
        Route::post('inventory/stock', [StockMovementController::class, 'store'])->name('stock.store');
        Route::put('inventory/stock/{transaction}', [StockMovementController::class, 'update'])->name('stock.update');
        Route::delete('inventory/stock/{transaction}', [StockMovementController::class, 'destroy'])->name('stock.destroy');
        Route::get('inventory/transfers', [StockTransferController::class, 'index'])->name('stock_transfer.index');
        Route::post('inventory/transfers', [StockTransferController::class, 'store'])->name('stock_transfer.store');
        Route::delete('inventory/transfers/{stockTransfer}', [StockTransferController::class, 'destroy'])->name('stock_transfer.destroy');
        Route::get('inventory/adjustments', [StockAdjustmentController::class, 'index'])->name('stock_adjustment.index');
        Route::post('inventory/adjustments', [StockAdjustmentController::class, 'store'])->name('stock_adjustment.store');
        Route::get('inventory/adjustments/stock', [StockAdjustmentController::class, 'warehouseStock'])->name('stock_adjustment.warehouse_stock');
        Route::get('inventory/opname', [StockOpnameController::class, 'index'])->name('opname.index');
        Route::post('inventory/opname', [StockOpnameController::class, 'store'])->name('opname.store');
        Route::get('inventory/opname/{opname}', [StockOpnameController::class, 'show'])->name('opname.show');
        Route::put('inventory/opname/{opname}/items', [StockOpnameController::class, 'updateItems'])->name('opname.update_items');
        Route::post('inventory/opname/{opname}/submit', [StockOpnameController::class, 'submit'])->name('opname.submit');
        Route::delete('inventory/opname/{opname}', [StockOpnameController::class, 'destroy'])->name('opname.destroy');
        Route::get('inventory/delivery-orders', [DeliveryOrderController::class, 'index'])->name('delivery_orders.index');
        Route::get('inventory/delivery-orders/create', [DeliveryOrderController::class, 'create'])->name('delivery_orders.create');
        Route::post('inventory/delivery-orders', [DeliveryOrderController::class, 'store'])->name('delivery_orders.store');
        Route::get('inventory/delivery-orders/{deliveryOrder}', [DeliveryOrderController::class, 'show'])->name('delivery_orders.show');
        Route::post('inventory/delivery-orders/{deliveryOrder}/items', [DeliveryOrderController::class, 'addItem'])->name('delivery_orders.add_item');
        Route::post('inventory/delivery-orders/{deliveryOrder}/confirm', [DeliveryOrderController::class, 'confirm'])->name('delivery_orders.confirm');
        Route::post('inventory/delivery-orders/{deliveryOrder}/cancel', [DeliveryOrderController::class, 'cancel'])->name('delivery_orders.cancel');
        Route::get('inventory/delivery-orders/{deliveryOrder}/print', [DeliveryOrderController::class, 'print'])->name('delivery_orders.print');
        Route::post('inventory/jasa-prices', [WarehouseItemPriceController::class, 'batchJasaPrices'])->name('inventory.jasa_prices');
    });

    // Warehouses
    Route::middleware('module:warehouses')->group(function () {
        Route::get('warehouses', [WarehouseController::class, 'index'])->name('warehouses.index');
        Route::get('warehouses/{warehouse}', [WarehouseController::class, 'show'])->name('warehouses.show');
        Route::post('warehouses', [WarehouseController::class, 'store'])->name('warehouses.store');
        Route::put('warehouses/{warehouse}', [WarehouseController::class, 'update'])->name('warehouses.update');
        Route::delete('warehouses/{warehouse}', [WarehouseController::class, 'destroy'])->name('warehouses.destroy');
        Route::put('warehouses/{warehouse}/items/{item}/min', [WarehouseController::class, 'updateItemMin'])->name('warehouses.item_min');
        Route::get('warehouses/{warehouse}/prices', [WarehouseItemPriceController::class, 'index'])->name('warehouses.prices');
        Route::put('warehouses/{warehouse}/items/{item}/price', [WarehouseItemPriceController::class, 'update'])->name('warehouses.item_price');
        Route::post('warehouses/{warehouse}/prices/sync', [WarehouseItemPriceController::class, 'sync'])->name('warehouses.prices.sync');
        Route::post('warehouses/{warehouse}/items/{item}/price/sync', [WarehouseItemPriceController::class, 'syncOne'])->name('warehouses.item_price.sync');
        Route::delete('warehouses/{warehouse}/items/{item}/jasa-price', [WarehouseItemPriceController::class, 'destroyJasaPrice'])->name('warehouses.jasa_price.destroy');
    });

    // Suppliers
    Route::middleware('module:suppliers')->group(function () {
        Route::get('/suppliers', [SupplierController::class, 'index'])->name('suppliers.index');
        Route::post('/suppliers', [SupplierController::class, 'store'])->name('suppliers.store');
        Route::put('/suppliers/{supplier}', [SupplierController::class, 'update'])->name('suppliers.update');
        Route::delete('/suppliers/{supplier}', [SupplierController::class, 'destroy'])->name('suppliers.destroy');
    });

    // Customers
    Route::middleware('module:customers')->group(function () {
        Route::get('/customers', [CustomerController::class, 'index'])->name('customers.index');
        Route::get('/customers/{customer}', [CustomerController::class, 'show'])->name('customers.show');
        Route::post('/customers', [CustomerController::class, 'store'])->name('customers.store');
        Route::put('/customers/{customer}', [CustomerController::class, 'update'])->name('customers.update');
        Route::delete('/customers/{customer}', [CustomerController::class, 'destroy'])->name('customers.destroy');
        Route::get('customers/{customer}/installments', [InstallmentController::class, 'plans'])->name('installments.plans');
    });

    // POS / Kasir
    Route::middleware('module:pos')->group(function () {
        Route::get('pos/installments/customer/{customer}', [InstallmentController::class, 'customerPlans'])->name('installments.customer_plans');
        Route::post('pos/installments/pay', [InstallmentController::class, 'payFromTerminal'])->middleware('throttle:30,1')->name('installments.pay_terminal');
        Route::post('pos/installments/{plan}/pay-extra', [InstallmentController::class, 'payExtra'])->middleware('throttle:30,1')->name('installments.pay_extra');
        Route::post('pos/installments/{plan}/add-installment', [InstallmentController::class, 'addInstallment'])->middleware('throttle:30,1')->name('installments.add_installment');
        Route::post('installments/{plan}/payments/{payment}/pay', [InstallmentController::class, 'pay'])->middleware('throttle:30,1')->name('installments.pay');
        Route::get('pos/installments/{plan}/invoice', [InstallmentController::class, 'invoice'])->name('installments.invoice');
        Route::get('pos/installments/{plan}/invoice/pdf', [InstallmentController::class, 'invoicePdf'])->name('installments.invoice.pdf');
        Route::get('pos/installments', fn () => redirect()->route('installments.history'))->name('pos.installments');
        Route::get('pos/kredit', [InstallmentController::class, 'kreditPelangganPage'])->name('installments.history');
        Route::get('pos/terminal', [PosController::class, 'terminal'])->name('pos.terminal');
        Route::get('pos/items', [PosController::class, 'items'])->name('pos.items');
        Route::get('pos/pending', fn () => Inertia::render('pos/PendingSync'))->name('pos.pending');
        Route::get('pos/promo/validate', [PosController::class, 'validatePromo'])->name('pos.promo.validate');
        Route::get('pos', [PosController::class, 'index'])->name('pos.index');
        Route::post('pos', [PosController::class, 'store'])->middleware('throttle:30,1')->name('pos.store');
        Route::get('pos/{saleHeader}', [PosController::class, 'show'])->name('pos.show');
        Route::get('pos/{saleHeader}/print', [PosController::class, 'print'])->name('pos.print');
        Route::get('pos/{saleHeader}/invoice', [PosController::class, 'invoice'])->name('pos.invoice');
        Route::get('pos/{saleHeader}/invoice/pdf', [PosController::class, 'invoicePdf'])->name('pos.invoice.pdf');
        Route::post('pos/{saleHeader}/void', [PosController::class, 'void'])->name('pos.void');
        Route::get('/promotions/active', [PromotionController::class, 'active'])->name('promotions.active');
    });

    // Returns
    Route::middleware('module:returns')->group(function () {
        Route::get('returns', [ReturnController::class, 'index'])->name('returns.index');
        Route::post('returns', [ReturnController::class, 'store'])->name('returns.store');
        Route::get('returns/sale-lookup', [ReturnController::class, 'saleLookup'])->name('returns.sale-lookup');
        Route::get('returns/{returnHeader}', [ReturnController::class, 'show'])->name('returns.show');
        Route::post('returns/{returnHeader}/void', [ReturnController::class, 'void'])->name('returns.void');
    });

    // Reports
    Route::middleware('module:reports')->group(function () {
        Route::get('report/stock', [ReportController::class, 'stock'])->name('Report_Stock');
        Route::get('report/stock/export/excel', [ReportController::class, 'exportStockExcel'])->name('report.stock.excel');
        Route::get('report/stock/export/csv', [ReportController::class, 'exportStockCsv'])->name('report.stock.csv');
        Route::get('report/sales', [ReportController::class, 'salesReport'])->name('Report_Sales');
        Route::get('report/sales/export/excel', [ReportController::class, 'exportSalesExcel'])->name('report.sales.excel');
        Route::get('report/cashflow', [ReportController::class, 'cashReport'])->name('Report_Cashflow');
        Route::get('report/cashflow/export/excel', [ReportController::class, 'exportCashflowExcel'])->name('report.cashflow.excel');
        Route::get('report/profit-loss', [ReportController::class, 'profitLoss'])->name('Report_ProfitLoss');
        Route::get('report/abc', [ReportController::class, 'abcAnalysis'])->name('report.abc');
        Route::get('report/abc/export/excel', [ReportController::class, 'exportAbcExcel'])->name('report.abc.excel');
        Route::get('report/peak-hours', [ReportController::class, 'peakHours'])->name('report.peak_hours');
        Route::get('report/peak-hours/export/excel', [ReportController::class, 'exportPeakHoursExcel'])->name('report.peak_hours.excel');
        Route::get('report/branches', [ReportController::class, 'branchComparison'])->name('report.branches');
        Route::get('report/branches/export/excel', [ReportController::class, 'exportBranchesExcel'])->name('report.branches.excel');
        Route::get('expenses', [ExpenseController::class, 'index'])->name('expenses.index');
        Route::post('expenses', [ExpenseController::class, 'store'])->name('expenses.store');
        Route::put('expenses/{expense}', [ExpenseController::class, 'update'])->name('expenses.update');
        Route::delete('expenses/{expense}', [ExpenseController::class, 'destroy'])->name('expenses.destroy');
    });

    // Purchase Orders
    Route::middleware('module:purchase_orders')->group(function () {
        Route::get('purchase-orders', [PurchaseOrderController::class, 'index'])->name('po.index');
        Route::post('purchase-orders', [PurchaseOrderController::class, 'store'])->name('po.store');
        Route::get('purchase-orders/suggestions', [PurchaseOrderController::class, 'suggestions'])->name('po.suggestions');
        Route::post('purchase-orders/suggestions/create', [PurchaseOrderController::class, 'createFromSuggestions'])->name('po.suggestions.create');
        Route::get('purchase-orders/{purchaseOrder}', [PurchaseOrderController::class, 'show'])->name('po.show');
        Route::post('purchase-orders/{purchaseOrder}/status', [PurchaseOrderController::class, 'updateStatus'])->name('po.status');
        Route::post('purchase-orders/{purchaseOrder}/receive', [PurchaseOrderController::class, 'receive'])->middleware('throttle:30,1')->name('po.receive');
        Route::get('purchase-orders/{purchaseOrder}/invoice', [PurchaseOrderController::class, 'invoice'])->name('po.invoice');
        Route::get('purchase-orders/{purchaseOrder}/invoice/pdf', [PurchaseOrderController::class, 'invoicePdf'])->name('po.invoice.pdf');
        Route::delete('purchase-orders/{purchaseOrder}', [PurchaseOrderController::class, 'destroy'])->name('po.destroy');
        Route::get('/promotions', [PromotionController::class, 'index'])->name('promotions.index');
        Route::post('/promotions', [PromotionController::class, 'store'])->name('promotions.store');
        Route::put('/promotions/{promotion}', [PromotionController::class, 'update'])->name('promotions.update');
        Route::delete('/promotions/{promotion}', [PromotionController::class, 'destroy'])->name('promotions.destroy');
        Route::get('/tags', [TagController::class, 'index'])->name('tags.index');
        Route::post('/tags', [TagController::class, 'store'])->name('tags.store');
        Route::put('/tags/{tag}', [TagController::class, 'update'])->name('tags.update');
        Route::delete('/tags/{tag}', [TagController::class, 'destroy'])->name('tags.destroy');
    });

    // Users
    Route::middleware('module:users')->group(function () {
        Route::get('/users/roles', [RoleController::class, 'index'])->name('users.roles');
        Route::post('/users/roles', [RoleController::class, 'store'])->name('roles.store');
        Route::put('/users/roles/{role}', [RoleController::class, 'update'])->name('roles.update');
        Route::delete('/users/roles/{role}', [RoleController::class, 'destroy'])->name('roles.destroy');
        Route::post('/users/roles/{role}/permissions', [RoleController::class, 'updatePermissions'])->name('roles.permissions');
        Route::get('/users', [UserController::class, 'index'])->name('users.index');
        Route::post('/users', [UserController::class, 'store'])->name('users.store');
        Route::put('/users/{user}', [UserController::class, 'update'])->name('users.update');
        Route::delete('/users/{user}', [UserController::class, 'destroy'])->name('users.destroy');
        Route::post('/users/{user}/reset-password', [UserController::class, 'resetPassword'])->name('users.reset_password');
        Route::post('/users/{user}/permissions', [UserController::class, 'updatePermissions'])->name('users.permissions');
        Route::post('/users/{user}/warehouses', [UserController::class, 'updateWarehouses'])->name('users.warehouses');
    });

    // Admin-only (no module gate needed — always accessible)
    Route::get('/audit-log', [AuditLogController::class, 'index'])->name('audit.log');
    Route::get('/settings/store', [AppSettingController::class, 'edit'])->name('settings.store');
    Route::post('/settings/store', [AppSettingController::class, 'update'])->name('settings.store.update');
    Route::get('/settings/backups', [BackupController::class, 'index'])->name('backups.index');
    Route::get('/settings/backups/download/{filename}', [BackupController::class, 'download'])->name('backups.download');
    Route::post('/settings/backups/run', [BackupController::class, 'run'])->name('backups.run');
    Route::post('/settings/backups/restore/{filename}', [BackupController::class, 'restore'])->name('backups.restore');
    Route::post('/settings/backups/upload', [BackupController::class, 'upload'])->name('backups.upload');
    Route::delete('/settings/backups/{filename}', [BackupController::class, 'destroy'])->name('backups.destroy');
});

require __DIR__.'/settings.php';
require __DIR__.'/auth.php';
