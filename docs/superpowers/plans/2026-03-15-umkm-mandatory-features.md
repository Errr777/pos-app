# UMKM Mandatory Features Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement three mandatory features for UMKM SaaS readiness: (1) App Settings with custom store branding, (2) Onboarding Wizard for first-time setup, and (3) Automated daily database backup with admin UI.

**Architecture:** A single `app_settings` key-value table powers both the store branding and the onboarding completion flag. The onboarding wizard is a protected multi-step page gated by a middleware that redirects unauthenticated-setup admins. Backup runs as a scheduled Laravel console command, storing files in `storage/backups/`, with an admin UI to list/download/trigger.

**Tech Stack:** Laravel 12 (Eloquent, Console Commands, Scheduler, Storage), Inertia.js v2, React 19, TypeScript, Tailwind CSS v4, shadcn/ui components.

---

## Chunk 1: App Settings — Store Branding

### Files (Chunk 1)
- **Create:** `database/migrations/2026_03_15_000001_create_app_settings_table.php`
- **Create:** `app/Models/AppSetting.php`
- **Create:** `app/Http/Controllers/AppSettingController.php`
- **Modify:** `app/Http/Middleware/HandleInertiaRequests.php` — share `storeSetting` globally
- **Modify:** `routes/web.php` — add settings routes
- **Create:** `resources/js/pages/settings/store.tsx` — admin settings form
- **Modify:** `resources/js/pages/pos/Show.tsx` — use store name/address in receipt header
- **Modify:** `resources/js/pages/dashboard.tsx` — show store name as page sub-title (see Task 7b)

---

### Task 1: Migration — `app_settings` table

**Files:**
- Create: `database/migrations/2026_03_15_000001_create_app_settings_table.php`

- [ ] **Step 1: Create migration**

```php
<?php
// database/migrations/2026_03_15_000001_create_app_settings_table.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('app_settings', function (Blueprint $table) {
            $table->string('key')->primary();
            $table->text('value')->nullable();
            $table->timestamps();
        });

        // Default values
        DB::table('app_settings')->insert([
            ['key' => 'store_name',       'value' => 'Toko Saya',      'created_at' => now(), 'updated_at' => now()],
            ['key' => 'store_address',    'value' => null,             'created_at' => now(), 'updated_at' => now()],
            ['key' => 'store_phone',      'value' => null,             'created_at' => now(), 'updated_at' => now()],
            ['key' => 'store_logo',       'value' => null,             'created_at' => now(), 'updated_at' => now()],
            ['key' => 'receipt_footer',   'value' => 'Terima kasih!',  'created_at' => now(), 'updated_at' => now()],
            ['key' => 'onboarding_done',  'value' => '0',              'created_at' => now(), 'updated_at' => now()],
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('app_settings');
    }
};
```

- [ ] **Step 2: Run migration**

```bash
cd /Users/errr/Developer/Project/my/pos-app
php artisan migrate
```

Expected: `app_settings` table created with 6 default rows.

- [ ] **Step 3: Commit**

```bash
git add database/migrations/2026_03_15_000001_create_app_settings_table.php
git commit -m "feat: create app_settings table with default store branding keys"
```

---

### Task 2: AppSetting Model

**Files:**
- Create: `app/Models/AppSetting.php`

- [ ] **Step 1: Create model**

```php
<?php
// app/Models/AppSetting.php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Cache;

class AppSetting extends Model
{
    protected $primaryKey = 'key';
    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = ['key', 'value'];

    /** Get a setting value, with optional fallback. */
    public static function get(string $key, mixed $default = null): mixed
    {
        return Cache::remember("app_setting:{$key}", 3600, function () use ($key, $default) {
            $row = static::find($key);
            return $row ? $row->value : $default;
        });
    }

    /** Set a setting value and clear its cache (individual key + bulk). */
    public static function set(string $key, mixed $value): void
    {
        static::updateOrCreate(['key' => $key], ['value' => $value]);
        Cache::forget("app_setting:{$key}");
        Cache::forget('app_settings_all');
    }

    /** Return all settings as an associative array (cached for 1 hour). */
    public static function allAsArray(): array
    {
        return Cache::remember('app_settings_all', 3600, function () {
            return static::all()->pluck('value', 'key')->toArray();
        });
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/Models/AppSetting.php
git commit -m "feat: add AppSetting model with get/set/cache helpers"
```

---

### Task 3: AppSettingController

**Files:**
- Create: `app/Http/Controllers/AppSettingController.php`

- [ ] **Step 1: Create controller**

