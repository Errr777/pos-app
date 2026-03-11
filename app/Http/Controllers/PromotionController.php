<?php

namespace App\Http\Controllers;

use App\Models\Kategori;
use App\Models\Item;
use App\Models\Promotion;
use App\Models\Tag;
use Illuminate\Http\Request;
use Inertia\Inertia;

class PromotionController extends Controller
{
    public function index(Request $request)
    {
        $search = trim((string) $request->get('search', ''));

        $query = Promotion::latest();

        if ($search !== '') {
            $term = strtolower($search);
            $query->where(function ($q) use ($term) {
                $q->whereRaw('LOWER(name) like ?', ["%{$term}%"])
                  ->orWhereRaw('LOWER(code) like ?', ["%{$term}%"]);
            });
        }

        $promotions = $query->paginate(20)->withQueryString();

        $categories = Kategori::orderBy('nama')->get(['id', 'nama']);
        $items      = Item::orderBy('nama')->get(['id', 'nama']);
        $tags       = Tag::orderBy('name')->get(['id', 'name', 'color']);

        return Inertia::render('promotions/Index', [
            'promotions' => $promotions,
            'categories' => $categories,
            'items'      => $items,
            'tags'       => $tags,
            'filters'    => ['search' => $search],
        ]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name'         => 'required|string|max:100',
            'code'         => 'nullable|string|max:50|unique:promotions,code',
            'type'         => 'required|in:percentage,fixed',
            'value'        => 'required|integer|min:1',
            'applies_to'   => 'required|in:all,category,item,tag',
            'applies_id'   => 'nullable|integer',
            'min_purchase' => 'integer|min:0',
            'max_discount' => 'integer|min:0',
            'start_date'   => 'required|date',
            'end_date'     => 'required|date|after_or_equal:start_date',
            'is_active'    => 'boolean',
        ]);

        Promotion::create($data);

        return back()->with('success', 'Promo berhasil ditambahkan.');
    }

    public function update(Request $request, Promotion $promotion)
    {
        $data = $request->validate([
            'name'       => 'required|string|max:100',
            'code'       => 'nullable|string|max:50|unique:promotions,code,' . $promotion->id,
            'type'       => 'required|in:percentage,fixed',
            'value'      => 'required|integer|min:1',
            'applies_to' => 'required|in:all,category,item,tag',
            'applies_id' => 'nullable|integer',
            'min_purchase'=> 'integer|min:0',
            'max_discount'=> 'integer|min:0',
            'start_date' => 'required|date',
            'end_date'   => 'required|date|after_or_equal:start_date',
            'is_active'  => 'boolean',
        ]);

        $promotion->update($data);

        return back()->with('success', 'Promo berhasil diupdate.');
    }

    public function destroy(Promotion $promotion)
    {
        $promotion->delete();
        return back()->with('success', 'Promo dihapus.');
    }

    // JSON endpoint — dipakai oleh POS terminal untuk cek promo aktif
    public function active()
    {
        return response()->json(Promotion::active()->get());
    }
}
