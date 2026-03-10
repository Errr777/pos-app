# Product Tags Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Tags system to products so items can be labeled with colored tags, and promotions can target items by tag.

**Architecture:** A new `tags` table + `item_tag` pivot allows many-to-many tagging of items. The `promotions.applies_to` enum is extended with a `'tag'` value. The POS terminal's `getBestPromo()` function is updated to match promos against item tags. A Tags management page is added under the Produk sidebar submenu.

**Tech Stack:** Laravel 12, Inertia.js v2, React 19, TypeScript, Tailwind CSS v4, SQLite (via `doctrine/dbal` for column changes), shadcn/ui components.

---

## Chunk 1: Database + Models

### Task 1: Migrations — `tags` and `item_tag` tables

**Files:**
- Create: `database/migrations/2026_03_10_100000_create_tags_table.php`
- Create: `database/migrations/2026_03_10_100001_create_item_tag_table.php`
- Create: `database/migrations/2026_03_10_100002_extend_promotions_applies_to.php`

**Context:** The app uses SQLite. Laravel's `->enum()->change()` on SQLite is supported via Doctrine DBAL — run `composer require doctrine/dbal` first if not already present. Check with `composer show doctrine/dbal`.

- [ ] **Step 1: Check if doctrine/dbal is installed**

```bash
cd /Users/errr/Developer/Project/my/pos-app
composer show doctrine/dbal 2>/dev/null && echo "installed" || echo "missing"
```

If missing: `composer require doctrine/dbal`

- [ ] **Step 2: Create `tags` migration**

```php
// database/migrations/2026_03_10_100000_create_tags_table.php
<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('tags', function (Blueprint $table) {
            $table->id();
            $table->string('name', 50);
            $table->string('slug', 50)->unique();
            $table->string('color', 20)->default('#6366f1'); // hex color
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tags');
    }
};
```

- [ ] **Step 3: Create `item_tag` pivot migration**

```php
// database/migrations/2026_03_10_100001_create_item_tag_table.php
<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('item_tag', function (Blueprint $table) {
            $table->unsignedBigInteger('item_id');
            $table->unsignedBigInteger('tag_id');
            $table->primary(['item_id', 'tag_id']);
            $table->foreign('item_id')->references('id')->on('items')->onDelete('cascade');
            $table->foreign('tag_id')->references('id')->on('tags')->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('item_tag');
    }
};
```

- [ ] **Step 4: Extend `promotions.applies_to` enum**

SQLite does not support `ALTER COLUMN`. Use a raw migration to add 'tag' by recreating the CHECK constraint. The safest approach for SQLite is to drop the check and use app-level validation only (Laravel validates before insert anyway):

```php
// database/migrations/2026_03_10_100002_extend_promotions_applies_to.php
<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        // SQLite: drop the CHECK constraint on applies_to by recreating the column
        // Laravel's enum on SQLite is just VARCHAR with a CHECK — we recreate without the check
        // and rely on application-level validation (controller validates the enum values).
        DB::statement('PRAGMA foreign_keys = OFF');
        DB::statement('
            CREATE TABLE promotions_new AS SELECT * FROM promotions
        ');
        DB::statement('DROP TABLE promotions');
        DB::statement('
            CREATE TABLE promotions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name VARCHAR(100) NOT NULL,
                code VARCHAR(50) UNIQUE,
                type VARCHAR(255) NOT NULL DEFAULT \'percentage\'
                    CHECK (type IN (\'percentage\', \'fixed\')),
                value INTEGER NOT NULL,
                applies_to VARCHAR(255) NOT NULL DEFAULT \'all\'
                    CHECK (applies_to IN (\'all\', \'category\', \'item\', \'tag\')),
                applies_id INTEGER,
                min_purchase INTEGER NOT NULL DEFAULT 0,
                max_discount INTEGER NOT NULL DEFAULT 0,
                start_date DATE NOT NULL,
                end_date DATE NOT NULL,
                is_active TINYINT(1) NOT NULL DEFAULT 1,
                created_at DATETIME,
                updated_at DATETIME
            )
        ');
        DB::statement('INSERT INTO promotions SELECT * FROM promotions_new');
        DB::statement('DROP TABLE promotions_new');
        DB::statement('PRAGMA foreign_keys = ON');
    }

    public function down(): void
    {
        // Reverse: recreate with original enum (removes 'tag')
        DB::statement('PRAGMA foreign_keys = OFF');
        DB::statement('CREATE TABLE promotions_new AS SELECT * FROM promotions WHERE applies_to != \'tag\'');
        DB::statement('DROP TABLE promotions');
        DB::statement('
            CREATE TABLE promotions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name VARCHAR(100) NOT NULL,
                code VARCHAR(50) UNIQUE,
                type VARCHAR(255) NOT NULL DEFAULT \'percentage\'
                    CHECK (type IN (\'percentage\', \'fixed\')),
                value INTEGER NOT NULL,
                applies_to VARCHAR(255) NOT NULL DEFAULT \'all\'
                    CHECK (applies_to IN (\'all\', \'category\', \'item\')),
                applies_id INTEGER,
                min_purchase INTEGER NOT NULL DEFAULT 0,
                max_discount INTEGER NOT NULL DEFAULT 0,
                start_date DATE NOT NULL,
                end_date DATE NOT NULL,
                is_active TINYINT(1) NOT NULL DEFAULT 1,
                created_at DATETIME,
                updated_at DATETIME
            )
        ');
        DB::statement('INSERT INTO promotions SELECT * FROM promotions_new');
        DB::statement('DROP TABLE promotions_new');
        DB::statement('PRAGMA foreign_keys = ON');
    }
};
```