```php
<?php
// app/Http/Controllers/AppSettingController.php

namespace App\Http\Controllers;

use App\Models\AppSetting;
use Illuminate\Http\Request;
use Inertia\Inertia;

class AppSettingController extends Controller
{
    public function edit(): \Inertia\Response
    {
        abort_unless(auth()->user()->role === 'admin', 403);

        return Inertia::render('settings/store', [
            'settings' => AppSetting::allAsArray(),
        ]);
    }

    public function update(Request $request): \Illuminate\Http\RedirectResponse
    {
        abort_unless(auth()->user()->role === 'admin', 403);

        $validated = $request->validate([
            'store_name'     => ['required', 'string', 'max:100'],
            'store_address'  => ['nullable', 'string', 'max:255'],
            'store_phone'    => ['nullable', 'string', 'max:30'],
            'receipt_footer' => ['nullable', 'string', 'max:255'],
            'store_logo'     => ['nullable', 'image', 'max:2048'],
        ]);

        // Handle logo upload
        if ($request->hasFile('store_logo')) {
            $path = $request->file('store_logo')->store('logos', 'public');
            AppSetting::set('store_logo', $path);
        }

        foreach (['store_name', 'store_address', 'store_phone', 'receipt_footer'] as $key) {
            if (array_key_exists($key, $validated)) {
                AppSetting::set($key, $validated[$key]);
            }
        }

        return back()->with('success', 'Pengaturan toko berhasil disimpan.');
    }
}
```

- [ ] **Step 2: Add routes to `routes/web.php`**

Open `routes/web.php` and add inside the `auth + verified` group (after the audit log routes):

```php
// App Settings (admin only)
Route::get('/settings/store', [AppSettingController::class, 'edit'])->name('settings.store');
Route::post('/settings/store', [AppSettingController::class, 'update'])->name('settings.store.update');
```

Also add the import at the top:
```php
use App\Http\Controllers\AppSettingController;
```

- [ ] **Step 3: Commit**

```bash
git add app/Http/Controllers/AppSettingController.php routes/web.php
git commit -m "feat: add AppSettingController and store settings routes"
```

---

### Task 4: Share store settings globally via Inertia

**Files:**
- Modify: `app/Http/Middleware/HandleInertiaRequests.php`

- [ ] **Step 1: Add `storeSettings` to the `share()` method**

In `HandleInertiaRequests.php`, add the import and a new entry to the `share()` return array:

```php
use App\Models\AppSetting;
```

Inside `share()`, add after the `'flash'` entry:

```php
'storeSettings' => fn () => AppSetting::allAsArray(),
```

- [ ] **Step 2: Update TypeScript types**

In `resources/js/types/index.d.ts`, add `storeSettings` to the `SharedData` interface (or wherever global props are typed). Add:

```typescript
storeSettings: {
  store_name: string;
  store_address: string | null;
  store_phone: string | null;
  store_logo: string | null;
  receipt_footer: string | null;
  onboarding_done: string;
};
```

- [ ] **Step 3: Commit**

```bash
git add app/Http/Middleware/HandleInertiaRequests.php resources/js/types/index.d.ts
git commit -m "feat: share storeSettings globally via Inertia middleware"
```

---

### Task 5: Settings page — Store branding form

**Files:**
- Create: `resources/js/pages/settings/store.tsx`

- [ ] **Step 1: Create the settings page**

```tsx
// resources/js/pages/settings/store.tsx
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, useForm, usePage } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FormEventHandler, useRef } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
  { title: 'Dashboard', href: '/dashboard' },
  { title: 'Pengaturan Toko', href: '#' },
];

interface PageProps {
  settings: {
    store_name: string;
    store_address: string | null;
    store_phone: string | null;
    store_logo: string | null;
    receipt_footer: string | null;
  };
  [key: string]: unknown;
}

export default function StoreSettings() {
  const { settings } = usePage<PageProps>().props;
  const logoRef = useRef<HTMLInputElement>(null);

  const { data, setData, post, processing, errors } = useForm({
    store_name: settings.store_name ?? '',
    store_address: settings.store_address ?? '',
    store_phone: settings.store_phone ?? '',
    receipt_footer: settings.receipt_footer ?? '',
    store_logo: null as File | null,
  });

  const submit: FormEventHandler = (e) => {
    e.preventDefault();
    post(route('settings.store.update'), {
      forceFormData: true,
    });
  };

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title="Pengaturan Toko" />
      <div className="p-4 md:p-6 max-w-xl mx-auto">
        <h1 className="text-xl font-semibold mb-6">Pengaturan Toko</h1>
        <form onSubmit={submit} className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="store_name">Nama Toko <span className="text-destructive">*</span></Label>
            <Input
              id="store_name"
              value={data.store_name}
              onChange={e => setData('store_name', e.target.value)}
            />
            {errors.store_name && <p className="text-sm text-destructive">{errors.store_name}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="store_address">Alamat</Label>
            <Textarea
              id="store_address"
              rows={2}
              value={data.store_address}
              onChange={e => setData('store_address', e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="store_phone">Nomor Telepon</Label>
            <Input
              id="store_phone"
              value={data.store_phone}
              onChange={e => setData('store_phone', e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="receipt_footer">Footer Struk</Label>
            <Input
              id="receipt_footer"
              value={data.receipt_footer}
              onChange={e => setData('receipt_footer', e.target.value)}
              placeholder="Terima kasih!"
            />
            <p className="text-xs text-muted-foreground">Teks yang muncul di bawah struk penjualan.</p>
          </div>

          <div className="space-y-1.5">
            <Label>Logo Toko</Label>
            {settings.store_logo && (
              <img
                src={`/storage/${settings.store_logo}`}
                alt="Logo toko"
                className="h-16 w-auto rounded border mb-2"
              />
            )}
            <input
              ref={logoRef}
              type="file"
              accept="image/*"
              className="text-sm"
              onChange={e => setData('store_logo', e.target.files?.[0] ?? null)}
            />
            {errors.store_logo && <p className="text-sm text-destructive">{errors.store_logo}</p>}
          </div>

          <Button type="submit" disabled={processing}>
            {processing ? 'Menyimpan...' : 'Simpan Pengaturan'}
          </Button>
        </form>
      </div>
    </AppLayout>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add resources/js/pages/settings/store.tsx
git commit -m "feat: add store settings page for admin"
```

