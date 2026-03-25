# API Access Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a read-only REST API with API key authentication to the POS app, plus a management UI for creating/revoking keys.

**Architecture:** API keys stored hashed in `api_keys` table, validated via `BearerTokenAuth` middleware on a separate `routes/api_v1.php` route file. Scopes control which modules a key can access. Dedicated controller classes keep API logic separate from web controllers.

**Tech Stack:** Laravel 12, PHP 8.2, SQLite/MariaDB, no new packages required (uses existing `Hash::make` + `Str::random`).

---

## Task 1: Migration — `api_keys` table

**Files:**
- Create: `database/migrations/2026_03_23_200000_create_api_keys_table.php`

- [ ] Create the migration file:

```php
Schema::create('api_keys', function (Blueprint $table) {
    $table->id();
    $table->foreignId('user_id')->constrained()->cascadeOnDelete();
    $table->string('name', 100);
    $table->string('key_hash', 100)->unique(); // SHA-256 of the raw key
    $table->string('key_prefix', 10);          // First 8 chars for display (e.g. "pos_abc1")
    $table->json('scopes')->nullable();         // null = all scopes
    $table->timestamp('last_used_at')->nullable();
    $table->timestamp('expires_at')->nullable();
    $table->boolean('is_active')->default(true);
    $table->timestamps();
});
```

- [ ] Run migration:
```bash
php artisan migrate
```
Expected: `create_api_keys_table ... DONE`

---

## Task 2: Model — `ApiKey`

**Files:**
- Create: `app/Models/ApiKey.php`

- [ ] Create the model:

```php
<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ApiKey extends Model
{
    protected $fillable = [
        'user_id', 'name', 'key_hash', 'key_prefix',
        'scopes', 'last_used_at', 'expires_at', 'is_active',
    ];

    protected $casts = [
        'scopes'       => 'array',
        'last_used_at' => 'datetime',
        'expires_at'   => 'datetime',
        'is_active'    => 'boolean',
    ];

    public function user() { return $this->belongsTo(User::class); }

    public function isValid(): bool
    {
        if (!$this->is_active) return false;
        if ($this->expires_at && $this->expires_at->isPast()) return false;
        return true;
    }

    public function hasScope(string $scope): bool
    {
        if ($this->scopes === null) return true; // null = all scopes
        return in_array($scope, $this->scopes, true);
    }

    public static function generateRaw(): string
    {
        return 'pos_' . bin2hex(random_bytes(24)); // 52-char key
    }

    public static function hashRaw(string $raw): string
    {
        return hash('sha256', $raw);
    }
}
```

- [ ] Verify: `php artisan tinker` → `App\Models\ApiKey::generateRaw()` returns a `pos_...` string.

---

## Task 3: Middleware — `BearerTokenAuth`

**Files:**
- Create: `app/Http/Middleware/BearerTokenAuth.php`

- [ ] Create the middleware:

```php
<?php
namespace App\Http\Middleware;

use App\Models\ApiKey;
use Closure;
use Illuminate\Http\Request;

class BearerTokenAuth
{
    public function handle(Request $request, Closure $next)
    {
        $raw = $request->bearerToken();
        if (!$raw) {
            return response()->json(['error' => 'API key required'], 401);
        }

        $hash   = ApiKey::hashRaw($raw);
        $apiKey = ApiKey::where('key_hash', $hash)->with('user')->first();

        if (!$apiKey || !$apiKey->isValid()) {
            return response()->json(['error' => 'Invalid or expired API key'], 401);
        }

        // Attach key and user to request for downstream use
        $request->attributes->set('api_key', $apiKey);
        auth()->setUser($apiKey->user);

        // Update last_used_at without triggering updated_at
        ApiKey::where('id', $apiKey->id)
            ->update(['last_used_at' => now()]);

        return $next($request);
    }
}
```

- [ ] Register in `bootstrap/app.php` (Laravel 12 style):

```php
->withMiddleware(function (Middleware $middleware) {
    $middleware->alias([
        'api.key' => \App\Http\Middleware\BearerTokenAuth::class,
    ]);
})
```

---

## Task 4: API Routes file

**Files:**
- Create: `routes/api_v1.php`
- Modify: `bootstrap/app.php`

- [ ] Create `routes/api_v1.php`:

