<?php

namespace App\Http\Controllers;

use App\Helpers\AuditLogger;
use App\Models\Item;
use App\Models\Kategori;
use App\Models\SaleItem;
use App\Models\Supplier;
use App\Models\Warehouse;
use App\Models\WarehouseItem;
use App\Traits\FiltersWarehouseByUser;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;


class ItemController extends Controller
{
    use FiltersWarehouseByUser;

    public function __construct()
    {
        $this->middleware(function ($request, $next) {
            $user = $request->user();
            if (!$user) return redirect()->route('login');

            $method = $request->method();
            $action = match(true) {
                $method === 'DELETE'                         => 'can_delete',
                in_array($method, ['POST', 'PUT', 'PATCH']) => 'can_write',
                default                                      => 'can_view',
            };

            if (!$user->hasPermission('items', $action)) {
                return $request->wantsJson()
                    ? response()->json(['error' => 'Forbidden'], 403)
                    : abort(403);
            }

            return $next($request);
        });
    }

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

        $tagId      = $request->get('tag_id') ? (int) $request->get('tag_id') : null;
        $typeFilter = in_array($request->get('type'), ['barang', 'jasa']) ? $request->get('type') : null;

        $itemsQuery = Item::with(['kategoriRelation', 'tags', 'preferredSupplier'])
            ->when($search, function ($q, $search) {
                $q->where('nama', 'like', "%{$search}%")
                ->orWhere('kode_item', 'like', "%{$search}%");
            })
            ->when($tagId, function ($q) use ($tagId) {
                $q->whereHas('tags', fn($tq) => $tq->where('tags.id', $tagId));
            })
            ->when($typeFilter, fn($q) => $q->where('type', $typeFilter))
            ->orderBy($sortColumn, $requestedDir);

        $items = $itemsQuery
            ->paginate($perPage)
            ->withQueryString()
            ->through(function ($i) {
                return [
                    'id'           => hid($i->id),
                    'name'         => $i->nama,
                    'description'  => $i->deskripsi,
                    'qrcode'       => $i->kode_item,
                    'stock'        => $i->stok,
                    'stock_min'    => $i->stok_minimal,
                    'harga_beli'   => $i->harga_beli,
                    'harga_jual'   => $i->harga_jual,
                    'category'     => $i->kategori,
                    'id_kategori'  => hid($i->id_kategori),
                    'kategori_rel' => $i->kategoriRelation
                        ? [
                            'id'   => hid($i->kategoriRelation->id),
                            'nama' => $i->kategoriRelation->nama,
                        ]
                        : null,
                    'tags'                   => $i->tags->map(fn($t) => [
                        'id'    => hid($t->id),
                        'name'  => $t->name,
                        'color' => $t->color,
                    ])->values()->all(),
                    'type'                   => $i->type ?? 'barang',
                    'image_url'              => $i->image_path ? Storage::url($i->image_path) : null,
                    'preferred_supplier_id'  => hid($i->preferred_supplier_id),
                    'preferred_supplier_name'=> $i->preferredSupplier?->name,
                ];
            });

        $kategoris = Kategori::all()->map(function ($k) {
            return [
                'id'        => hid($k->id),
                'nama'      => $k->nama,
                'deskripsi' => $k->deskripsi ?? null,
            ];
        });

        $allTags = \App\Models\Tag::orderBy('name')->get()
            ->map(fn ($t) => ['id' => hid($t->id), 'name' => $t->name, 'color' => $t->color])->values();
        $allSuppliers = Supplier::orderBy('name')->get()
            ->map(fn ($s) => ['id' => hid($s->id), 'name' => $s->name])->values();

