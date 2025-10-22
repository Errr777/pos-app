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

        $itemsQuery = Item::with('kategoriRelation')
            ->when($search, function ($q, $search) {
                $q->where('nama', 'like', "%{$search}%")
                ->orWhere('kode_item', 'like', "%{$search}%");
            })
            ->orderBy($sortColumn, $requestedDir);

        $items = $itemsQuery
            ->paginate($perPage)
            ->withQueryString()
            ->through(function ($i) {
                return [
                    'id'            => $i->id,
                    'nama'          => $i->nama,
                    'deskripsi'     => $i->deskripsi,
                    'kode_item'     => $i->kode_item,
                    'stok'          => $i->stok,
                    'stok_minimal'  => $i->stok_minimal,
                    'kategori'      => $i->kategori,
                    'id_kategori'   => $i->id_kategori,
                    'kategori_rel'  => $i->kategoriRelation
                        ? [
                            'id'   => $i->kategoriRelation->id,
                            'nama' => $i->kategoriRelation->nama ?? ($i->kategoriRelation->nama_kategori ?? null),
                        ]
                        : null,
                ];
            });

        // Pass kategoris for dropdown. Normalize possible column names (nama or nama_kategori)
        $kategoris = Kategori::all()->map(function ($k) {
            return [
                'id'        => $k->id,
                'nama'      => $k->nama ?? ($k->nama_kategori ?? null),
                'deskripsi' => $k->deskripsi ?? null,
            ];
        });

        // Return filters including sort_by & sort_dir so frontend can initialize
        return Inertia::render('Items/Index', [
            'items'      => $items,
            'filters'    => $request->only(['search', 'per_page']) + [
                'sort_by'  => $requestedSort,
                'sort_dir' => $requestedDir,
            ],
            'kategoris'  => $kategoris,
        ]);
    }

    public function show(Item $item)
    {
        $item->load('kategoriRelation');

        return Inertia::render('Items/Show', [
            'item' => $item->toArray(),
        ]);
    }

    public function edit(Item $item, Request $request)
    {
        // Load kategori relation if available
        $item->load('kategoriRelation');

        // Prepare item payload in a frontend-friendly shape
        $payload = [
            'id' => $item->id,
            'name' => $item->nama,
            'description' => $item->deskripsi,
            'qrcode' => $item->kode_item,
            'stock' => $item->stok,
            'stock_min' => $item->stok_minimal,
            'id_kategori' => $item->id_kategori,
            'kategori' => $item->kategori,
            'kategori_rel' => $item->kategoriRelation ? ['id' => $item->kategoriRelation->id, 'nama' => ($item->kategoriRelation->nama ?? null)] : null,
        ];

        // provide kategoris list for dropdown
        $kategoris = Kategori::all()->map(function ($k) {
            return [
                'id' => $k->id,
                'nama' => $k->nama ?? ($k->nama_kategori ?? null),
                'deskripsi' => $k->deskripsi ?? null,
            ];
        });

        if ($request->wantsJson()) {
            return response()->json(['item' => $payload, 'kategoris' => $kategoris], 200);
        }

        // If you have a dedicated edit page (optional), render it:
        return Inertia::render('Items/Edit', [
            'item' => $payload,
            'kategoris' => $kategoris,
        ]);
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
            'id_kategori',
            'category',
        ]);

        // Normalize for validation
        $payloadForValidation = [
            'nama' => $data['name'] ?? $item->nama,
            'deskripsi' => $data['description'] ?? $item->deskripsi,
            'kode_item' => $data['qrcode'] ?? $item->kode_item,
            'stok' => isset($data['stock']) ? (int) $data['stock'] : $item->stok,
            'stok_minimal' => isset($data['stock_min']) ? (int) $data['stock_min'] : $item->stok_minimal,
            'id_kategori' => isset($data['id_kategori']) && $data['id_kategori'] !== '' ? (int) $data['id_kategori'] : null,
        ];

        $validator = Validator::make($payloadForValidation, [
            'nama' => 'required|string|max:100',
            'deskripsi' => 'nullable|string|max:1000',
            'kode_item' => 'required|string|max:100|unique:items,kode_item,' . $item->id,
            'stok' => 'required|integer|min:0',
            'stok_minimal' => 'required|integer|min:0',
            'id_kategori' => 'nullable|integer|exists:kategoris,id',
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
            'nama' => $payloadForValidation['nama'],
            'deskripsi' => $payloadForValidation['deskripsi'],
            'kode_item' => $payloadForValidation['kode_item'],
            'stok' => $payloadForValidation['stok'],
            'stok_minimal' => $payloadForValidation['stok_minimal'],
            'id_kategori' => $payloadForValidation['id_kategori'] ?? null,
            'kategori' => $kategoriName,
        ];

        $item->update($updatePayload);

        // Return JSON for XHR or Inertia-friendly response
        if ($request->wantsJson()) {
            return response()->json([
                'message' => 'Item updated',
                'item' => [
                    'id' => $item->id,
                    'name' => $item->nama,
                    'description' => $item->deskripsi,
                    'qrcode' => $item->kode_item,
                    'stock' => $item->stok,
                    'stock_min' => $item->stok_minimal,
                    'id_kategori' => $item->id_kategori,
                    'kategori' => $item->kategori,
                ],
            ], 200);
        }

        return redirect()->back()->with('success', 'Item updated successfully');
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
}