```php
<?php
use App\Http\Controllers\Api\V1\ItemApiController;
use App\Http\Controllers\Api\V1\SaleApiController;
use App\Http\Controllers\Api\V1\CustomerApiController;
use App\Http\Controllers\Api\V1\WarehouseApiController;
use App\Http\Controllers\Api\V1\ReportApiController;
use Illuminate\Support\Facades\Route;

Route::middleware('api.key')->prefix('v1')->group(function () {
    Route::get('/items',               [ItemApiController::class,      'index']);
    Route::get('/items/{id}',          [ItemApiController::class,      'show']);
    Route::get('/sales',               [SaleApiController::class,      'index']);
    Route::get('/sales/{id}',          [SaleApiController::class,      'show']);
    Route::get('/customers',           [CustomerApiController::class,  'index']);
    Route::get('/customers/{id}',      [CustomerApiController::class,  'show']);
    Route::get('/warehouses',          [WarehouseApiController::class, 'index']);
    Route::get('/reports/summary',     [ReportApiController::class,    'summary']);
});
```

- [ ] Register the route file in `bootstrap/app.php`:

```php
->withRouting(
    web: __DIR__.'/../routes/web.php',
    api: __DIR__.'/../routes/api_v1.php',   // add this
    ...
)
```

Note: Laravel 12 maps `routes/api.php` automatically — if that file already exists, rename it or point to `api_v1.php` explicitly via `Route::apiPrefix('api')` in the routing closure.

---

## Task 5: API Controllers (read-only)

**Files:**
- Create: `app/Http/Controllers/Api/V1/ItemApiController.php`
- Create: `app/Http/Controllers/Api/V1/SaleApiController.php`
- Create: `app/Http/Controllers/Api/V1/CustomerApiController.php`
- Create: `app/Http/Controllers/Api/V1/WarehouseApiController.php`
- Create: `app/Http/Controllers/Api/V1/ReportApiController.php`

### ItemApiController

```php
<?php
namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Item;
use Illuminate\Http\Request;

class ItemApiController extends Controller
{
    public function index(Request $request)
    {
        $apiKey = $request->attributes->get('api_key');
        if (!$apiKey->hasScope('items')) {
            return response()->json(['error' => 'Insufficient scope'], 403);
        }

        $items = Item::with('kategoriRelation')
            ->when($request->search, fn($q) => $q->where('nama', 'like', "%{$request->search}%"))
            ->when($request->category, fn($q) => $q->where('kategori', $request->category))
            ->orderBy('nama')
            ->paginate(min((int)($request->per_page ?? 20), 100));

        return response()->json([
            'data' => $items->map(fn($i) => [
                'id'             => $i->id,
                'name'           => $i->nama,
                'code'           => $i->kode_item,
                'category'       => $i->kategori,
                'stock'          => $i->stok,
                'selling_price'  => $i->harga_jual,
                'purchase_price' => $i->harga_beli,
            ]),
            'meta' => [
                'current_page' => $items->currentPage(),
                'last_page'    => $items->lastPage(),
                'total'        => $items->total(),
            ],
        ]);
    }

    public function show(Request $request, int $id)
    {
        $apiKey = $request->attributes->get('api_key');
        if (!$apiKey->hasScope('items')) {
            return response()->json(['error' => 'Insufficient scope'], 403);
        }

        $item = Item::findOrFail($id);
        return response()->json([
            'id'             => $item->id,
            'name'           => $item->nama,
            'code'           => $item->kode_item,
            'category'       => $item->kategori,
            'stock'          => $item->stok,
            'stock_min'      => $item->stok_minimal,
            'selling_price'  => $item->harga_jual,
            'purchase_price' => $item->harga_beli,
            'description'    => $item->deskripsi,
        ]);
    }
}
```

### SaleApiController