---

### Task 6: Use store settings in the receipt (pos/Show.tsx)

**Files:**
- Modify: `resources/js/pages/pos/Show.tsx`

- [ ] **Step 1: Update receipt header to show store branding**

> **Note:** `storeSettings` is a globally shared prop injected by `HandleInertiaRequests` — it does **not** need to be passed by the controller's `Inertia::render()` call. Just add it to the component's `PageProps` interface so TypeScript knows about it.

In `pos/Show.tsx`, add import for `usePage` (already imported), then read `storeSettings`:

```tsx
// Add at top of PosShow component:
const { sale, warehouseCity, warehousePhone, storeSettings } = usePage<PageProps>().props;
```

Update the receipt header section (around line 95-101) to prepend the store name, address, and logo:

```tsx
{/* Receipt card - Header */}
<div className="text-center space-y-1">
  {storeSettings?.store_logo && (
    <img
      src={`/storage/${storeSettings.store_logo}`}
      alt="Logo"
      className="h-12 w-auto mx-auto mb-1"
    />
  )}
  <div className="font-bold text-base">{storeSettings?.store_name ?? 'Toko'}</div>
  {storeSettings?.store_address && (
    <div className="text-xs text-muted-foreground">{storeSettings.store_address}</div>
  )}
  {storeSettings?.store_phone && (
    <div className="text-xs text-muted-foreground">{storeSettings.store_phone}</div>
  )}
  <div className="border-t my-2" />
  <div className="font-mono text-lg font-bold">{sale.saleNumber}</div>
  <div className="text-sm text-muted-foreground">{formatDate(sale.date)}</div>
  {sale.status === 'void' && (
    <span className="inline-flex px-3 py-1 rounded-full text-xs font-medium bg-rose-100 text-rose-700">VOID</span>
  )}
</div>
```

Also add receipt footer before the closing `</div>` of the receipt card:

```tsx
{storeSettings?.receipt_footer && (
  <div className="text-center text-xs text-muted-foreground border-t pt-3">
    {storeSettings.receipt_footer}
  </div>
)}
```

Update `PageProps` interface to include `storeSettings`:
```tsx
interface PageProps {
  sale: SaleDetail;
  warehouseCity: string | null;
  warehousePhone: string | null;
  storeSettings: {
    store_name: string;
    store_address: string | null;
    store_phone: string | null;
    store_logo: string | null;
    receipt_footer: string | null;
  };
  [key: string]: unknown;
}
```

- [ ] **Step 2: Commit**

```bash
git add resources/js/pages/pos/Show.tsx
git commit -m "feat: show store name, logo, address, and footer on receipt"
```

---

### Task 7: Add Pengaturan Toko link to sidebar

**Files:**
- Modify: `resources/js/components/app-sidebar.tsx`

- [ ] **Step 1: Open the sidebar file and find where nav items are defined**

```bash
grep -n "href\|title\|icon" /Users/errr/Developer/Project/my/pos-app/resources/js/components/app-sidebar.tsx | head -30
```

Identify the nav array or the section where menu items are built (look for existing hrefs like `/dashboard`, `/item`, etc.).

- [ ] **Step 2: Add admin-only menu items**

Import the icons at the top of `app-sidebar.tsx` (add to existing lucide-react import):
```tsx
import { ..., Settings2, Database } from 'lucide-react';
```

Inside the nav items config, add conditional entries for admin (adapt placement to match existing pattern):

```tsx
// Only show to admin — add near the bottom of the nav list
...(auth.user.role === 'admin' ? [
  {
    title: 'Pengaturan Toko',
    href: '/settings/store',
    icon: Settings2,
  },
  {
    title: 'Backup Database',
    href: '/settings/backups',
    icon: Database,
  },
] : []),
```

Also ensure `auth` is available from `usePage().props.auth` in the sidebar component.

- [ ] **Step 3: Commit**

```bash
git add resources/js/components/app-sidebar.tsx
git commit -m "feat: add Pengaturan Toko and Backup Database menu items for admin"
```

---

### Task 7b: Show store name on dashboard

**Files:**
- Modify: `resources/js/pages/dashboard.tsx`

- [ ] **Step 1: Read `storeSettings` and display store name below the page title**

In `resources/js/pages/dashboard.tsx`, find where the page heading or breadcrumb area is rendered. Add the store name as a subtitle. Since `storeSettings` is a global shared prop:

