<?php

namespace App\Http\Controllers;

use App\Models\Tag;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Inertia\Inertia;

class TagController extends Controller
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

    public function index()
    {
        $tags = Tag::withCount('items')->orderBy('name')->get()
            ->map(fn ($t) => [
                'id'          => hid($t->id),
                'name'        => $t->name,
                'color'       => $t->color,
                'slug'        => $t->slug,
                'items_count' => $t->items_count,
            ])->values();

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
        $tag->delete();
        return back()->with('success', 'Tag dihapus.');
    }
}