```php
<?php
namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\SaleHeader;
use Illuminate\Http\Request;

class SaleApiController extends Controller
{
    public function index(Request $request)
    {
        $apiKey = $request->attributes->get('api_key');
        if (!$apiKey->hasScope('pos')) {
            return response()->json(['error' => 'Insufficient scope'], 403);
        }

        $sales = SaleHeader::with('warehouse')
            ->where('status', 'completed')
            ->when($request->date_from, fn($q) => $q->whereDate('occurred_at', '>=', $request->date_from))
            ->when($request->date_to,   fn($q) => $q->whereDate('occurred_at', '<=', $request->date_to))
            ->when($request->warehouse_id, fn($q) => $q->where('warehouse_id', $request->warehouse_id))
            ->orderByDesc('occurred_at')
            ->paginate(min((int)($request->per_page ?? 20), 100));

        return response()->json([
            'data' => $sales->map(fn($s) => [
                'id'             => $s->id,
                'sale_number'    => $s->sale_number,
                'occurred_at'    => $s->occurred_at?->toISOString(),
                'warehouse'      => $s->warehouse?->name,
                'payment_method' => $s->payment_method,
                'grand_total'    => $s->grand_total,
                'discount'       => $s->discount_amount,
            ]),
            'meta' => [
                'current_page' => $sales->currentPage(),
                'last_page'    => $sales->lastPage(),
                'total'        => $sales->total(),
            ],
        ]);
    }

    public function show(Request $request, int $id)
    {
        $apiKey = $request->attributes->get('api_key');
        if (!$apiKey->hasScope('pos')) {
            return response()->json(['error' => 'Insufficient scope'], 403);
        }

        $sale = SaleHeader::with(['saleItems', 'warehouse', 'customer'])->findOrFail($id);
        return response()->json([
            'id'             => $sale->id,
            'sale_number'    => $sale->sale_number,
            'occurred_at'    => $sale->occurred_at?->toISOString(),
            'warehouse'      => $sale->warehouse?->name,
            'customer'       => $sale->customer?->name,
            'payment_method' => $sale->payment_method,
            'grand_total'    => $sale->grand_total,
            'discount'       => $sale->discount_amount,
            'items'          => $sale->saleItems->map(fn($si) => [
                'name'       => $si->item_name_snapshot,
                'quantity'   => $si->quantity,
                'unit_price' => $si->unit_price,
                'line_total' => $si->line_total,
            ]),
        ]);
    }
}
```

### CustomerApiController

```php
<?php
namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use Illuminate\Http\Request;

class CustomerApiController extends Controller
{
    public function index(Request $request)
    {
        $apiKey = $request->attributes->get('api_key');
        if (!$apiKey->hasScope('customers')) {
            return response()->json(['error' => 'Insufficient scope'], 403);
        }

        $customers = Customer::where('is_active', true)
            ->when($request->search, fn($q) => $q->where('name', 'like', "%{$request->search}%"))
            ->orderBy('name')
            ->paginate(min((int)($request->per_page ?? 20), 100));

        return response()->json([
            'data' => $customers->map(fn($c) => [
                'id'    => $c->id,
                'name'  => $c->name,
                'code'  => $c->code,
                'phone' => $c->phone,
                'email' => $c->email,
            ]),
            'meta' => [
                'current_page' => $customers->currentPage(),
                'last_page'    => $customers->lastPage(),
                'total'        => $customers->total(),
            ],
        ]);
    }

    public function show(Request $request, int $id)
    {
        $apiKey = $request->attributes->get('api_key');
        if (!$apiKey->hasScope('customers')) {
            return response()->json(['error' => 'Insufficient scope'], 403);
        }

        $customer = Customer::withCount([
            'installmentPlans as active_plans' => fn($q) => $q->whereIn('status', ['active', 'overdue']),
        ])->findOrFail($id);

        return response()->json([
            'id'           => $customer->id,
            'name'         => $customer->name,
            'code'         => $customer->code,
            'phone'        => $customer->phone,
            'email'        => $customer->email,
            'address'      => $customer->address,
            'active_plans' => $customer->active_plans,
        ]);
    }
}
```

### WarehouseApiController

```php
<?php
namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Warehouse;
use Illuminate\Http\Request;

class WarehouseApiController extends Controller
{
    public function index(Request $request)
    {
        $apiKey = $request->attributes->get('api_key');
        if (!$apiKey->hasScope('warehouses')) {
            return response()->json(['error' => 'Insufficient scope'], 403);
        }

        $warehouses = Warehouse::where('is_active', true)->orderBy('name')->get();

        return response()->json([
            'data' => $warehouses->map(fn($w) => [
                'id'         => $w->id,
                'name'       => $w->name,
                'code'       => $w->code,
                'city'       => $w->city,
                'is_default' => (bool) $w->is_default,
            ]),
        ]);
    }
}
```

### ReportApiController

