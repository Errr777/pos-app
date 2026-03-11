<?php

namespace App\Http\Controllers;

use App\Models\Item;
use App\Models\Kategori;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Illuminate\Support\Facades\Validator;


class ItemController extends Controller
{
    public function index(Request $request)
    {
        $perPage = (int) $request->get('per_page', 10);
        $search  = $request->get('search');

        // Sorting: accept client keys but map to DB column names (whitelist for safety)
        // Client keys we expect: name | stock | category | kode | created_at (fallback)
        $clientToDb = [
            'name'     => 'nama',
            'stock'    => 'stok',
            'category' => 'kategori',
            'kode'     => 'kode_item',
            'created'  => 'created_at',
        ];

        // read client-provided sort key and direction
        $requestedSort = $request->get('sort_by', null);
        $requestedDir  = strtolower($request->get('sort_dir', 'desc')) === 'asc' ? 'asc' : 'desc';

        // determine DB column to sort by; if not provided or unknown, fall back to created_at
        $sortColumn = 'created_at';
        if ($requestedSort) {
            // allow either client keys or direct DB columns (if caller already sends DB column)
            if (isset($clientToDb[$requestedSort])) {
                $sortColumn = $clientToDb[$requestedSort];
            } elseif (in_array($requestedSort, $clientToDb, true)) {
                // allowed: request already used DB column name
                $sortColumn = $requestedSort;
            }
        }

        $tagId = $request->get('tag_id') ? (int) $request->get('tag_id') : null;

        $itemsQuery = Item::with(['kategoriRelation', 'tags'])
            ->when($search, function ($q, $search) {
                $q->where('nama', 'like', "%{$search}%")
                ->orWhere('kode_item', 'like', "%{$search}%");
            })
            ->when($tagId, function ($q) use ($tagId) {
                $q->whereHas('tags', fn($tq) => $tq->where('tags.id', $tagId));
            })
            ->orderBy($sortColumn, $requestedDir);

        $items = $itemsQuery
            ->paginate($perPage)
            ->withQueryString()
            ->through(function ($i) {
                return [
                    'id'           => $i->id,
                    'name'         => $i->nama,
                    'description'  => $i->deskripsi,
                    'qrcode'       => $i->kode_item,
                    'stock'        => $i->stok,
                    'stock_min'    => $i->stok_minimal,
                    'harga_beli'   => $i->harga_beli,
                    'harga_jual'   => $i->harga_jual,
                    'category'     => $i->kategori,
                    'id_kategori'  => $i->id_kategori,
                    'kategori_rel' => $i->kategoriRelation
                        ? [
                            'id'   => $i->kategoriRelation->id,
                            'nama' => $i->kategoriRelation->nama,
                        ]
                        : null,
                    'tags'         => $i->tags->map(fn($t) => [
                        'id'    => $t->id,
                        'name'  => $t->name,
                        'color' => $t->color,
                    ])->values()->all(),
                ];
            });

        $kategoris = Kategori::all()->map(function ($k) {
            return [
                'id'        => $k->id,
                'nama'      => $k->nama,
                'deskripsi' => $k->deskripsi ?? null,
            ];
        });

        $allTags = \App\Models\Tag::orderBy('name')->get(['id', 'name', 'color']);

        // Return filters including sort_by & sort_dir so frontend can initialize
        return Inertia::render('Items/Index', [
            'items'      => $items,
            'filters'    => $request->only(['search', 'per_page', 'tag_id']) + [
                'sort_by'  => $requestedSort,
                'sort_dir' => $requestedDir,
            ],
            'kategoris'  => $kategoris,
            'allTags'    => $allTags,
        ]);
    }

    public function show(Item $item)
    {
        $item->load('kategoriRelation');

        return Inertia::render('Items/Show', [
            'item' => $item->toArray(),
        ]);
    }

    public function create()
    {
        // Get all categories for the dropdown
        
        $kategoris = Kategori::select('id', 'nama', 'deskripsi')->orderBy('nama')->get();

        return Inertia::render('Items/Add_Items', [
            'kategoris' => $kategoris,
        ]);
    }