```tsx
// At the top of the Dashboard component, add:
const { storeSettings } = usePage<SharedData>().props;

// Then in JSX, somewhere near the page title (h1 or breadcrumb area):
{storeSettings?.store_name && storeSettings.store_name !== 'Toko Saya' && (
  <p className="text-sm text-muted-foreground">{storeSettings.store_name}</p>
)}
```

> **Note:** Only show if the admin has customized the name away from the default 'Toko Saya'. Adapt placement to match the existing dashboard layout.

- [ ] **Step 2: Commit**

```bash
git add resources/js/pages/dashboard.tsx
git commit -m "feat: show custom store name on dashboard header"
```

---

## Chunk 2: Onboarding Wizard

### Files (Chunk 2)
- **Create:** `app/Http/Middleware/EnsureOnboardingComplete.php`
- **Modify:** `bootstrap/app.php` — register middleware alias
- **Modify:** `routes/web.php` — add onboarding route + wrap dashboard in middleware
- **Create:** `app/Http/Controllers/OnboardingController.php`
- **Create:** `resources/js/pages/onboarding/Index.tsx`

---

### Task 8: Onboarding Middleware

**Files:**
- Create: `app/Http/Middleware/EnsureOnboardingComplete.php`

- [ ] **Step 1: Create middleware**

```php
<?php
// app/Http/Middleware/EnsureOnboardingComplete.php

namespace App\Http\Middleware;

use App\Models\AppSetting;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureOnboardingComplete
{
    public function handle(Request $request, Closure $next): Response
    {
        // Only check for authenticated admins
        $user = $request->user();
        if (!$user || $user->role !== 'admin') {
            return $next($request);
        }

        // Skip if already on onboarding page
        if ($request->routeIs('onboarding.*')) {
            return $next($request);
        }

        // Redirect to onboarding if not done
        if (AppSetting::get('onboarding_done', '0') !== '1') {
            return redirect()->route('onboarding.index');
        }

        return $next($request);
    }
}
```

- [ ] **Step 2: Register middleware alias in `bootstrap/app.php`**

The current `withMiddleware` block in `bootstrap/app.php` looks like this:

```php
->withMiddleware(function (Middleware $middleware) {
    $middleware->encryptCookies(except: ['appearance', 'sidebar_state']);

    $middleware->web(append: [
        HandleAppearance::class,
        HandleInertiaRequests::class,
        AddLinkHeadersForPreloadedAssets::class,
    ]);
})
```

Add `$middleware->alias([...])` **inside** the same callback (not outside):

```php
->withMiddleware(function (Middleware $middleware) {
    $middleware->encryptCookies(except: ['appearance', 'sidebar_state']);

    $middleware->web(append: [
        HandleAppearance::class,
        HandleInertiaRequests::class,
        AddLinkHeadersForPreloadedAssets::class,
    ]);

    $middleware->alias([
        'onboarding' => \App\Http\Middleware\EnsureOnboardingComplete::class,
    ]);
})
```

- [ ] **Step 3: Apply middleware to the auth group in `routes/web.php`**

Change the route group from:
```php
Route::middleware(['auth', 'verified'])->group(function () {
```
to:
```php
Route::middleware(['auth', 'verified', 'onboarding'])->group(function () {
```

Then add a separate onboarding route **outside** this group (but still auth-protected):
```php
Route::middleware(['auth', 'verified'])->prefix('onboarding')->name('onboarding.')->group(function () {
    Route::get('/', [OnboardingController::class, 'index'])->name('index');
    Route::post('/', [OnboardingController::class, 'store'])->name('store');
});
```

Also add import:
```php
use App\Http\Controllers\OnboardingController;
```

- [ ] **Step 4: Commit**

```bash
git add app/Http/Middleware/EnsureOnboardingComplete.php bootstrap/app.php routes/web.php
git commit -m "feat: add onboarding middleware that redirects admin to setup wizard"
```

---

### Task 9: OnboardingController

**Files:**
- Create: `app/Http/Controllers/OnboardingController.php`

- [ ] **Step 1: Create controller**