```php
<?php
namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Expense;
use App\Models\ReturnHeader;
use App\Models\SaleHeader;
use App\Models\SaleItem;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ReportApiController extends Controller
{
    public function summary(Request $request)
    {
        $apiKey = $request->attributes->get('api_key');
        if (!$apiKey->hasScope('reports')) {
            return response()->json(['error' => 'Insufficient scope'], 403);
        }

        $dateFrom    = $request->get('date_from', now()->startOfMonth()->format('Y-m-d'));
        $dateTo      = $request->get('date_to',   now()->format('Y-m-d'));
        $warehouseId = $request->get('warehouse_id');

        $query = SaleHeader::where('status', 'completed')
            ->whereBetween('occurred_at', [$dateFrom.' 00:00:00', $dateTo.' 23:59:59'])
            ->when($warehouseId, fn($q) => $q->where('warehouse_id', $warehouseId));

        $revenue = (int) $query->sum('grand_total');
        $trxCount = $query->count();

        $returns = (int) ReturnHeader::where('type', 'customer_return')
            ->where('status', 'completed')
            ->whereBetween('occurred_at', [$dateFrom, $dateTo])
            ->when($warehouseId, fn($q) => $q->where('warehouse_id', $warehouseId))
            ->sum('total_amount');

        $cogs = (int) SaleItem::whereHas('saleHeader', fn($q) => $q
            ->where('status', 'completed')
            ->whereBetween('occurred_at', [$dateFrom.' 00:00:00', $dateTo.' 23:59:59'])
            ->when($warehouseId, fn($q2) => $q2->where('warehouse_id', $warehouseId))
        )->sum(DB::raw('quantity * cost_price_snapshot'));

        $expenses = (int) Expense::whereBetween('occurred_at', [$dateFrom, $dateTo])
            ->when($warehouseId, fn($q) => $q->where('warehouse_id', $warehouseId))
            ->sum('amount');

        $netRevenue  = max(0, $revenue - $returns);
        $grossProfit = $netRevenue - $cogs;
        $netProfit   = $grossProfit - $expenses;

        return response()->json([
            'date_from'    => $dateFrom,
            'date_to'      => $dateTo,
            'transactions' => $trxCount,
            'revenue'      => $revenue,
            'returns'      => $returns,
            'net_revenue'  => $netRevenue,
            'cogs'         => $cogs,
            'gross_profit' => $grossProfit,
            'expenses'     => $expenses,
            'net_profit'   => $netProfit,
        ]);
    }
}
```

- [ ] Verify with curl (after Task 6 creates a key):
```bash
curl -H "Authorization: Bearer pos_<key>" http://localhost:8000/api/v1/items
```
Expected: JSON with `data` array and `meta` pagination.

---

## Task 6: Web Controller — API Key Management

**Files:**
- Create: `app/Http/Controllers/ApiKeyController.php`

```php
<?php
namespace App\Http\Controllers;

use App\Models\ApiKey;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

class ApiKeyController extends Controller
{
    public const AVAILABLE_SCOPES = ['items', 'pos', 'customers', 'warehouses', 'reports', 'inventory', 'suppliers', 'purchase_orders'];

    public function index()
    {
        $keys = ApiKey::where('user_id', Auth::id())
            ->orderByDesc('created_at')
            ->get()
            ->map(fn($k) => [
                'id'           => $k->id,
                'name'         => $k->name,
                'key_prefix'   => $k->key_prefix,
                'scopes'       => $k->scopes,
                'is_active'    => $k->is_active,
                'last_used_at' => $k->last_used_at?->toISOString(),
                'expires_at'   => $k->expires_at?->toISOString(),
                'created_at'   => $k->created_at->toISOString(),
            ]);

        return Inertia::render('settings/ApiKeys', [
            'apiKeys'         => $keys,
            'availableScopes' => self::AVAILABLE_SCOPES,
        ]);
    }

    public function store(Request $request)
    {
        $request->validate([
            'name'       => 'required|string|max:100',
            'scopes'     => 'nullable|array',
            'scopes.*'   => 'string|in:' . implode(',', self::AVAILABLE_SCOPES),
            'expires_at' => 'nullable|date|after:today',
        ]);

        $raw = ApiKey::generateRaw();

        ApiKey::create([
            'user_id'    => Auth::id(),
            'name'       => $request->name,
            'key_hash'   => ApiKey::hashRaw($raw),
            'key_prefix' => substr($raw, 0, 12),
            'scopes'     => $request->scopes ?: null,
            'expires_at' => $request->expires_at,
            'is_active'  => true,
        ]);

        // Flash the raw key once — never stored again
        return back()->with('new_api_key', $raw);
    }

    public function revoke(ApiKey $apiKey)
    {
        abort_if($apiKey->user_id !== Auth::id(), 403);
        $apiKey->update(['is_active' => false]);
        return back()->with('success', 'API key dinonaktifkan.');
    }

    public function destroy(ApiKey $apiKey)
    {
        abort_if($apiKey->user_id !== Auth::id(), 403);
        $apiKey->delete();
        return back()->with('success', 'API key dihapus.');
    }
}
```

