<?php
namespace App\Http\Controllers;

use App\Models\Kategori;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Inertia\Inertia;

class KategoriController extends Controller
{
    public function index(Request $request)
    {
        // ✅ Normalize per_page to safe values
        $allowedPerPage = [5, 10, 25, 50];
        $perPage = (int) $request->get('per_page', 10);
        if (!in_array($perPage, $allowedPerPage, true)) {
            $perPage = 10;
        }

        // ✅ Handle search keyword
        $search = trim((string) $request->get('search', ''));

        // -------------------- Sorting --------------------
        // Accept only these DB columns for sorting (whitelist)
        $allowedSortColumns = ['nama', 'deskripsi', 'created_at'];

        // Read requested sort_by (expects DB column names like 'nama' or 'deskripsi')
        $requestedSort = (string) $request->get('sort_by', '');
        $sortBy = in_array($requestedSort, $allowedSortColumns, true) ? $requestedSort : 'created_at';

        // sanitize sort_dir to 'asc' or 'desc'
        $requestedDir = strtolower((string) $request->get('sort_dir', 'desc'));
        $sortDir = $requestedDir === 'asc' ? 'asc' : 'desc';
        // -------------------------------------------------

        // ✅ Base query
        $query = Kategori::query();

        // ✅ Apply search filter if present
        if ($search !== '') {
            $query->where(function ($q) use ($search) {
                $q->where('nama', 'like', "%{$search}%")
                ->orWhere('deskripsi', 'like', "%{$search}%");
            });
        }

        // ✅ Order and paginate (using sanitized sort column + dir)
        $kategoris = $query
            ->orderBy($sortBy, $sortDir)
            ->paginate($perPage)
            ->withQueryString() // preserves ?search & ?per_page & ?sort_by & ?sort_dir on page change
            ->through(fn($kategori) => [
                'id' => $kategori->id,
                'nama' => $kategori->nama,
                'deskripsi' => $kategori->deskripsi,
                'created_at' => $kategori->created_at?->format('Y-m-d H:i'),
            ]);

        // ✅ Handle JSON response (optional for API-style calls)
        if ($request->wantsJson()) {
            return response()->json([
                'kategoris' => $kategoris,
                'filters' => $request->only(['search', 'per_page', 'sort_by', 'sort_dir']),
                'meta' => [
                    'current_page' => $kategoris->currentPage(),
                    'last_page' => $kategoris->lastPage(),
                    'total' => $kategoris->total(),
                    'per_page' => $kategoris->perPage(),
                    'from' => $kategoris->firstItem(),
                    'to' => $kategoris->lastItem(),
                ],
            ]);
        }

        // ✅ Inertia render for your React page — include sort info in filters
        return Inertia::render('category/Index', [
            'kategoris' => $kategoris,
            'filters' => $request->only(['search', 'per_page']) + [
                'sort_by' => $sortBy,
                'sort_dir' => $sortDir,
            ],
        ]);
    }

    public function show(Kategori $kategori, Request $request)
    {
        return Inertia::render('category/Show', [
            'kategori' => $kategori->toArray(),
        ]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'nama' => 'required|string|max:100|unique:kategoris,nama',
            'deskripsi' => 'nullable|string|max:1000',
        ]);

        $k = Kategori::create($data);

        if ($request->wantsJson()) {
            return response()->json(['message' => 'Kategori created', 'kategori' => $k], 201);
        }

        return redirect()->back()->with('success', 'Kategori created');
    }

    public function update(Request $request, Kategori $kategori)
    {
        $data = $request->validate([
            'nama' => 'required|string|max:100|unique:kategoris,nama,' . $kategori->id,
            'deskripsi' => 'nullable|string|max:1000',
        ]);

        $kategori->update($data);

        if ($request->wantsJson()) {
            return response()->json(['message' => 'Kategori updated', 'kategori' => $kategori], 200);
        }

        return redirect()->back()->with('success', 'Kategori updated');
    }

    public function destroy(Request $request, Kategori $kategori)
    {
        $kategori->delete();

        if ($request->wantsJson()) {
            return response()->json(['message' => 'Kategori deleted'], 200);
        }

        return redirect()->back()->with('success', 'Kategori deleted');
    }
}