- [ ] **Step 5: Run migrations**

```bash
php artisan migrate
```

Expected: 3 new migrations applied, no errors.

- [ ] **Step 6: Commit**

```bash
git add database/migrations/
git commit -m "feat: add tags table, item_tag pivot, extend promotions applies_to"
```

---

### Task 2: Tag model + update Item and Promotion models

**Files:**
- Create: `app/Models/Tag.php`
- Modify: `app/Models/Item.php` — add `tags()` relation
- Modify: `app/Models/Promotion.php` — add `tag` to casts doc + `tag()` relation

- [ ] **Step 1: Create `Tag` model**

```php
// app/Models/Tag.php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class Tag extends Model
{
    protected $fillable = ['name', 'slug', 'color'];

    public function items()
    {
        return $this->belongsToMany(Item::class, 'item_tag');
    }

    protected static function booted(): void
    {
        static::saving(function (Tag $tag) {
            if (empty($tag->slug)) {
                $tag->slug = Str::slug($tag->name);
            }
        });
    }
}
```

- [ ] **Step 2: Add `tags()` relation to `Item` model**

In `app/Models/Item.php`, add after the `kategoriRelation()` method:

```php
public function tags()
{
    return $this->belongsToMany(Tag::class, 'item_tag');
}
```

Also add `Tag::class` to the use imports at the top (already in same namespace, no import needed).

- [ ] **Step 3: Commit**

```bash
git add app/Models/Tag.php app/Models/Item.php app/Models/Promotion.php
git commit -m "feat: Tag model, Item->tags() and Promotion->tag() relations"
```

---

## Chunk 2: Backend CRUD for Tags

### Task 3: TagController + routes

**Files:**
- Create: `app/Http/Controllers/TagController.php`
- Modify: `routes/web.php` — add tag routes

- [ ] **Step 1: Create `TagController`**

```php
// app/Http/Controllers/TagController.php
<?php

namespace App\Http\Controllers;

use App\Models\Tag;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Inertia\Inertia;

class TagController extends Controller
{
    public function index()
    {
        $tags = Tag::withCount('items')->orderBy('name')->get();

        return Inertia::render('tags/Index', [
            'tags' => $tags,
        ]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name'  => 'required|string|max:50',
            'color' => 'required|string|max:20',
        ]);

        $data['slug'] = Str::slug($data['name']);

        // ensure slug uniqueness
        $base = $data['slug'];
        $i = 1;
        while (Tag::where('slug', $data['slug'])->exists()) {
            $data['slug'] = $base . '-' . $i++;
        }

        Tag::create($data);

        return back()->with('success', 'Tag berhasil ditambahkan.');
    }

    public function update(Request $request, Tag $tag)
    {
        $data = $request->validate([
            'name'  => 'required|string|max:50',
            'color' => 'required|string|max:20',
        ]);

        $data['slug'] = Str::slug($data['name']);

        // ensure slug uniqueness (exclude self)
        $base = $data['slug'];
        $i = 1;
        while (Tag::where('slug', $data['slug'])->where('id', '!=', $tag->id)->exists()) {
            $data['slug'] = $base . '-' . $i++;
        }

        $tag->update($data);

        return back()->with('success', 'Tag berhasil diupdate.');
    }

    public function destroy(Tag $tag)
    {
        $tag->delete(); // pivot rows cascade
        return back()->with('success', 'Tag dihapus.');
    }
}
```

