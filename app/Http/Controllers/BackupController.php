<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;

class BackupController extends Controller
{
    public function index(): \Inertia\Response
    {
        abort_unless(auth()->user()->role === 'admin', 403);

        $disk  = Storage::disk('local');
        $files = collect($disk->exists('backups') ? $disk->files('backups') : [])
            ->filter(fn ($f) => str_starts_with(basename($f), 'db-'))
            ->sortByDesc(fn ($f) => $disk->lastModified($f))
            ->map(fn ($f) => [
                'filename'  => basename($f),
                'size'      => $disk->size($f),
                'createdAt' => date('Y-m-d H:i:s', $disk->lastModified($f)),
            ])
            ->values()
            ->toArray();

        return Inertia::render('settings/backups', [
            'backups' => $files,
        ]);
    }

    public function download(string $filename): \Symfony\Component\HttpFoundation\StreamedResponse
    {
        abort_unless(auth()->user()->role === 'admin', 403);

        if (!preg_match('/^db-[\d_-]+\.(sqlite|sql)$/', $filename)) {
            abort(404);
        }

        $path = "backups/{$filename}";
        abort_unless(Storage::disk('local')->exists($path), 404);

        return Storage::disk('local')->download($path, $filename);
    }

    public function run(): \Illuminate\Http\RedirectResponse
    {
        abort_unless(auth()->user()->role === 'admin', 403);

        Artisan::call('backup:database');
        return back()->with('success', 'Backup berhasil dibuat.');
    }
}
