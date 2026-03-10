# User Warehouse Restriction (Option A) — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restrict specific users to only access and manage their assigned warehouses using a pivot table `user_warehouses`, while admins and unassigned users retain full access.

**Architecture:** A pivot table `user_warehouses` maps users to allowed warehouses. If a user has entries in this table, they can only see/use those warehouses. If no entries exist (default), they can access all warehouses. A shared trait `FiltersWarehouseByUser` provides a reusable `allowedWarehouseIds()` helper used by all controllers. Frontend shows warehouse assignment UI inside the user management page.

**Tech Stack:** Laravel 12, Eloquent BelongsToMany, Inertia.js v2, React 19, TypeScript

---

## Scope: What Gets Filtered

| Module | Filtered? | Notes |
|---|---|---|
| Gudang (list + detail) | ✅ | Only assigned warehouses visible |
| POS Terminal | ✅ | Warehouse selector limited |
| Stock Transfer | ✅ | Source & destination limited |
| Stock Adjustment | ✅ | Warehouse selector limited |
| Purchase Order | ✅ | Warehouse selector limited |
| Retur | ✅ | Warehouse selector limited |
| Dashboard | ⬜ | Optional — skip for now |
| Reports | ⬜ | Optional — skip for now |

---

## Backward Compatibility Rule

> **Empty `user_warehouses` = access all.** This means all existing users continue working without any changes needed to their data. Only explicitly assigned users get restricted.

---

## Task 1: Migration — Create `user_warehouses` Table

**Files:**
- Create: `database/migrations/2026_03_10_000010_create_user_warehouses_table.php`