- [ ] **Step 2: Add routes to `routes/web.php`**

Find the promotions route block (around line 117) and add after it:

```php
// Tags
Route::get('/tags',              [TagController::class, 'index'])->name('tags.index');
Route::post('/tags',             [TagController::class, 'store'])->name('tags.store');
Route::put('/tags/{tag}',        [TagController::class, 'update'])->name('tags.update');
Route::delete('/tags/{tag}',     [TagController::class, 'destroy'])->name('tags.destroy');
```

Also add the import at the top of `routes/web.php`:
```php
use App\Http\Controllers\TagController;
```

- [ ] **Step 3: Verify routes registered**

```bash
php artisan route:list | grep tag
```

Expected: 4 routes (GET /tags, POST /tags, PUT /tags/{tag}, DELETE /tags/{tag}).

- [ ] **Step 4: Commit**

```bash
git add app/Http/Controllers/TagController.php routes/web.php
git commit -m "feat: TagController CRUD + routes"
```

---

## Chunk 3: Tags Management Frontend Page

### Task 4: Tags index page

**Files:**
- Create: `resources/js/pages/tags/Index.tsx`

**Design:** Card-based grid of tags showing color swatch + name + item count. Inline add/edit with color picker (7 preset colors + custom hex). Delete with confirmation.

**Preset colors:**
```
#6366f1 (indigo), #10b981 (emerald), #f59e0b (amber),
#ef4444 (red), #8b5cf6 (violet), #06b6d4 (cyan), #f97316 (orange)
```

- [ ] **Step 1: Create `resources/js/pages/tags/Index.tsx`**