```php
<?php
// app/Http/Controllers/OnboardingController.php

namespace App\Http\Controllers;

use App\Models\AppSetting;
use App\Models\Warehouse;
use Illuminate\Http\Request;
use Inertia\Inertia;

class OnboardingController extends Controller
{
    public function index(): \Inertia\Response
    {
        abort_unless(auth()->user()->role === 'admin', 403);

        return Inertia::render('onboarding/Index', [
            'settings' => AppSetting::allAsArray(),
        ]);
    }

    public function store(Request $request): \Illuminate\Http\RedirectResponse
    {
        abort_unless(auth()->user()->role === 'admin', 403);

        $validated = $request->validate([
            'store_name'      => ['required', 'string', 'max:100'],
            'store_address'   => ['nullable', 'string', 'max:255'],
            'store_phone'     => ['nullable', 'string', 'max:30'],
            'receipt_footer'  => ['nullable', 'string', 'max:255'],
            'store_logo'      => ['nullable', 'image', 'max:2048'],
            'outlet_name'     => ['required', 'string', 'max:100'],
            'outlet_city'     => ['nullable', 'string', 'max:100'],
            'outlet_phone'    => ['nullable', 'string', 'max:30'],
        ]);

        // Save store settings
        AppSetting::set('store_name', $validated['store_name']);
        AppSetting::set('store_address', $validated['store_address'] ?? '');
        AppSetting::set('store_phone', $validated['store_phone'] ?? '');
        AppSetting::set('receipt_footer', $validated['receipt_footer'] ?? 'Terima kasih!');

        if ($request->hasFile('store_logo')) {
            $path = $request->file('store_logo')->store('logos', 'public');
            AppSetting::set('store_logo', $path);
        }

        // Create or update default outlet (warehouse)
        $existing = Warehouse::where('is_default', true)->first();
        $outletData = [
            'name'       => $validated['outlet_name'],
            'city'       => $validated['outlet_city'] ?? null,
            'phone'      => $validated['outlet_phone'] ?? null,
            'is_active'  => true,
            'is_default' => true,
        ];

        if ($existing) {
            $existing->update($outletData);
        } else {
            Warehouse::create(array_merge($outletData, [
                'code'    => 'MAIN',
                'address' => $validated['store_address'] ?? null,
            ]));
        }

        // Mark onboarding as done
        AppSetting::set('onboarding_done', '1');

        return redirect()->route('dashboard')->with('success', 'Selamat datang! Toko Anda sudah siap.');
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/Http/Controllers/OnboardingController.php
git commit -m "feat: add OnboardingController that saves settings and creates first outlet"
```

---

### Task 10: Onboarding wizard page (React)

**Files:**
- Create: `resources/js/pages/onboarding/Index.tsx`

- [ ] **Step 1: Create multi-step wizard page**

```tsx
// resources/js/pages/onboarding/Index.tsx
import { Head, useForm } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FormEventHandler, useState } from 'react';
import { Store, MapPin, CheckCircle2 } from 'lucide-react';

const STEPS = [
  { id: 1, label: 'Info Toko',   icon: Store },
  { id: 2, label: 'Outlet',      icon: MapPin },
  { id: 3, label: 'Selesai',     icon: CheckCircle2 },
];

export default function OnboardingIndex() {
  const [step, setStep] = useState(1);
  const [stepError, setStepError] = useState('');

  const { data, setData, post, processing, errors } = useForm({
    store_name: '',
    store_address: '',
    store_phone: '',
    receipt_footer: 'Terima kasih!',
    store_logo: null as File | null,
    outlet_name: '',
    outlet_city: '',
    outlet_phone: '',
  });

  const submit: FormEventHandler = (e) => {
    e.preventDefault();
    post(route('onboarding.store'), { forceFormData: true });
  };

  return (
    <div className="min-h-screen bg-muted/40 flex items-center justify-center p-4">
      <Head title="Setup Toko" />
      <div className="bg-background rounded-2xl shadow-lg w-full max-w-lg p-8">
        {/* Step indicator */}
        <div className="flex items-center justify-center gap-3 mb-8">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const active = step === s.id;
            const done = step > s.id;
            return (
              <div key={s.id} className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold
                  ${done ? 'bg-primary text-primary-foreground' : active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                  {done ? <CheckCircle2 size={16} /> : <Icon size={16} />}
                </div>
                <span className={`text-sm ${active ? 'font-semibold' : 'text-muted-foreground'}`}>{s.label}</span>
                {i < STEPS.length - 1 && <div className="w-8 h-px bg-border" />}
              </div>
            );
          })}
        </div>

        <form onSubmit={submit}>
          {/* Step 1: Store info */}
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Informasi Toko</h2>
              <p className="text-sm text-muted-foreground">Masukkan detail toko Anda yang akan tampil di struk dan dashboard.</p>

              <div className="space-y-1.5">
                <Label htmlFor="store_name">Nama Toko <span className="text-destructive">*</span></Label>
                <Input
                  id="store_name"
                  value={data.store_name}
                  onChange={e => setData('store_name', e.target.value)}
                  placeholder="Contoh: Toko Maju Jaya"
                />
                {errors.store_name && <p className="text-sm text-destructive">{errors.store_name}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="store_address">Alamat</Label>
                <Textarea
                  id="store_address"
                  rows={2}
                  value={data.store_address}
                  onChange={e => setData('store_address', e.target.value)}
                  placeholder="Jl. Contoh No. 1, Jakarta"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="store_phone">Nomor Telepon</Label>
                <Input
                  id="store_phone"
                  value={data.store_phone}
                  onChange={e => setData('store_phone', e.target.value)}
                  placeholder="0812-3456-7890"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="receipt_footer">Footer Struk</Label>
                <Input
                  id="receipt_footer"
                  value={data.receipt_footer}
                  onChange={e => setData('receipt_footer', e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Logo Toko (opsional)</Label>
                <input
                  type="file"
                  accept="image/*"
                  className="text-sm"
                  onChange={e => setData('store_logo', e.target.files?.[0] ?? null)}
                />
              </div>

              {stepError && <p className="text-sm text-destructive">{stepError}</p>}
              <Button
                type="button"
                className="w-full"
                onClick={() => {
                  if (!data.store_name.trim()) {
                    setStepError('Nama toko wajib diisi.');
                    return;
                  }
                  setStepError('');
                  setStep(2);
                }}
              >
                Lanjut →
              </Button>
            </div>
          )}

          {/* Step 2: First outlet */}
          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Outlet Pertama</h2>
              <p className="text-sm text-muted-foreground">Setup outlet / gudang utama Anda.</p>

              <div className="space-y-1.5">
                <Label htmlFor="outlet_name">Nama Outlet <span className="text-destructive">*</span></Label>
                <Input
                  id="outlet_name"
                  value={data.outlet_name}
                  onChange={e => setData('outlet_name', e.target.value)}
                  placeholder="Contoh: Outlet Pusat"
                />
                {errors.outlet_name && <p className="text-sm text-destructive">{errors.outlet_name}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="outlet_city">Kota</Label>
                <Input
                  id="outlet_city"
                  value={data.outlet_city}
                  onChange={e => setData('outlet_city', e.target.value)}
                  placeholder="Jakarta"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="outlet_phone">Telepon Outlet</Label>
                <Input
                  id="outlet_phone"
                  value={data.outlet_phone}
                  onChange={e => setData('outlet_phone', e.target.value)}
                  placeholder="021-123-4567"
                />
              </div>

              {stepError && <p className="text-sm text-destructive">{stepError}</p>}
              <div className="flex gap-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => { setStepError(''); setStep(1); }}>
                  ← Kembali
                </Button>
                <Button
                  type="button"
                  className="flex-1"
                  onClick={() => {
                    if (!data.outlet_name.trim()) {
                      setStepError('Nama outlet wajib diisi.');
                      return;
                    }
                    setStepError('');
                    setStep(3);
                  }}
                >
                  Lanjut →
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Confirm */}
          {step === 3 && (
            <div className="space-y-4 text-center">
              <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <CheckCircle2 size={36} className="text-primary" />
              </div>
              <h2 className="text-xl font-semibold">Siap untuk memulai!</h2>
              <div className="text-sm text-muted-foreground space-y-1 text-left bg-muted/40 rounded-lg p-4">
                <p><span className="font-medium">Nama Toko:</span> {data.store_name}</p>
                {data.store_address && <p><span className="font-medium">Alamat:</span> {data.store_address}</p>}
                <p><span className="font-medium">Outlet:</span> {data.outlet_name}</p>
                {data.outlet_city && <p><span className="font-medium">Kota:</span> {data.outlet_city}</p>}
              </div>

              <div className="flex gap-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setStep(2)}>
                  ← Kembali
                </Button>
                <Button type="submit" className="flex-1" disabled={processing}>
                  {processing ? 'Menyimpan...' : 'Mulai Gunakan POS →'}
                </Button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add resources/js/pages/onboarding/Index.tsx
git commit -m "feat: add 3-step onboarding wizard (store info, outlet, confirm)"
```