    public function store(Request $request)
    {
        // ✅ Validate the input
        $validated = $request->validate([
            'nama'         => 'required|string|max:255',
            'deskripsi'    => 'nullable|string|max:1000',
            'kode_item'    => 'required|string|max:255|unique:items,kode_item',
            'stok'         => 'required|numeric|min:0',
            'stok_minimal' => 'required|numeric|min:0',
            'harga_beli'   => 'nullable|integer|min:0',
            'harga_jual'   => 'nullable|integer|min:0',
            'kategori'     => 'nullable|string|max:255',
            'id_kategori'  => 'nullable|exists:kategoris,id',
        ]);

        // ✅ Set kategori (normalize category name if linked by ID)
        if (empty($validated['kategori']) && !empty($validated['id_kategori'])) {
            $kategori = Kategori::find($validated['id_kategori']);
            $validated['kategori'] = $kategori?->nama;
        }

        // ✅ Save to DB
        $item = Item::create([
            'nama'         => $validated['nama'],
            'deskripsi'    => $validated['deskripsi'] ?? null,
            'kode_item'    => $validated['kode_item'],
            'stok'         => $validated['stok'],
            'stok_minimal' => $validated['stok_minimal'],
            'harga_beli'   => (int) ($validated['harga_beli'] ?? 0),
            'harga_jual'   => (int) ($validated['harga_jual'] ?? 0),
            'kategori'     => $validated['kategori'] ?? null,
            'id_kategori'  => $validated['id_kategori'] ?? null,
        ]);

        // ✅ Redirect with Inertia flash message
        return redirect()
            ->route('item.tambah')
            ->with('success', "Item '{$item->nama}' berhasil ditambahkan.");
    }

    /**
     * Update an item — persist id_kategori and kategori (name).
     */
    public function update(Request $request, Item $item)
    {
        // Accept both id_kategori (preferred) or category (fallback)
        $data = $request->only([
            'name',        // UI -> nama
            'description', // -> deskripsi
            'qrcode',      // -> kode_item
            'stock',       // -> stok
            'stock_min',   // -> stok_minimal
            'harga_beli',
            'harga_jual',
            'id_kategori',
            'category',
        ]);

        // Normalize for validation
        $payloadForValidation = [
            'nama'         => $data['name'] ?? $item->nama,
            'deskripsi'    => $data['description'] ?? $item->deskripsi,
            'kode_item'    => $data['qrcode'] ?? $item->kode_item,
            'stok'         => isset($data['stock']) ? (int) $data['stock'] : $item->stok,
            'stok_minimal' => isset($data['stock_min']) ? (int) $data['stock_min'] : $item->stok_minimal,
            'harga_beli'   => isset($data['harga_beli']) ? (int) $data['harga_beli'] : $item->harga_beli,
            'harga_jual'   => isset($data['harga_jual']) ? (int) $data['harga_jual'] : $item->harga_jual,
            'id_kategori'  => isset($data['id_kategori']) && $data['id_kategori'] !== '' ? (int) $data['id_kategori'] : null,
        ];

        $validator = Validator::make($payloadForValidation, [
            'nama'         => 'required|string|max:100',
            'deskripsi'    => 'nullable|string|max:1000',
            'kode_item'    => 'required|string|max:100|unique:items,kode_item,' . $item->id,
            'stok'         => 'required|integer|min:0',
            'stok_minimal' => 'required|integer|min:0',
            'harga_beli'   => 'nullable|integer|min:0',
            'harga_jual'   => 'nullable|integer|min:0',
            'id_kategori'  => 'nullable|integer|exists:kategoris,id',
        ]);

        if ($validator->fails()) {
            if ($request->wantsJson()) {
                return response()->json(['errors' => $validator->errors()], 422);
            }
            return back()->withErrors($validator)->withInput();
        }

        // Resolve kategori name from id_kategori if provided
        $kategoriName = null;
        if (!empty($payloadForValidation['id_kategori'])) {
            $kategori = Kategori::find($payloadForValidation['id_kategori']);
            if ($kategori) {
                $kategoriName = $kategori->nama ?? ($kategori->nama_kategori ?? null);
            }
        }

        // If id_kategori not provided but client sent category name, use it
        if (empty($payloadForValidation['id_kategori']) && !empty($data['category'])) {
            $kategoriName = $data['category'];
        }

        $updatePayload = [
            'nama'         => $payloadForValidation['nama'],
            'deskripsi'    => $payloadForValidation['deskripsi'],
            'kode_item'    => $payloadForValidation['kode_item'],
            'stok'         => $payloadForValidation['stok'],
            'stok_minimal' => $payloadForValidation['stok_minimal'],
            'harga_beli'   => $payloadForValidation['harga_beli'],
            'harga_jual'   => $payloadForValidation['harga_jual'],
            'id_kategori'  => $payloadForValidation['id_kategori'] ?? null,
            'kategori'     => $kategoriName,
        ];

        $item->update($updatePayload);

        // Return JSON for XHR or Inertia-friendly response
        if ($request->wantsJson()) {
            return response()->json([
                'message' => 'Item updated',
                'item' => [
                    'id'          => $item->id,
                    'name'        => $item->nama,
                    'description' => $item->deskripsi,
                    'qrcode'      => $item->kode_item,
                    'stock'       => $item->stok,
                    'stock_min'   => $item->stok_minimal,
                    'harga_beli'  => $item->harga_beli,
                    'harga_jual'  => $item->harga_jual,
                    'id_kategori' => $item->id_kategori,
                    'kategori'    => $item->kategori,
                ],
            ], 200);
        }

        return redirect()->back()->with('success', 'Item updated successfully');
    }