```tsx
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import { useState } from 'react';
import { Plus, Pencil, Trash2, Tag } from 'lucide-react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Tags Produk', href: '/tags' },
];

interface TagRow {
    id: number;
    name: string;
    slug: string;
    color: string;
    items_count: number;
}

interface PageProps {
    tags: TagRow[];
    flash?: { success?: string };
    [key: string]: unknown;
}

const PRESET_COLORS = [
    '#6366f1', '#10b981', '#f59e0b',
    '#ef4444', '#8b5cf6', '#06b6d4', '#f97316',
];

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
    return (
        <div className="flex items-center gap-2 flex-wrap">
            {PRESET_COLORS.map(c => (
                <button
                    key={c}
                    type="button"
                    onClick={() => onChange(c)}
                    className={`w-6 h-6 rounded-full border-2 transition ${value === c ? 'border-foreground scale-110' : 'border-transparent'}`}
                    style={{ backgroundColor: c }}
                />
            ))}
            <input
                type="color"
                value={value}
                onChange={e => onChange(e.target.value)}
                className="w-6 h-6 rounded cursor-pointer border border-border"
                title="Custom color"
            />
        </div>
    );
}

export default function TagsIndex() {
    const { tags, flash } = usePage<PageProps>().props;

    const [showAdd, setShowAdd]   = useState(false);
    const [addName, setAddName]   = useState('');
    const [addColor, setAddColor] = useState('#6366f1');

    const [editTag, setEditTag]     = useState<TagRow | null>(null);
    const [editName, setEditName]   = useState('');
    const [editColor, setEditColor] = useState('#6366f1');

    function submitAdd() {
        if (!addName.trim()) return;
        router.post(route('tags.store'), { name: addName.trim(), color: addColor }, {
            onSuccess: () => { setShowAdd(false); setAddName(''); setAddColor('#6366f1'); },
        });
    }

    function openEdit(t: TagRow) {
        setEditTag(t);
        setEditName(t.name);
        setEditColor(t.color);
    }

    function submitEdit() {
        if (!editTag || !editName.trim()) return;
        router.put(route('tags.update', { tag: editTag.id }), { name: editName.trim(), color: editColor }, {
            onSuccess: () => setEditTag(null),
        });
    }

    function handleDelete(t: TagRow) {
        if (!confirm(`Hapus tag "${t.name}"? Tag akan dihapus dari semua produk.`)) return;
        router.delete(route('tags.destroy', { tag: t.id }));
    }

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Tags Produk" />
            <div className="p-6 space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-semibold">Tags Produk</h1>
                        <p className="text-sm text-muted-foreground">Label warna untuk mengelompokkan produk</p>
                    </div>
                    <button
                        onClick={() => setShowAdd(true)}
                        className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                    >
                        <Plus className="h-4 w-4" /> Tambah Tag
                    </button>
                </div>

                {flash?.success && (
                    <div className="rounded-md border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-800">
                        {flash.success}
                    </div>
                )}

                {/* Tags grid */}
                {tags.length === 0 ? (
                    <div className="rounded-xl border bg-muted/30 p-12 text-center space-y-3">
                        <Tag className="h-10 w-10 mx-auto text-muted-foreground/40" />
                        <p className="font-medium text-muted-foreground">Belum ada tag produk</p>
                        <p className="text-sm text-muted-foreground">Buat tag untuk mengelompokkan produk dan mengatur promo berdasarkan tag.</p>
                        <button
                            onClick={() => setShowAdd(true)}
                            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                        >
                            <Plus className="h-4 w-4" /> Buat Tag Pertama
                        </button>
                    </div>
                ) : (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {tags.map(t => (
                            <div key={t.id} className="flex items-center gap-3 rounded-lg border bg-card p-4 shadow-sm">
                                <div className="shrink-0 h-8 w-8 rounded-full" style={{ backgroundColor: t.color }} />
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium text-sm truncate">{t.name}</p>
                                    <p className="text-xs text-muted-foreground">{t.items_count} produk</p>
                                </div>
                                <div className="flex gap-1 shrink-0">
                                    <button
                                        onClick={() => openEdit(t)}
                                        className="rounded p-1.5 hover:bg-accent"
                                        title="Edit"
                                    >
                                        <Pencil className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(t)}
                                        className="rounded p-1.5 hover:bg-accent text-destructive"
                                        title="Hapus"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Add Modal */}
            {showAdd && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="w-full max-w-sm rounded-lg border bg-background p-6 shadow-lg space-y-4">
                        <h2 className="font-semibold text-lg">Tambah Tag</h2>
                        <div className="space-y-3">
                            <div>
                                <label className="text-sm font-medium">Nama Tag</label>
                                <input
                                    type="text"
                                    value={addName}
                                    onChange={e => setAddName(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && submitAdd()}
                                    placeholder="cth: Flash Sale, Promo Lebaran"
                                    className="mt-1 block w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium mb-2 block">Warna</label>
                                <ColorPicker value={addColor} onChange={setAddColor} />
                            </div>
                            <div className="flex items-center gap-2 pt-1">
                                <div className="h-6 w-6 rounded-full shrink-0" style={{ backgroundColor: addColor }} />
                                <span className="text-sm font-medium">{addName || 'Preview'}</span>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setShowAdd(false)} className="rounded-md border px-3 py-2 text-sm hover:bg-accent">Batal</button>
                            <button onClick={submitAdd} className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground hover:bg-primary/90">Simpan</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {editTag && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="w-full max-w-sm rounded-lg border bg-background p-6 shadow-lg space-y-4">
                        <h2 className="font-semibold text-lg">Edit Tag</h2>
                        <div className="space-y-3">
                            <div>
                                <label className="text-sm font-medium">Nama Tag</label>
                                <input
                                    type="text"
                                    value={editName}
                                    onChange={e => setEditName(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && submitEdit()}
                                    className="mt-1 block w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium mb-2 block">Warna</label>
                                <ColorPicker value={editColor} onChange={setEditColor} />
                            </div>
                            <div className="flex items-center gap-2 pt-1">
                                <div className="h-6 w-6 rounded-full shrink-0" style={{ backgroundColor: editColor }} />
                                <span className="text-sm font-medium">{editName}</span>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setEditTag(null)} className="rounded-md border px-3 py-2 text-sm hover:bg-accent">Batal</button>
                            <button onClick={submitEdit} className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground hover:bg-primary/90">Simpan</button>
                        </div>
                    </div>
                </div>
            )}
        </AppLayout>
    );
}
```

