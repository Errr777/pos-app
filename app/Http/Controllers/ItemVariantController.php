<?php

namespace App\Http\Controllers;

use App\Models\Item;
use App\Models\ItemVariant;
use Illuminate\Http\Request;

class ItemVariantController extends Controller
{
    public function index(Item $item)
    {
        $variants = $item->hasMany(ItemVariant::class)->orderBy('name')->get()
            ->map(fn($v) => [
                'id'             => $v->id,
                'name'           => $v->name,
                'price_modifier' => $v->price_modifier,
                'is_active'      => $v->is_active,
            ]);

        return response()->json($variants);
    }

    public function store(Request $request, Item $item)
    {
        if (!$request->user()?->hasPermission('items', 'can_write')) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        $data = $request->validate([
            'name'           => 'required|string|max:100',
            'price_modifier' => 'nullable|integer',
        ]);

        $variant = $item->hasMany(ItemVariant::class)->create([
            'name'           => $data['name'],
            'price_modifier' => (int) ($data['price_modifier'] ?? 0),
            'is_active'      => true,
        ]);

        return response()->json([
            'id'             => $variant->id,
            'name'           => $variant->name,
            'price_modifier' => $variant->price_modifier,
            'is_active'      => $variant->is_active,
        ], 201);
    }

    public function update(Request $request, Item $item, ItemVariant $variant)
    {
        if (!$request->user()?->hasPermission('items', 'can_write')) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        abort_if($variant->item_id !== $item->id, 404);

        $data = $request->validate([
            'name'           => 'sometimes|string|max:100',
            'price_modifier' => 'sometimes|integer',
            'is_active'      => 'sometimes|boolean',
        ]);

        $variant->update($data);

        return response()->json([
            'id'             => $variant->id,
            'name'           => $variant->name,
            'price_modifier' => $variant->price_modifier,
            'is_active'      => $variant->is_active,
        ]);
    }

    public function destroy(Request $request, Item $item, ItemVariant $variant)
    {
        if (!$request->user()?->hasPermission('items', 'can_delete')) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        abort_if($variant->item_id !== $item->id, 404);

        $variant->delete();

        return response()->json(['message' => 'Varian dihapus']);
    }
}