    public function lowStock(Request $request)
{
    // Normalize inputs
    $search   = trim((string) $request->get('search', ''));
    $perPage  = (int) $request->get('per_page', 10);
    $page     = (int) $request->get('page', 1);

    // Sorting params from UI (e.g. 'name', 'stock', 'minimumStock', 'category', 'description')
    $sortByRaw = $request->get('sort_by', null);
    $sortDirRaw = strtolower($request->get('sort_dir', 'asc')) === 'desc' ? 'desc' : 'asc';

    // Map client column keys to actual DB columns
    $allowedSortMap = [
        'name' => 'nama',
        'description' => 'deskripsi',
        'stock' => 'stok',
        'minimumStock' => 'stok_minimal',
        'category' => 'kategori',
        // fallback to DB column names if frontend sends them already
        'nama' => 'nama',
        'deskripsi' => 'deskripsi',
        'stok' => 'stok',
        'stok_minimal' => 'stok_minimal',
        'kategori' => 'kategori',
    ];

    // Determine DB column to sort by; default to 'stok' ascending
    $sortColumn = $allowedSortMap[$sortByRaw] ?? null;
    if (! $sortColumn) {
        // if no valid sort supplied, use default
        $sortColumn = 'stok';
        $sortDirRaw = 'asc';
    }

    // Base query: items where stok < stok_minimal
    $query = Item::query()
        ->with('kategoriRelation')
        ->whereColumn('stok', '<', 'stok_minimal');

    // Search
    if ($search !== '') {
        $query->where(function ($q) use ($search) {
            $q->where('nama', 'like', "%{$search}%")
              ->orWhere('deskripsi', 'like', "%{$search}%")
              ->orWhere('kode_item', 'like', "%{$search}%")
              ->orWhere('kategori', 'like', "%{$search}%");
        });
    }

    // Apply sort (safe because we mapped allowed columns)
    $query->orderBy($sortColumn, $sortDirRaw);

    // Paginate and normalize items for front-end
    $items = $query
        ->paginate($perPage)
        ->withQueryString()
        ->through(fn($item) => [
            'id'            => $item->id,
            'name'          => $item->nama,
            'description'   => $item->deskripsi,
            'qrcode'        => $item->kode_item,
            'stock'         => $item->stok,
            'minimumStock'  => $item->stok_minimal,
            'category'      => $item->kategori,
            'id_kategori'   => $item->id_kategori,
            'kategori_rel'  => $item->kategoriRelation ? [
                'id' => $item->kategoriRelation->id,
                'nama' => $item->kategoriRelation->nama ?? $item->kategoriRelation->nama_kategori ?? null,
            ] : null,
        ]);

    // Pass filters back so the UI can keep state (search, per_page, sort_by, sort_dir)
    return Inertia::render('Items/Stock_alerts', [
        'items' => $items,
        'filters' => $request->only(['search', 'per_page', 'page', 'sort_by', 'sort_dir']),
    ]);
}

    public function destroy(Item $item)
    {
        $item->delete();

        // Return JSON for axios calls if requested
        if (request()->wantsJson()) {
            return response()->json(['message' => 'Item deleted'], 200);
        }

        return redirect()->back()->with('success', 'Item deleted');
    }

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

    public function printLabels(Request $request)
    {
        $ids = array_filter(array_map('intval', explode(',', $request->get('ids', ''))));

        if (empty($ids)) {
            return redirect()->route('item.index')->with('error', 'Pilih item terlebih dahulu.');
        }

        $ids = array_slice($ids, 0, 100);

        $items = Item::whereIn('id', $ids)
            ->orderBy('nama')
            ->get()
            ->map(fn($i) => [
                'id'       => $i->id,
                'name'     => $i->nama,
                'code'     => $i->kode_item,
                'price'    => $i->harga_jual,
                'category' => $i->kategori,
            ])
            ->values()
            ->all();

        return Inertia::render('Items/PrintLabels', [
            'items' => $items,
        ]);
    }
}