- [ ] **Step 2: Run TypeScript check**

```bash
npm run types 2>&1 | grep "tags/Index" || echo "No errors in tags/Index"
```

- [ ] **Step 3: Commit**

```bash
git add resources/js/pages/tags/
git commit -m "feat: Tags management page with color picker"
```

---

## Chunk 4: Item Tag Assignment

### Task 5: Add tag assignment to ItemController + Items page

**Files:**
- Modify: `app/Http/Controllers/ItemController.php` — pass tags to index, sync on store/update
- Add route: `routes/web.php` — `PATCH /item/{item}/tags`
- Modify: `resources/js/pages/Items/Index.tsx` — show tag badges, allow tag assignment

**Context:** ItemController `index()` currently paginates items with `kategoriRelation`. We need to also eager-load `tags`. The `store()` and `update()` methods need to accept `tag_ids` and sync. A separate `syncTags` action keeps the tag update isolated from the heavy item validation.

- [ ] **Step 1: Update `ItemController::index()` to eager-load tags and pass all tags**

In `ItemController.php`, find the `index()` method. Change:
```php
$itemsQuery = Item::with('kategoriRelation')
```
to:
```php
$itemsQuery = Item::with(['kategoriRelation', 'tags'])
```

Also pass `$allTags` to the Inertia render. After the paginate call, add:
```php
$allTags = \App\Models\Tag::orderBy('name')->get(['id', 'name', 'color']);
```
And in `Inertia::render(...)`, add `'tags' => $allTags`.

- [ ] **Step 2: Add `syncTags` method to `ItemController`**

Add this method to `ItemController`:
```php
public function syncTags(Request $request, Item $item)
{
    $data = $request->validate([
        'tag_ids'   => 'array',
        'tag_ids.*' => 'integer|exists:tags,id',
    ]);

    $item->tags()->sync($data['tag_ids'] ?? []);

    if ($request->wantsJson()) {
        return response()->json(['message' => 'Tags updated']);
    }

    return back()->with('success', 'Tags produk diperbarui.');
}
```

- [ ] **Step 3: Add sync route in `routes/web.php`**

After the existing item routes, add:
```php
Route::patch('/item/{item}/tags', [ItemController::class, 'syncTags'])->name('item.sync_tags');
```

- [ ] **Step 4: Update Items `Index.tsx` — show tag badges on item rows and tag assignment popover**

In `resources/js/pages/Items/Index.tsx`:

a) Add to `ItemRow` interface:
```ts
tags: { id: number; name: string; color: string }[];
```

b) Add `allTags: { id: number; name: string; color: string }[]` to `PageProps`.

c) In the item table, add a **Tags** column header after the existing columns:
```tsx
<th className="text-left px-4 py-2 font-medium text-xs">Tags</th>
```

d) In the row, show tag badges:
```tsx
<td className="px-4 py-2 max-w-[180px]">
    <div className="flex flex-wrap gap-1">
        {item.tags.map(t => (
            <span
                key={t.id}
                className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium text-white"
                style={{ backgroundColor: t.color }}
            >
                {t.name}
            </span>
        ))}
        {item.tags.length === 0 && (
            <span className="text-xs text-muted-foreground">—</span>
        )}
    </div>
</td>
```

e) Add a "Edit Tags" button in the action column that opens a small inline tag-assignment dialog (similar to existing edit/delete modals). The dialog shows all available tags as checkboxes with color swatches. On save, calls `router.patch(route('item.sync_tags', item.id), { tag_ids: selectedIds })`.

Add state:
```tsx
const [tagItem, setTagItem]       = useState<ItemRow | null>(null);
const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
```

Open handler:
```tsx
function openTagEdit(item: ItemRow) {
    setTagItem(item);
    setSelectedTagIds(item.tags.map(t => t.id));
}
```