---

## Task 7: Routes for API Key Management UI

**Files:**
- Modify: `routes/web.php`

- [ ] Add inside the `auth` + `verified` middleware group:

```php
use App\Http\Controllers\ApiKeyController;

// API Key Management
Route::get('settings/api-keys',           [ApiKeyController::class, 'index'])->name('settings.api-keys.index');
Route::post('settings/api-keys',          [ApiKeyController::class, 'store'])->name('settings.api-keys.store');
Route::patch('settings/api-keys/{apiKey}/revoke', [ApiKeyController::class, 'revoke'])->name('settings.api-keys.revoke');
Route::delete('settings/api-keys/{apiKey}',       [ApiKeyController::class, 'destroy'])->name('settings.api-keys.destroy');
```

- [ ] Add to `adminNavItems` in `resources/js/components/app-sidebar.tsx`:

```tsx
{
    title: 'API Keys',
    href: '/settings/api-keys',
    icon: Key,
    iconColor: 'text-slate-400',
    single: true,
},
```

Also add `Key` to the lucide-react import.

---

## Task 8: Frontend — API Keys settings page

**Files:**
- Create: `resources/js/pages/settings/ApiKeys.tsx`

The page needs:
1. List of existing keys (name, prefix, scopes, last used, active/revoked badge, delete/revoke buttons)
2. "Create New Key" form (name, scope checkboxes, optional expiry date)
3. One-time display of the newly created raw key in a copyable alert (read from flash `new_api_key`)

Key UI elements:
- After creation: green alert banner showing the full key with a copy button, warning "This key will not be shown again."
- Scope selector: checkboxes for each module, with a "Select All" toggle
- Inactive keys shown greyed out with a "Revoked" badge

```tsx
import { useState } from 'react';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import { Copy, Check, Plus, Trash2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DatePickerInput } from '@/components/DatePickerInput';

// ... (full implementation follows standard page pattern)
// Props: apiKeys[], availableScopes[], flash.new_api_key
// Form state: name, scopes (string[]), expires_at
// On submit: router.post(route('settings.api-keys.store'), ...)
// On revoke: router.patch(route('settings.api-keys.revoke', {apiKey: id}))
// On delete: router.delete(route('settings.api-keys.destroy', {apiKey: id}))
```

---

## Task 9: Verification

- [ ] Create a test key via the UI at `/settings/api-keys`
- [ ] Test all endpoints:

```bash
KEY="pos_your_key_here"
BASE="http://localhost:8000/api"

curl -H "Authorization: Bearer $KEY" "$BASE/v1/items?per_page=5"
curl -H "Authorization: Bearer $KEY" "$BASE/v1/sales?date_from=2026-01-01&date_to=2026-03-23"
curl -H "Authorization: Bearer $KEY" "$BASE/v1/customers"
curl -H "Authorization: Bearer $KEY" "$BASE/v1/warehouses"
curl -H "Authorization: Bearer $KEY" "$BASE/v1/reports/summary?date_from=2026-01-01&date_to=2026-03-23"
```

- [ ] Test scope rejection (create a key with only `items` scope, try `/v1/sales`):

```bash
curl -H "Authorization: Bearer $ITEMS_ONLY_KEY" "$BASE/v1/sales"
# Expected: {"error":"Insufficient scope"} 403
```

- [ ] Test invalid key:
```bash
curl -H "Authorization: Bearer pos_invalid" "$BASE/v1/items"
# Expected: {"error":"Invalid or expired API key"} 401
```

- [ ] Test expired key: set `expires_at` to yesterday, try request → 401.

- [ ] Run test suite:
```bash
composer run test
```
Expected: 29 passed (same as before — no regressions).