---

### Task 11: Test onboarding flow manually

- [ ] **Step 1: Reset onboarding flag**

```bash
cd /Users/errr/Developer/Project/my/pos-app
php artisan tinker --execute="App\Models\AppSetting::set('onboarding_done', '0');"
```

- [ ] **Step 2: Start dev server and verify redirect**

```bash
composer run dev
```

Visit `http://localhost` → login as admin → should redirect to `/onboarding`.
Complete the wizard → should land on dashboard with success flash.
Visit `/onboarding` again → should redirect to dashboard (already done).

- [ ] **Step 3: Verify store name on receipt**

Create a test sale via POS → view the receipt → confirm store name, address, footer appear.

---

## Chunk 3: Backup Otomatis

### Files (Chunk 3)
- **Create:** `app/Console/Commands/BackupDatabase.php`
- **Modify:** `routes/console.php` — register daily schedule
- **Create:** `app/Http/Controllers/BackupController.php`
- **Modify:** `routes/web.php` — add backup routes
- **Create:** `resources/js/pages/settings/backups.tsx`

---

### Task 12: BackupDatabase Console Command

**Files:**
- Create: `app/Console/Commands/BackupDatabase.php`

- [ ] **Step 1: Create command**

```php
<?php
// app/Console/Commands/BackupDatabase.php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class BackupDatabase extends Command
{
    protected $signature = 'backup:database {--keep=7 : Number of daily backups to retain}';
    protected $description = 'Backup the database to storage/backups/';

    public function handle(): int
    {
        $driver = config('database.default');
        $disk   = Storage::disk('local');
        $date   = now()->format('Y-m-d_H-i-s');

        $this->info("Running database backup ({$driver})...");

        if ($driver === 'sqlite') {
            $dbPath = config('database.connections.sqlite.database');
            if (!file_exists($dbPath)) {
                $this->error("SQLite file not found: {$dbPath}");
                return self::FAILURE;
            }
            $filename = "backups/db-{$date}.sqlite";
            $disk->put($filename, file_get_contents($dbPath));
        } elseif ($driver === 'mysql') {
            $filename = "backups/db-{$date}.sql";
            $host     = config('database.connections.mysql.host');
            $port     = config('database.connections.mysql.port');
            $database = config('database.connections.mysql.database');
            $username = config('database.connections.mysql.username');
            $password = config('database.connections.mysql.password');

            $tmpFile = storage_path("app/{$filename}");
            @mkdir(dirname($tmpFile), 0755, true);

            // Use --defaults-extra-file to avoid exposing password in process list (ps aux).
            $cnfFile = tempnam(sys_get_temp_dir(), 'mysql_cnf_');
            // Wrap password in double-quotes per MySQL option-file spec; escape any inner double-quotes
$escapedPw = str_replace('"', '\\"', $password);
file_put_contents($cnfFile, "[client]\npassword=\"{$escapedPw}\"\n");
            chmod($cnfFile, 0600);

            $cmd = sprintf(
                'mysqldump --defaults-extra-file=%s --host=%s --port=%s --user=%s %s > %s 2>&1',
                escapeshellarg($cnfFile),
                escapeshellarg($host),
                escapeshellarg($port),
                escapeshellarg($username),
                escapeshellarg($database),
                escapeshellarg($tmpFile),
            );
            exec($cmd, $output, $exitCode);
            @unlink($cnfFile); // Clean up temp credentials file

            if ($exitCode !== 0) {
                $this->error("mysqldump failed: " . implode("\n", $output));
                return self::FAILURE;
            }
        } else {
            $this->error("Unsupported DB driver: {$driver}. Only sqlite and mysql are supported.");
            return self::FAILURE;
        }

        $this->info("Backup saved: {$filename}");

        // Prune old backups
        $keep = (int) $this->option('keep');
        $this->pruneOldBackups($disk, $keep);

        return self::SUCCESS;
    }

    private function pruneOldBackups($disk, int $keep): void
    {
        $files = collect($disk->files('backups'))
            ->filter(fn ($f) => str_starts_with(basename($f), 'db-'))
            ->sortDesc()
            ->values();

        $toDelete = $files->slice($keep);
        foreach ($toDelete as $file) {
            $disk->delete($file);
            $this->line("Pruned old backup: {$file}");
        }
    }
}
```