Save handler:
```tsx
function submitTags() {
    if (!tagItem) return;
    router.patch(route('item.sync_tags', { item: tagItem.id }), { tag_ids: selectedTagIds }, {
        onSuccess: () => setTagItem(null),
    });
}
```

Tag edit modal:
```tsx
{tagItem && (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="w-full max-w-sm rounded-lg border bg-background p-6 shadow-lg space-y-4">
            <h2 className="font-semibold text-lg">Tags — {tagItem.name}</h2>
            {allTags.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                    Belum ada tag. <a href="/tags" className="text-primary hover:underline">Buat tag dulu →</a>
                </p>
            ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                    {allTags.map(t => (
                        <label key={t.id} className="flex items-center gap-3 cursor-pointer hover:bg-muted/50 rounded-md p-2">
                            <input
                                type="checkbox"
                                checked={selectedTagIds.includes(t.id)}
                                onChange={e => {
                                    setSelectedTagIds(prev =>
                                        e.target.checked ? [...prev, t.id] : prev.filter(id => id !== t.id)
                                    );
                                }}
                                className="h-4 w-4 rounded"
                            />
                            <div className="h-4 w-4 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
                            <span className="text-sm">{t.name}</span>
                        </label>
                    ))}
                </div>
            )}
            <div className="flex justify-end gap-2">
                <button onClick={() => setTagItem(null)} className="rounded-md border px-3 py-2 text-sm hover:bg-accent">Batal</button>
                <button onClick={submitTags} className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground hover:bg-primary/90">Simpan</button>
            </div>
        </div>
    </div>
)}
```

Add a tag icon button in the action column (use `Tag` icon from lucide-react, import it):
```tsx
<button onClick={() => openTagEdit(item)} title="Edit Tags" className="rounded p-1.5 hover:bg-accent text-indigo-600">
    <Tag className="h-4 w-4" />
</button>
```

- [ ] **Step 5: Run TypeScript check**

```bash
npm run types 2>&1 | grep "Items/Index\|ItemController" || echo "No new errors"
```

- [ ] **Step 6: Commit**

```bash
git add app/Http/Controllers/ItemController.php routes/web.php resources/js/pages/Items/Index.tsx
git commit -m "feat: tag assignment on items — syncTags endpoint + UI"
```

---

## Chunk 5: Promotions + POS Integration

### Task 6: Extend promotions to support `applies_to: 'tag'`

**Files:**
- Modify: `app/Http/Controllers/PromotionController.php` — accept 'tag', pass tags list
- Modify: `resources/js/pages/promotions/Index.tsx` — add 'Tag' option in form

- [ ] **Step 1: Update `PromotionController::index()` to pass tags**

In `PromotionController.php`, add:
```php
use App\Models\Tag;
```

In `index()`, after `$items = Item::orderBy...`:
```php
$tags = Tag::orderBy('name')->get(['id', 'name', 'color']);
```
Add `'tags' => $tags` to `Inertia::render()`.

- [ ] **Step 2: Update `PromotionController::store()` and `update()` validation**

Change:
```php
'applies_to' => 'required|in:all,category,item',
```
to:
```php
'applies_to' => 'required|in:all,category,item,tag',
```
(In both `store()` and `update()`.)

- [ ] **Step 3: Update `resources/js/pages/promotions/Index.tsx`**

a) Add `Tag` type to `PageProps`:
```ts
tags: { id: number; name: string; color: string }[];
```

b) Update `Promotion` interface `applies_to`:
```ts
applies_to: 'all' | 'category' | 'item' | 'tag';
```

c) In the form's "Berlaku untuk" `<select>`, add option:
```tsx
<option value="tag">Tag Produk</option>
```

d) In the `applies_id` selector section (where it shows category dropdown for `applies_to === 'category'` and item dropdown for `applies_to === 'item'`), add a tag branch:
```tsx
{data.applies_to === 'tag' && (
    <select value={data.applies_id ?? ''} onChange={e => setData('applies_id', e.target.value ? Number(e.target.value) : null)}
        className="border rounded-md px-3 py-2 text-sm bg-background w-full">
        <option value="">Pilih Tag</option>
        {tags.map(t => (
            <option key={t.id} value={t.id}>{t.name}</option>
        ))}
    </select>
)}
```

