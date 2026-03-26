<?php

namespace App\Http\Controllers;

use App\Helpers\AuditLogger;
use App\Models\Kategori;
use App\Models\Item;
use App\Models\Promotion;
use App\Models\Tag;
use Illuminate\Http\Request;
use Inertia\Inertia;

class PromotionController extends Controller
{
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
        $search = trim((string) $request->get('search', ''));

        $query = Promotion::latest();

        if ($search !== '') {
            $term = strtolower($search);
            $query->where(function ($q) use ($term) {
                $q->whereRaw('LOWER(name) like ?', ["%{$term}%"])
                  ->orWhereRaw('LOWER(code) like ?', ["%{$term}%"]);
            });
        }

        $promotions = $query->paginate(20)->withQueryString()->through(fn ($p) => [
            'id'           => hid($p->id),
            'name'         => $p->name,
            'code'         => $p->code,
            'type'         => $p->type,
            'value'        => $p->value,
            'applies_to'   => $p->applies_to,
            'applies_id'   => hid($p->applies_id),
            'min_purchase' => $p->min_purchase,
            'max_discount' => $p->max_discount,
            'start_date'   => $p->start_date?->format('Y-m-d'),
            'end_date'     => $p->end_date?->format('Y-m-d'),
            'is_active'    => (bool) $p->is_active,
        ]);

        $categories = Kategori::orderBy('nama')->get(['id', 'nama'])
            ->map(fn ($c) => ['id' => hid($c->id), 'nama' => $c->nama]);
        $items      = Item::orderBy('nama')->get(['id', 'nama'])
            ->map(fn ($i) => ['id' => hid($i->id), 'nama' => $i->nama]);
        $tags       = Tag::orderBy('name')->get(['id', 'name', 'color'])
            ->map(fn ($t) => ['id' => hid($t->id), 'name' => $t->name, 'color' => $t->color]);

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
        $request->merge([
            'applies_id' => $request->applies_id ? dhid((string) $request->applies_id) : null,
        ]);

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

        $promotion = Promotion::create($data);

        AuditLogger::log('promotion.created', $promotion, null, [
            'name'           => $promotion->name,
            'discount_type'  => $promotion->type,
            'discount_value' => $promotion->value,
        ]);

        return back()->with('success', 'Promo berhasil ditambahkan.');
    }

    public function update(Request $request, Promotion $promotion)
    {
        $request->merge([
            'applies_id' => $request->applies_id ? dhid((string) $request->applies_id) : null,
        ]);

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

        AuditLogger::log('promotion.updated', $promotion,
            ['name' => $promotion->name, 'discount_value' => $promotion->value],
            ['name' => $data['name'], 'discount_value' => $data['value']]
        );

        $promotion->update($data);

        return back()->with('success', 'Promo berhasil diupdate.');
    }

    public function destroy(Promotion $promotion)
    {
        AuditLogger::log('promotion.deleted', $promotion, ['name' => $promotion->name]);

        $promotion->delete();
        return back()->with('success', 'Promo dihapus.');
    }

    // JSON endpoint — dipakai oleh POS terminal untuk cek promo aktif
    public function active()
    {
        return response()->json(Promotion::active()->get()->map(fn ($p) => [
            'id'           => hid($p->id),
            'name'         => $p->name,
            'code'         => $p->code,
            'type'         => $p->type,
            'value'        => $p->value,
            'applies_to'   => $p->applies_to,
            'applies_id'   => hid($p->applies_id),
            'min_purchase' => $p->min_purchase,
            'max_discount' => $p->max_discount,
            'start_date'   => $p->start_date?->format('Y-m-d'),
            'end_date'     => $p->end_date?->format('Y-m-d'),
            'is_active'    => (bool) $p->is_active,
        ]));
    }
}