**Step 1: Create the migration file**

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('user_warehouses', function (Blueprint $table) {
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('warehouse_id')->constrained()->cascadeOnDelete();
            $table->primary(['user_id', 'warehouse_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_warehouses');
    }
};
```

**Step 2: Run migration**

```bash
php artisan migrate
```

Expected output:
```
2026_03_10_000010_create_user_warehouses_table .... DONE
```

**Step 3: Verify table exists**

```bash
php artisan tinker --execute="echo Schema::hasTable('user_warehouses') ? 'OK' : 'FAIL';"
```

Expected: `OK`

**Step 4: Commit**

```bash
git add database/migrations/2026_03_10_000010_create_user_warehouses_table.php
git commit -m "feat: create user_warehouses pivot table"
```

---

## Task 2: Update User Model — Add Relationship & Helper Method

**Files:**
- Modify: `app/Models/User.php`

**Step 1: Add `assignedWarehouses()` relation and `allowedWarehouseIds()` method**

In `app/Models/User.php`, add these two methods inside the class body (after `userPermissions()`):

```php
/**
 * Warehouses explicitly assigned to this user.
 * Empty = access all warehouses.
 */
public function assignedWarehouses()
{
    return $this->belongsToMany(Warehouse::class, 'user_warehouses');
}

/**
 * Returns array of allowed warehouse IDs for this user.
 * Empty array means "all warehouses allowed" (no restriction).
 * Admin always returns empty array (= all allowed).
 */
public function allowedWarehouseIds(): array
{
    if ($this->role === 'admin') return [];
    return $this->assignedWarehouses()->pluck('warehouses.id')->toArray();
}
```

**Step 2: Verify method works**

```bash
php artisan tinker --execute="
\$user = App\Models\User::first();
var_dump(\$user->allowedWarehouseIds());
"
```

Expected: `array(0) {}` — empty array (no assignments yet, so all allowed)

**Step 3: Commit**

```bash
git add app/Models/User.php
git commit -m "feat: add assignedWarehouses relation and allowedWarehouseIds() to User model"
```

---

## Task 3: Create Reusable Trait `FiltersWarehouseByUser`

**Files:**
- Create: `app/Traits/FiltersWarehouseByUser.php`

**Purpose:** Single place that applies warehouse filter to any Eloquent query. All controllers use this — no duplicated logic.

**Step 1: Create the trait**

```php
<?php

namespace App\Traits;

use Illuminate\Database\Eloquent\Builder;

trait FiltersWarehouseByUser
{
    /**
     * Apply warehouse restriction to a query based on the authenticated user.
     *
     * Usage in controllers:
     *   $this->applyWarehouseFilter($query, 'warehouse_id');
     *   $this->applyWarehouseFilter($query, 'warehouses.id');
     *
     * @param Builder $query
     * @param string  $column  The column name to filter (e.g. 'warehouse_id')
     * @return Builder
     */
    protected function applyWarehouseFilter(Builder $query, string $column = 'warehouse_id'): Builder
    {
        $ids = auth()->user()?->allowedWarehouseIds() ?? [];
        if (!empty($ids)) {
            $query->whereIn($column, $ids);
        }
        return $query;
    }

    /**
     * Get the allowed warehouse IDs for the current user.
     * Empty = all warehouses allowed.
     */
    protected function allowedWarehouseIds(): array
    {
        return auth()->user()?->allowedWarehouseIds() ?? [];
    }

    /**
     * Check if the current user can access a specific warehouse.
     */
    protected function canAccessWarehouse(int $warehouseId): bool
    {
        $ids = $this->allowedWarehouseIds();
        return empty($ids) || in_array($warehouseId, $ids);
    }
}
```

**Step 2: Commit**

```bash
git add app/Traits/FiltersWarehouseByUser.php
git commit -m "feat: add FiltersWarehouseByUser trait for reusable warehouse restriction"
```

---

## Task 4: Add Route + Controller Method for Warehouse Assignment

**Files:**
- Modify: `app/Http/Controllers/UserController.php`
- Modify: `routes/web.php`

**Step 1: Add `updateWarehouses()` method to UserController**

Add this method to `app/Http/Controllers/UserController.php` (after `updatePermissions()`):

```php
// -------------------------------------------------------------------------
// POST: Update warehouse assignments for a user
// -------------------------------------------------------------------------

public function updateWarehouses(Request $request, User $user)
{
    $validator = Validator::make($request->all(), [
        'warehouse_ids'   => 'nullable|array',
        'warehouse_ids.*' => 'integer|exists:warehouses,id',
    ]);

    if ($validator->fails()) {
        return $request->wantsJson()
            ? response()->json(['errors' => $validator->errors()], 422)
            : back()->withErrors($validator)->withInput();
    }

    // Sync replaces all existing assignments with the new list
    // Empty array = remove all restrictions (access all)
    $user->assignedWarehouses()->sync($request->warehouse_ids ?? []);

    return $request->wantsJson()
        ? response()->json(['message' => 'Warehouse assignments updated'])
        : redirect()->route('users.index')->with('success', 'Akses gudang berhasil diperbarui.');
}
```

**Step 2: Add route in `routes/web.php`** (after `users.permissions` route):

```php
Route::post('/users/{user}/warehouses', [UserController::class, 'updateWarehouses'])->name('users.warehouses');
```

**Step 3: Update `UserController::index()` to include warehouse data**

In the `->through(fn($u) => [...])` mapping inside `index()`, add:

```php
'assignedWarehouseIds' => $u->assignedWarehouses()->pluck('warehouses.id')->toArray(),
```

Also, pass all warehouses to the page:

In `index()`, before `return Inertia::render(...)`:
```php
$allWarehouses = \App\Models\Warehouse::orderBy('name')
    ->get(['id', 'name', 'code', 'is_active'])
    ->map(fn($w) => ['id' => $w->id, 'name' => $w->name, 'code' => $w->code]);
```

Add to `Inertia::render()` props:
```php
'warehouses' => $allWarehouses,
```

**Step 4: Verify route exists**

```bash
php artisan route:list --path=users | grep warehouse
```

Expected: `POST users/{user}/warehouses users.warehouses`

**Step 5: Commit**

```bash
git add app/Http/Controllers/UserController.php routes/web.php
git commit -m "feat: add warehouse assignment route and controller method"
```

---

## Task 5: Share `allowedWarehouseIds` Globally via HandleInertiaRequests

**Files:**
- Modify: `app/Http/Middleware/HandleInertiaRequests.php`

**Purpose:** Frontend needs to know which warehouses the current user can access, so selectors (in POS, PO, etc.) can be filtered client-side too.

**Step 1: Add `allowedWarehouseIds` to the `share()` method**

In `HandleInertiaRequests.php`, inside `share()`, add after the `'permissions'` key:

```php
'allowedWarehouseIds' => function () use ($request) {
    $user = $request->user();
    if (!$user) return [];
    return $user->allowedWarehouseIds(); // empty = all allowed
},
```

**Step 2: Update `resources/js/types/index.d.ts`**

In the `SharedData` interface (or wherever `permissions` is declared), add:

```typescript
allowedWarehouseIds: number[]; // empty = all warehouses allowed
```

**Step 3: Commit**

```bash
git add app/Http/Middleware/HandleInertiaRequests.php resources/js/types/index.d.ts
git commit -m "feat: share allowedWarehouseIds globally via Inertia middleware"
```

---

## Task 6: Apply Filter in WarehouseController

**Files:**
- Modify: `app/Http/Controllers/WarehouseController.php`

**Step 1: Add trait to controller**

At the top of the class:
```php
use App\Traits\FiltersWarehouseByUser;

class WarehouseController extends Controller
{
    use FiltersWarehouseByUser;
```

**Step 2: Filter `index()` method**

Replace:
```php
$warehouses = Warehouse::orderBy('is_default', 'desc')->orderBy('name')->get()
```

With:
```php
$query = Warehouse::orderBy('is_default', 'desc')->orderBy('name');
$this->applyWarehouseFilter($query, 'id');
$warehouses = $query->get()
```

**Step 3: Guard `show()` method**

At the top of `show()`, after the method signature:
```php
if (!$this->canAccessWarehouse($warehouse->id)) {
    abort(403, 'Anda tidak memiliki akses ke gudang ini.');
}
```

**Step 4: Test manually**

1. Assign a test user to only Warehouse 1 via tinker:
```bash
php artisan tinker --execute="
\$user = App\Models\User::where('role', 'staff')->first();
\$user->assignedWarehouses()->sync([1]);
echo 'Assigned. IDs: ' . implode(',', \$user->allowedWarehouseIds());
"
```
2. Login as that user → `/warehouses` should show only Warehouse 1
3. Try accessing `/warehouses/2` → should get 403
4. Login as admin → all warehouses visible

**Step 5: Commit**

```bash
git add app/Http/Controllers/WarehouseController.php
git commit -m "feat: apply warehouse filter to WarehouseController"
```

---

## Task 7: Apply Filter in PosController

**Files:**
- Modify: `app/Http/Controllers/PosController.php`

**Step 1: Add trait**

```php
use App\Traits\FiltersWarehouseByUser;

class PosController extends Controller
{
    use FiltersWarehouseByUser;
```

**Step 2: Find where warehouses are passed to the terminal page**

In `terminal()` method, find the line that loads warehouses (likely `Warehouse::where('is_active', true)->get()`).

Replace with:
```php
$warehouseQuery = Warehouse::where('is_active', true);
$this->applyWarehouseFilter($warehouseQuery, 'id');
$warehouses = $warehouseQuery->get(['id', 'name', 'code', 'is_default']);
```

**Step 3: Filter `index()` (sales history) by allowed warehouses**

In `index()`, find the `SaleHeader` query and add:
```php
$ids = $this->allowedWarehouseIds();
if (!empty($ids)) {
    $query->whereIn('warehouse_id', $ids);
}
```

**Step 4: Commit**

```bash
git add app/Http/Controllers/PosController.php
git commit -m "feat: apply warehouse filter to PosController"
```

---

## Task 8: Apply Filter in StockTransferController

**Files:**
- Modify: `app/Http/Controllers/StockTransferController.php`

**Step 1: Add trait**

```php
use App\Traits\FiltersWarehouseByUser;

class StockTransferController extends Controller
{
    use FiltersWarehouseByUser;
```

**Step 2: Filter the warehouses passed to the page**

In `index()`, find where warehouses are fetched and wrap with:
```php
$warehouseQuery = Warehouse::where('is_active', true);
$this->applyWarehouseFilter($warehouseQuery, 'id');
$warehouses = $warehouseQuery->get(['id', 'name', 'code']);
```

**Step 3: Filter transfer list**

In the transfer query, add:
```php
$ids = $this->allowedWarehouseIds();
if (!empty($ids)) {
    $query->where(function ($q) use ($ids) {
        $q->whereIn('from_warehouse_id', $ids)
          ->orWhereIn('to_warehouse_id', $ids);
    });
}
```

**Step 4: Commit**

```bash
git add app/Http/Controllers/StockTransferController.php
git commit -m "feat: apply warehouse filter to StockTransferController"
```

---

## Task 9: Apply Filter in StockAdjustmentController, PurchaseOrderController, ReturnController

**Files:**
- Modify: `app/Http/Controllers/StockAdjustmentController.php`
- Modify: `app/Http/Controllers/PurchaseOrderController.php`
- Modify: `app/Http/Controllers/ReturnController.php`

For each controller, same pattern:

**Step 1: Add trait to each**

```php
use App\Traits\FiltersWarehouseByUser;
class XyzController extends Controller
{
    use FiltersWarehouseByUser;
```

**Step 2: Filter warehouses in the page props**

Find where `Warehouse::...->get()` is called for dropdowns and wrap:
```php
$warehouseQuery = Warehouse::where('is_active', true);
$this->applyWarehouseFilter($warehouseQuery, 'id');
$warehouses = $warehouseQuery->get(['id', 'name', 'code']);
```

**Step 3: Filter record listings by warehouse**

For each controller's `index()` listing query, add:
```php
$this->applyWarehouseFilter($query, 'warehouse_id');
```

**Step 4: Commit after all three**

```bash
git add app/Http/Controllers/StockAdjustmentController.php \
        app/Http/Controllers/PurchaseOrderController.php \
        app/Http/Controllers/ReturnController.php
git commit -m "feat: apply warehouse filter to Adjustment, PO, and Return controllers"
```

---

## Task 10: Frontend — Warehouse Assignment UI in Users/Index.tsx

**Files:**
- Modify: `resources/js/pages/Users/Index.tsx`

**Purpose:** Add a "Gudang" button in the user management table that opens a dialog to assign/remove warehouse access for a user.

**Step 1: Update `PageProps` and `UserRow` interfaces**

In `Users/Index.tsx`, add to `UserRow`:
```typescript
assignedWarehouseIds: number[];
```

Add to `PageProps`:
```typescript
warehouses: { id: number; name: string; code: string }[];
```

**Step 2: Add state for warehouse dialog**

```typescript
import { Warehouse } from 'lucide-react'; // add to existing imports

const [warehouseTarget, setWarehouseTarget] = useState<UserRow | null>(null);
const [selectedWarehouses, setSelectedWarehouses] = useState<number[]>([]);
```

**Step 3: Add Gudang button in the action column (per user row)**

In the table, alongside the existing Pencil/Trash/KeyRound/ShieldCheck buttons, add:

```tsx
<TooltipProvider>
  <Tooltip>
    <TooltipTrigger asChild>
      <button
        onClick={() => {
          setWarehouseTarget(u);
          setSelectedWarehouses(u.assignedWarehouseIds);
        }}
        className="p-2 rounded hover:bg-cyan-50 text-muted-foreground hover:text-cyan-600 transition dark:hover:bg-cyan-950/30"
      >
        <Warehouse size={16} />
      </button>
    </TooltipTrigger>
    <TooltipContent>Akses Gudang</TooltipContent>
  </Tooltip>
</TooltipProvider>
```

**Step 4: Add warehouse dialog**

Add below the existing dialogs:

```tsx
<Dialog open={!!warehouseTarget} onOpenChange={v => !v && setWarehouseTarget(null)}>
  <DialogContent className="max-w-sm">
    <DialogHeader>
      <DialogTitle>Akses Gudang — {warehouseTarget?.name}</DialogTitle>
      <DialogDescription>
        Pilih gudang yang bisa diakses. Kosongkan untuk akses semua gudang.
      </DialogDescription>
    </DialogHeader>
    <div className="space-y-2 max-h-60 overflow-y-auto py-2">
      {warehouses.map(w => (
        <label key={w.id} className="flex items-center gap-3 cursor-pointer p-2 rounded hover:bg-muted">
          <input
            type="checkbox"
            checked={selectedWarehouses.includes(w.id)}
            onChange={e => {
              setSelectedWarehouses(prev =>
                e.target.checked
                  ? [...prev, w.id]
                  : prev.filter(id => id !== w.id)
              );
            }}
            className="rounded"
          />
          <span className="text-sm">
            <span className="font-medium">{w.name}</span>
            <span className="text-xs text-muted-foreground ml-2">({w.code})</span>
          </span>
        </label>
      ))}
    </div>
    {selectedWarehouses.length === 0 && (
      <p className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400 rounded px-3 py-2">
        Tidak ada gudang dipilih = akses ke semua gudang
      </p>
    )}
    <DialogFooter>
      <Button variant="outline" onClick={() => setWarehouseTarget(null)}>Batal</Button>
      <Button onClick={() => {
        if (!warehouseTarget) return;
        router.post(route('users.warehouses', warehouseTarget.id), {
          warehouse_ids: selectedWarehouses,
        }, { onSuccess: () => setWarehouseTarget(null) });
      }}>
        Simpan
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

**Step 5: Verify TypeScript**

```bash
npm run types 2>&1 | grep -i "Users/Index"
```

Expected: no errors for this file.

**Step 6: Commit**

```bash
git add resources/js/pages/Users/Index.tsx
git commit -m "feat: add warehouse assignment UI in user management page"
```

---

## Task 11: End-to-End Manual Test

**Step 1: Start the dev server**

```bash
composer run dev
```

**Step 2: Test scenario — restricted user**

1. Login as admin → go to `/users`
2. Find a staff user → click Warehouse icon → assign only 1 warehouse → Simpan
3. Logout → login as that staff user
4. Go to `/warehouses` → only assigned warehouse visible ✅
5. Try to manually type URL `/warehouses/[other_id]` → 403 error ✅
6. Go to `/pos/terminal` → warehouse selector shows only assigned warehouse ✅
7. Go to `/inventory/transfers` → only assigned warehouses in dropdown ✅

**Step 3: Test scenario — unrestricted user**

1. Login as any user with no warehouse assignments
2. `/warehouses` → all warehouses visible ✅
3. POS terminal → all warehouses in selector ✅

**Step 4: Test scenario — admin always sees all**

1. Login as admin (role='admin')
2. Even if `user_warehouses` had entries (shouldn't, but hypothetically) → all warehouses visible ✅

**Step 5: Commit final verification note**

```bash
git commit --allow-empty -m "test: verified user warehouse restriction works end-to-end"
```

---

## Summary of Files Changed

| File | Action |
|---|---|
| `database/migrations/2026_03_10_000010_create_user_warehouses_table.php` | Create |
| `app/Models/User.php` | Add `assignedWarehouses()` + `allowedWarehouseIds()` |
| `app/Traits/FiltersWarehouseByUser.php` | Create (reusable trait) |
| `app/Http/Controllers/UserController.php` | Add `updateWarehouses()` + warehouse data in index |
| `app/Http/Controllers/WarehouseController.php` | Add trait + filter |
| `app/Http/Controllers/PosController.php` | Add trait + filter |
| `app/Http/Controllers/StockTransferController.php` | Add trait + filter |
| `app/Http/Controllers/StockAdjustmentController.php` | Add trait + filter |
| `app/Http/Controllers/PurchaseOrderController.php` | Add trait + filter |
| `app/Http/Controllers/ReturnController.php` | Add trait + filter |
| `app/Http/Middleware/HandleInertiaRequests.php` | Share `allowedWarehouseIds` |
| `resources/js/types/index.d.ts` | Add `allowedWarehouseIds` to SharedData |
| `resources/js/pages/Users/Index.tsx` | Add warehouse assignment dialog |
| `routes/web.php` | Add `users.warehouses` route |