e) In the promotions list table, update the "Berlaku" column display to handle `tag`:
```tsx
{p.applies_to === 'tag' && (
    <span className="text-xs">
        Tag: {tags.find(t => t.id === p.applies_id)?.name ?? '—'}
    </span>
)}
```

- [ ] **Step 4: Run TypeScript check**

```bash
npm run types 2>&1 | grep "promotions/Index" || echo "No errors in promotions/Index"
```

- [ ] **Step 5: Commit**

```bash
git add app/Http/Controllers/PromotionController.php resources/js/pages/promotions/
git commit -m "feat: extend promotions to support applies_to=tag"
```

---

### Task 7: POS Terminal — match promos by tag

**Files:**
- Modify: `app/Http/Controllers/PosController.php` — load item tags
- Modify: `resources/js/pages/pos/Terminal.tsx` — add `tagIds` to `ItemOption`, update `getBestPromo`

- [ ] **Step 1: Update `PosController` to include tag IDs on items**

In `PosController.php`, find the `terminal()` method. Change:
```php
$items = Item::select('id', 'nama', 'kode_item', 'kategori', 'id_kategori', 'stok', 'harga_jual')
```
to:
```php
$items = Item::with('tags')->select('id', 'nama', 'kode_item', 'kategori', 'id_kategori', 'stok', 'harga_jual')
```

And in the item map, add `tagIds`:
```php
'tagIds'     => $i->tags->pluck('id')->values()->all(),
```

- [ ] **Step 2: Update `Terminal.tsx` `ItemOption` interface**

Add `tagIds: number[]` to the `ItemOption` interface.

- [ ] **Step 3: Update `Promotion` interface in `Terminal.tsx`**

Change:
```ts
appliesTo: 'all' | 'category' | 'item';
```
to:
```ts
appliesTo: 'all' | 'category' | 'item' | 'tag';
```

- [ ] **Step 4: Update `getBestPromo()` to handle `'tag'`**

Find the `getBestPromo` function in `Terminal.tsx`. After the line:
```ts
if (p.appliesTo === 'category' && p.appliesId !== item.categoryId) continue;
```
Add:
```ts
if (p.appliesTo === 'tag' && !item.tagIds.includes(p.appliesId!)) continue;
```

- [ ] **Step 5: Run TypeScript check**

```bash
npm run types 2>&1 | grep "pos/Terminal" || echo "No errors in Terminal"
```

- [ ] **Step 6: Commit**

```bash
git add app/Http/Controllers/PosController.php resources/js/pages/pos/Terminal.tsx
git commit -m "feat: POS terminal matches promos by tag"
```

---

## Chunk 6: Sidebar + Final Wiring

### Task 8: Add Tags sidebar entry + cleanup

**Files:**
- Modify: `resources/js/components/app-sidebar.tsx` — add "Tags Produk" under Produk submenu

- [ ] **Step 1: Add to sidebar Produk submenu**

In `app-sidebar.tsx`, find the Produk submenu items:
```ts
{ title: 'Daftar Produk',   href: '/item/' },
{ title: 'Tambah Produk',   href: '/tambah_item' },
{ title: 'Kategori Produk', href: '/category/' },
{ title: 'Stok Minimum',    href: '/stock_alerts' },
```

Add after "Kategori Produk":
```ts
{ title: 'Tags Produk',     href: '/tags' },
```

- [ ] **Step 2: TypeScript check and final verification**

```bash
npm run types 2>&1 | tail -5
```

Expected: same pre-existing errors as before (toast.tsx, Categories.tsx, Stock_alerts.tsx, Users/Index.tsx). No new errors.

- [ ] **Step 3: Final commit**

```bash
git add resources/js/components/app-sidebar.tsx
git commit -m "feat: add Tags Produk to sidebar Produk submenu"
```

---

## Verification Checklist

After all tasks:

1. `/tags` — can create, edit, delete tags with color picker
2. `/item/` — tag badges visible on item rows; tag button opens assignment modal
3. `/promotions` — form has "Tag Produk" option; selecting it shows tag dropdown
4. POS terminal `/pos/terminal` — create a promo with `applies_to=tag`, assign tag to an item, confirm discount auto-applies in cart
5. Sidebar "Produk" submenu shows "Tags Produk" link