- [ ] **Step 2: Test the command**

```bash
php artisan backup:database
```

Expected: `Backup saved: backups/db-YYYY-MM-DD_HH-II-SS.sqlite` (or .sql).
Check file exists:
```bash
ls -lh storage/app/backups/
```

- [ ] **Step 3: Commit**

```bash
git add app/Console/Commands/BackupDatabase.php
git commit -m "feat: add backup:database artisan command with pruning"
```

---

### Task 13: Schedule daily backup

**Files:**
- Modify: `routes/console.php`

- [ ] **Step 1: Add schedule to `routes/console.php`**

```php
// routes/console.php
use Illuminate\Support\Facades\Schedule;

Schedule::command('backup:database --keep=7')
    ->dailyAt('02:00')
    ->appendOutputTo(storage_path('logs/backup.log'));
```

- [ ] **Step 2: Verify schedule is registered**

```bash
php artisan schedule:list
```

Expected: Shows `backup:database` running daily at 02:00.

- [ ] **Step 3: Commit**

```bash
git add routes/console.php
git commit -m "feat: schedule daily database backup at 02:00"
```

---

### Task 14: BackupController (list, download, trigger)

**Files:**
- Create: `app/Http/Controllers/BackupController.php`

- [ ] **Step 1: Create controller**

```php
<?php
// app/Http/Controllers/BackupController.php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;

class BackupController extends Controller
{
    public function index(): \Inertia\Response
    {
        abort_unless(auth()->user()->role === 'admin', 403);

        $disk  = Storage::disk('local');
        $files = collect($disk->files('backups'))
            ->filter(fn ($f) => str_starts_with(basename($f), 'db-'))
            ->sortByDesc(fn ($f) => $disk->lastModified($f))
            ->map(fn ($f) => [
                'filename'  => basename($f),
                'size'      => $disk->size($f),
                'createdAt' => date('Y-m-d H:i:s', $disk->lastModified($f)),
            ])
            ->values()
            ->toArray();

        return Inertia::render('settings/backups', [
            'backups' => $files,
        ]);
    }

    public function download(string $filename): \Symfony\Component\HttpFoundation\StreamedResponse
    {
        abort_unless(auth()->user()->role === 'admin', 403);

        // Sanitize: only allow filenames that match expected pattern
        if (!preg_match('/^db-[\d_-]+\.(sqlite|sql)$/', $filename)) {
            abort(404);
        }

        $path = "backups/{$filename}";
        abort_unless(Storage::disk('local')->exists($path), 404);

        return Storage::disk('local')->download($path, $filename);
    }

    public function run(): \Illuminate\Http\RedirectResponse
    {
        abort_unless(auth()->user()->role === 'admin', 403);

        \Artisan::call('backup:database');
        return back()->with('success', 'Backup berhasil dibuat.');
    }
}
```

- [ ] **Step 2: Add routes to `routes/web.php`**