        // Return filters including sort_by & sort_dir so frontend can initialize
        return Inertia::render('Items/Index', [
            'items'        => $items,
            'filters'      => $request->only(['search', 'per_page', 'tag_id', 'type']) + [
                'sort_by'  => $requestedSort,
                'sort_dir' => $requestedDir,
            ],
            'kategoris'    => $kategoris,
            'allTags'      => $allTags,
            'allSuppliers' => $allSuppliers,
        ]);
    }

    public function show(Item $item)
    {
        $item->load(['kategoriRelation', 'tags', 'preferredSupplier']);
        $allowedIds = $this->allowedWarehouseIds();

        // Stock by outlet
        $stockByOutletQuery = WarehouseItem::where('item_id', $item->id)
            ->join('warehouses', 'warehouses.id', '=', 'warehouse_items.warehouse_id')
            ->where('warehouses.is_active', true)
            ->when(!empty($allowedIds), fn($q) => $q->whereIn('warehouse_items.warehouse_id', $allowedIds))
            ->select('warehouses.id as warehouse_id', 'warehouses.name as outlet_name', 'warehouse_items.stok', 'warehouse_items.stok_minimal')
            ->orderBy('warehouses.name')
            ->get()
            ->map(fn($r) => [
                'warehouseId' => hid((int) $r->warehouse_id),
                'outletName'  => $r->outlet_name,
                'stock'       => (int) $r->stok,
                'stockMin'    => (int) $r->stok_minimal,
            ])->all();

        // Recent sales (last 10)
        $recentSales = SaleItem::where('item_id', $item->id)
            ->whereHas('saleHeader', fn($q) => $q->where('status', 'completed')
                ->when(!empty($allowedIds), fn($q2) => $q2->whereIn('warehouse_id', $allowedIds))
            )
            ->with('saleHeader:id,sale_number,occurred_at')
            ->orderByDesc('id')
            ->limit(10)
            ->get()
            ->map(fn($si) => [
                'saleNumber' => $si->saleHeader?->sale_number,
                'occurredAt' => $si->saleHeader?->occurred_at?->format('d/m/Y H:i'),
                'quantity'   => (int) $si->quantity,
                'unitPrice'  => (int) $si->unit_price,
                'lineTotal'  => (int) $si->line_total,
            ])->all();

        return Inertia::render('Items/Show', [
            'item' => [
                'id'          => hid($item->id),
                'type'        => $item->type ?? 'barang',
                'name'        => $item->nama,
                'description' => $item->deskripsi,
                'imageUrl'    => $item->image_path ? Storage::url($item->image_path) : null,
                'qrcode'      => $item->kode_item,
                'stock'       => $item->stok,
                'stockMin'    => $item->stok_minimal,
                'hargaJual'   => $item->harga_jual,
                'hargaBeli'   => $item->harga_beli,
                'category'    => $item->kategori,
                'tags'                    => $item->tags->map(fn($t) => ['id' => hid($t->id), 'name' => $t->name, 'color' => $t->color])->all(),
                'preferredSupplierId'     => hid($item->preferred_supplier_id),
                'preferredSupplierName'   => $item->preferredSupplier?->name,
            ],
            'stockByOutlet' => $stockByOutletQuery,
            'recentSales'   => $recentSales,
            'canWrite'      => request()->user()?->hasPermission('items', 'can_write') ?? false,
        ]);
    }

    public function create()
    {
        // Get all categories for the dropdown
        
        $kategoris = Kategori::select('id', 'nama', 'deskripsi')->orderBy('nama')->get()
            ->map(fn($k) => ['id' => hid($k->id), 'nama' => $k->nama, 'deskripsi' => $k->deskripsi]);

        return Inertia::render('Items/Add_Items', [
            'kategoris' => $kategoris,
        ]);
    }

    public function store(Request $request)
    {
        // ✅ Validate the input
        $isJasa = $request->input('type') === 'jasa';

        // Decode hash IDs to integers before validation
        $request->merge([
            'id_kategori' => $request->id_kategori ? dhid($request->id_kategori) : null,
        ]);

        $validated = $request->validate([
            'type'         => 'nullable|in:barang,jasa',
            'nama'         => 'required|string|max:255',
            'deskripsi'    => 'nullable|string|max:1000',
            'image'        => 'nullable|image|mimes:jpeg,png,jpg,webp|max:2048',
            'kode_item'    => 'required|string|max:255|unique:items,kode_item',
            'stok'         => $isJasa ? 'nullable|numeric|min:0' : 'required|numeric|min:0',
            'stok_minimal' => $isJasa ? 'nullable|numeric|min:0' : 'required|numeric|min:0',
            'harga_beli'   => 'required|integer|min:1',
            'harga_jual'   => 'required|integer|min:1',
            'kategori'     => 'nullable|string|max:255',
            'id_kategori'  => 'nullable|exists:kategoris,id',
        ]);

        // ✅ Set kategori (normalize category name if linked by ID)
        if (empty($validated['kategori']) && !empty($validated['id_kategori'])) {
            $kategori = Kategori::find($validated['id_kategori']);
            $validated['kategori'] = $kategori?->nama;
        }

        // Handle image upload
        $imagePath = null;
        if ($request->hasFile('image')) {
            $imagePath = $request->file('image')->store('items', 'public');
        }

        // ✅ Save to DB
        $item = Item::create([
            'type'         => $validated['type'] ?? 'barang',
            'nama'         => $validated['nama'],
            'deskripsi'    => $validated['deskripsi'] ?? null,
            'image_path'   => $imagePath,
            'kode_item'    => $validated['kode_item'],
            'stok'         => $isJasa ? 0 : ($validated['stok'] ?? 0),
            'stok_minimal' => $isJasa ? 0 : ($validated['stok_minimal'] ?? 0),
            'harga_beli'   => (int) ($validated['harga_beli'] ?? 0),
            'harga_jual'   => (int) ($validated['harga_jual'] ?? 0),
            'kategori'     => $validated['kategori'] ?? null,
            'id_kategori'  => $validated['id_kategori'] ?? null,
        ]);

        // Sync stok awal ke semua gudang aktif (default warehouse dapat stok penuh, lainnya 0)
        if (! $isJasa) {
            $defaultWarehouse = Warehouse::where('is_default', true)->where('is_active', true)->first();
            $allWarehouses    = Warehouse::where('is_active', true)->get();

            foreach ($allWarehouses as $wh) {
                WarehouseItem::create([
                    'item_id'      => $item->id,
                    'warehouse_id' => $wh->id,
                    'stok'         => $wh->is_default ? ($validated['stok'] ?? 0) : 0,
                    'stok_minimal' => $wh->is_default ? ($validated['stok_minimal'] ?? 0) : 0,
                ]);
            }
        }

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
            'type',
            'name',        // UI -> nama
            'description', // -> deskripsi
            'qrcode',      // -> kode_item
            'stock',       // -> stok
            'stock_min',   // -> stok_minimal
            'harga_beli',
            'harga_jual',
            'id_kategori',
            'category',
            'preferred_supplier_id',
        ]);

        // Handle image upload for update
        $imageValidation = Validator::make($request->all(), [
            'image'        => 'nullable|image|mimes:jpeg,png,jpg,webp|max:2048',
            'delete_image' => 'nullable|boolean',
        ]);
        if ($imageValidation->fails()) {
            return $request->wantsJson()
                ? response()->json(['errors' => $imageValidation->errors()], 422)
                : back()->withErrors($imageValidation)->withInput();
        }

        // Normalize for validation
        $payloadForValidation = [
            'nama'         => $data['name'] ?? $item->nama,
            'deskripsi'    => $data['description'] ?? $item->deskripsi,
            'kode_item'    => $data['qrcode'] ?? $item->kode_item,
            'stok'         => isset($data['stock']) ? (int) $data['stock'] : $item->stok,
            'stok_minimal' => isset($data['stock_min']) ? (int) $data['stock_min'] : $item->stok_minimal,
            'harga_beli'   => isset($data['harga_beli']) ? (int) $data['harga_beli'] : $item->harga_beli,
            'harga_jual'   => isset($data['harga_jual']) ? (int) $data['harga_jual'] : $item->harga_jual,
            'id_kategori'           => isset($data['id_kategori']) && $data['id_kategori'] !== '' ? dhid($data['id_kategori']) : null,
            'preferred_supplier_id' => isset($data['preferred_supplier_id']) && $data['preferred_supplier_id'] !== '' ? dhid($data['preferred_supplier_id']) : null,
        ];

        $newType = isset($data['type']) && in_array($data['type'], ['barang', 'jasa']) ? $data['type'] : ($item->type ?? 'barang');
        $isJasaUpdate = $newType === 'jasa';

        $validator = Validator::make($payloadForValidation, [
            'nama'         => 'required|string|max:100',
            'deskripsi'    => 'nullable|string|max:1000',
            'kode_item'    => 'required|string|max:100|unique:items,kode_item,' . $item->id,
            'stok'         => $isJasaUpdate ? 'nullable|integer|min:0' : 'required|integer|min:0',
            'stok_minimal' => $isJasaUpdate ? 'nullable|integer|min:0' : 'required|integer|min:0',
            'harga_beli'   => 'required|integer|min:1',
            'harga_jual'   => 'required|integer|min:1',
            'id_kategori'           => 'nullable|integer|exists:kategoris,id',
            'preferred_supplier_id' => 'nullable|integer|exists:suppliers,id',
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
            'type'                  => $newType,
            'nama'                  => $payloadForValidation['nama'],
            'deskripsi'             => $payloadForValidation['deskripsi'],
            'kode_item'             => $payloadForValidation['kode_item'],
            'stok'                  => $payloadForValidation['stok'],
            'stok_minimal'          => $payloadForValidation['stok_minimal'],
            'harga_beli'            => $payloadForValidation['harga_beli'],
            'harga_jual'            => $payloadForValidation['harga_jual'],
            'id_kategori'           => $payloadForValidation['id_kategori'] ?? null,
            'kategori'              => $kategoriName,
            'preferred_supplier_id' => $payloadForValidation['preferred_supplier_id'] ?? null,
        ];

        // Handle image upload / deletion
        if ($request->hasFile('image')) {
            if ($item->image_path) {
                Storage::disk('public')->delete($item->image_path);
            }
            $updatePayload['image_path'] = $request->file('image')->store('items', 'public');
        } elseif ($request->boolean('delete_image') && $item->image_path) {
            Storage::disk('public')->delete($item->image_path);
            $updatePayload['image_path'] = null;
        }

        $oldHargaJual = $item->harga_jual;
        $oldHargaBeli = $item->harga_beli;

        $item->update($updatePayload);

        if ($oldHargaJual !== $item->harga_jual) {
            AuditLogger::log('item.sell_price_changed', $item,
                ['harga_jual' => $oldHargaJual],
                ['harga_jual' => $item->harga_jual]
            );
        }

        if ($oldHargaBeli !== $item->harga_beli) {
            AuditLogger::log('item.buy_price_changed', $item,
                ['harga_beli' => $oldHargaBeli],
                ['harga_beli' => $item->harga_beli]
            );
        }

        // Return JSON for XHR or Inertia-friendly response
        if ($request->wantsJson()) {
            return response()->json([
                'message' => 'Item updated',
                'item' => [
                    'id'          => hid($item->id),
                    'name'        => $item->nama,
                    'description' => $item->deskripsi,
                    'qrcode'      => $item->kode_item,
                    'stock'       => $item->stok,
                    'stock_min'   => $item->stok_minimal,
                    'harga_beli'  => $item->harga_beli,
                    'harga_jual'  => $item->harga_jual,
                    'id_kategori' => hid($item->id_kategori),
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

    // Base query: items where stok < stok_minimal (exclude jasa — services have no stock)
    $query = Item::query()
        ->with('kategoriRelation')
        ->where('type', 'barang')
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
            'id'            => hid($item->id),
            'name'          => $item->nama,
            'description'   => $item->deskripsi,
            'qrcode'        => $item->kode_item,
            'image'         => $item->image_path ? asset('storage/' . $item->image_path) : null,
            'stock'         => $item->stok,
            'minimumStock'  => $item->stok_minimal,
            'category'      => $item->kategori,
            'id_kategori'   => hid($item->id_kategori),
            'kategori_rel'  => $item->kategoriRelation ? [
                'id' => hid($item->kategoriRelation->id),
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
        $transactionBlockers = [];
        $operationalBlockers = [];

        // Item pernah masuk transaksi penjualan / pembelian / retur
        if ($item->saleItems()->exists()) {
            $transactionBlockers[] = 'penjualan';
        }
        if ($item->purchaseOrderItems()->exists()) {
            $transactionBlockers[] = 'pembelian';
        }
        if ($item->returnItems()->exists()) {
            $transactionBlockers[] = 'retur';
        }

        // Item terkait operasional gudang
        if ($item->deliveryOrderItems()->exists()) {
            $operationalBlockers[] = 'surat jalan';
        }
        if ($item->stockTransfers()->exists()) {
            $operationalBlockers[] = 'transfer stok';
        }

        if (!empty($transactionBlockers)) {
            $list = implode(', ', $transactionBlockers);
            $msg = "Item \"{$item->nama}\" tidak dapat dihapus karena sudah pernah digunakan dalam transaksi {$list}. "
                 . 'Data transaksi historis harus tetap terjaga. Nonaktifkan item jika tidak ingin ditampilkan.';
            if (request()->wantsJson()) {
                return response()->json(['error' => $msg], 422);
            }
            return redirect()->back()->with('error', $msg);
        }

        if (!empty($operationalBlockers)) {
            $list = implode(' dan ', $operationalBlockers);
            $msg = "Item \"{$item->nama}\" tidak dapat dihapus karena terdapat data {$list} yang masih terkait.";
            if (request()->wantsJson()) {
                return response()->json(['error' => $msg], 422);
            }
            return redirect()->back()->with('error', $msg);
        }

        $item->delete();

        if (request()->wantsJson()) {
            return response()->json(['message' => 'Item berhasil dihapus'], 200);
        }

        return redirect()->back()->with('success', 'Item berhasil dihapus');
    }

    public function syncTags(Request $request, Item $item)
    {
        $decodedTagIds = collect($request->tag_ids ?? [])
            ->map(fn ($h) => dhid((string) $h))
            ->filter()
            ->values()
            ->toArray();
        $request->merge(['tag_ids' => $decodedTagIds]);

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
        $ids = array_filter(array_map(
            fn ($h) => dhid(trim($h)),
            explode(',', $request->get('ids', ''))
        ));

        if (empty($ids)) {
            return redirect()->route('item.index')->with('error', 'Pilih item terlebih dahulu.');
        }

        $ids = array_slice($ids, 0, 100);

        $items = Item::whereIn('id', $ids)
            ->orderBy('nama')
            ->get()
            ->map(fn($i) => [
                'id'       => hid($i->id),
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