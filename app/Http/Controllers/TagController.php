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