Inside auth+verified group:
```php
// Backup (admin only)
Route::get('/settings/backups', [BackupController::class, 'index'])->name('backups.index');
Route::get('/settings/backups/download/{filename}', [BackupController::class, 'download'])->name('backups.download');
Route::post('/settings/backups/run', [BackupController::class, 'run'])->name('backups.run');
```

Also add import:
```php
use App\Http\Controllers\BackupController;
```

- [ ] **Step 3: Commit**

```bash
git add app/Http/Controllers/BackupController.php routes/web.php
git commit -m "feat: add BackupController for list/download/trigger backups"
```

---

### Task 15: Backup management page (React)

**Files:**
- Create: `resources/js/pages/settings/backups.tsx`

- [ ] **Step 1: Create backup page**

```tsx
// resources/js/pages/settings/backups.tsx
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Download, RefreshCw, Database } from 'lucide-react';

const breadcrumbs: BreadcrumbItem[] = [
  { title: 'Dashboard', href: '/dashboard' },
  { title: 'Backup Database', href: '#' },
];

interface Backup {
  filename: string;
  size: number;
  createdAt: string;
}

interface PageProps {
  backups: Backup[];
  [key: string]: unknown;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export default function BackupsPage() {
  const { backups } = usePage<PageProps>().props;

  const handleRunBackup = () => {
    if (!confirm('Buat backup sekarang?')) return;
    router.post(route('backups.run'));
  };

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title="Backup Database" />
      <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Backup Database</h1>
          <Button onClick={handleRunBackup} size="sm">
            <RefreshCw size={15} className="mr-1.5" />
            Backup Sekarang
          </Button>
        </div>

        <p className="text-sm text-muted-foreground">
          Backup otomatis berjalan setiap hari pukul 02:00. 7 backup terakhir disimpan.
        </p>

        {backups.length === 0 ? (
          <div className="border rounded-lg p-8 text-center text-muted-foreground">
            <Database size={40} className="mx-auto mb-3 opacity-30" />
            <p>Belum ada backup. Klik "Backup Sekarang" untuk membuat backup pertama.</p>
          </div>
        ) : (
          <div className="border rounded-lg divide-y">
            {backups.map(b => (
              <div key={b.filename} className="flex items-center justify-between px-4 py-3">
                <div>
                  <div className="text-sm font-mono font-medium">{b.filename}</div>
                  <div className="text-xs text-muted-foreground">{b.createdAt} · {formatSize(b.size)}</div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                >
                  <a href={route('backups.download', { filename: b.filename })}>
                    <Download size={14} className="mr-1.5" />
                    Unduh
                  </a>
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
```

- [ ] **Step 2: Commit** (sidebar links were already added in Task 7)

```bash
git add resources/js/pages/settings/backups.tsx
git commit -m "feat: add backup management page with list, download, and manual trigger"
```

---

### Task 16: End-to-end verification

- [ ] **Step 1: Run all migrations fresh with seeding**

```bash
php artisan migrate:fresh --seed
```

Expected: No errors. `app_settings` table seeded with defaults.

- [ ] **Step 2: Verify onboarding wizard appears on first admin login**

Start the server and visit `/dashboard` as admin → should redirect to `/onboarding`.
Complete all 3 steps → should see success message on dashboard.

- [ ] **Step 3: Verify store settings page**

Visit `/settings/store` as admin → update store name → visit receipt → confirm name appears.

- [ ] **Step 4: Run backup manually and verify**

```bash
php artisan backup:database
ls -lh storage/app/backups/
```

Visit `/settings/backups` as admin → confirm backup file listed → click Unduh → file downloads.

- [ ] **Step 5: Verify non-admin users are not affected**

Login as `staff` or `kasir` → onboarding should NOT redirect → `/settings/store` should 403.

- [ ] **Step 6: Run TypeScript check**

```bash
npm run types
```

Expected: No TypeScript errors.

- [ ] **Step 7: Final commit**

```bash
git add .
git commit -m "feat: complete UMKM mandatory features (onboarding, store settings, backup)"
```

---

## Summary of All Changes

| Feature | Files Created | Files Modified |
|---|---|---|
| App Settings | `AppSetting.php`, migration, `AppSettingController.php`, `settings/store.tsx` | `HandleInertiaRequests.php`, `routes/web.php`, `pos/Show.tsx`, `types/index.d.ts`, sidebar |
| Onboarding Wizard | `EnsureOnboardingComplete.php`, `OnboardingController.php`, `onboarding/Index.tsx` | `bootstrap/app.php`, `routes/web.php` |
| Backup Otomatis | `BackupDatabase.php`, `BackupController.php`, `settings/backups.tsx` | `routes/console.php`, `routes/web.php`, sidebar |

**Total new files:** 9 | **Total modified files:** 6

## Deployment Notes

After deploying to production:
1. Run `php artisan migrate` — creates `app_settings` table
2. First admin login triggers onboarding wizard
3. Backup runs automatically at 02:00 daily (ensure scheduler is active via cron or supervisord)
4. For Docker: the supervisord config already runs `php artisan schedule:run` — verify or add it if missing
