<?php

namespace App\Http\Controllers;

use App\Support\BackupEncryption;
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
            ->filter(fn ($f) => str_starts_with(basename($f), 'db-') && str_ends_with($f, '.enc'))
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

        if (!preg_match('/^db-[\d_-]+\.(sqlite|sql)\.enc$/', $filename)) {
            abort(404);
        }

        $path = "backups/{$filename}";
        abort_unless(Storage::disk('local')->exists($path), 404);

        return Storage::disk('local')->download($path, $filename);
    }

    public function run(Request $request): \Illuminate\Http\JsonResponse|\Illuminate\Http\RedirectResponse
    {
        abort_unless(auth()->user()->role === 'admin', 403);

        Artisan::call('backup:database');

        $disk   = Storage::disk('local');
        $latest = collect($disk->exists('backups') ? $disk->files('backups') : [])
            ->filter(fn ($f) => str_starts_with(basename($f), 'db-') && str_ends_with($f, '.enc'))
            ->sortByDesc(fn ($f) => $disk->lastModified($f))
            ->first();

        $newFile = $latest ? basename($latest) : null;

        if ($request->wantsJson()) {
            return response()->json(['filename' => $newFile, 'message' => 'Backup berhasil dibuat.']);
        }

        return redirect()->route('backups.index')->with('success', 'Backup berhasil dibuat.');
    }

    public function restore(string $filename): \Illuminate\Http\RedirectResponse
    {
        abort_unless(auth()->user()->role === 'admin', 403);

        if (!preg_match('/^db-[\d_-]+\.(sqlite|sql)\.enc$/', $filename)) {
            abort(404);
        }

        $path = "backups/{$filename}";
        abort_unless(Storage::disk('local')->exists($path), 404);

        $encPath = Storage::disk('local')->path($path);
        $tmpPath = BackupEncryption::decryptToTemp($encPath);

        try {
            $ext = str_ends_with($filename, '.sqlite.enc') ? 'sqlite' : 'sql';
            $this->runRestore($tmpPath, $ext);
        } finally {
            @unlink($tmpPath);
        }

        return back()->with('success', "Database berhasil dipulihkan dari {$filename}.");
    }

    public function upload(Request $request): \Illuminate\Http\RedirectResponse
    {
        abort_unless(auth()->user()->role === 'admin', 403);

        $request->validate([
            'backup_file' => ['required', 'file', 'max:102400'],
        ]);

        $file     = $request->file('backup_file');
        $origName = $file->getClientOriginalName();

        if (!str_ends_with($origName, '.sql.enc') && !str_ends_with($origName, '.sqlite.enc')) {
            return back()->withErrors(['backup_file' => 'File harus berformat .sql.enc (backup terenkripsi).']);
        }

        $filename = 'db-imported-' . now()->format('Y-m-d_H-i-s') . '.sql.enc';
        $stored   = $file->storeAs('backups', $filename, 'local');
        $encPath  = Storage::disk('local')->path($stored);

        $tmpPath = BackupEncryption::decryptToTemp($encPath);
        try {
            $this->runRestore($tmpPath, 'sql');
        } finally {
            @unlink($tmpPath);
        }

        return back()->with('success', 'Database berhasil dipulihkan dari file yang diunggah.');
    }

    public function destroy(string $filename): \Illuminate\Http\RedirectResponse
    {
        abort_unless(auth()->user()->role === 'admin', 403);

        if (!preg_match('/^db-[\d_-]+\.(sqlite|sql)\.enc$/', $filename)) {
            abort(404);
        }

        $path = "backups/{$filename}";
        if (Storage::disk('local')->exists($path)) {
            Storage::disk('local')->delete($path);
        }

        return back()->with('success', "Backup {$filename} berhasil dihapus.");
    }

    private function runRestore(string $filePath, string $ext): void
    {
        $driver = config('database.default');

        if ($ext === 'sqlite') {
            $dbPath = config('database.connections.sqlite.database');
            copy($filePath, $dbPath);
            return;
        }

        // SQL dump — works for mysql/mariadb
        $conn     = config("database.connections.{$driver}");
        $host     = $conn['host'];
        $port     = $conn['port'];
        $database = $conn['database'];
        $username = $conn['username'];
        $password = $conn['password'];

        $cmd = sprintf(
            'mysql --host=%s --port=%s --user=%s %s',
            escapeshellarg($host),
            escapeshellarg((string) $port),
            escapeshellarg($username),
            escapeshellarg($database),
        );

        // Pass password via child-process env var — no credentials written to disk
        $proc = proc_open(
            $cmd,
            [0 => ['file', $filePath, 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']],
            $pipes,
            null,
            array_merge($_ENV, ['MYSQL_PWD' => $password]),
        );

        if (! is_resource($proc)) {
            abort(500, 'Restore gagal: tidak dapat menjalankan mysql.');
        }

        $stderr = stream_get_contents($pipes[2]);
        fclose($pipes[1]);
        fclose($pipes[2]);
        $exitCode = proc_close($proc);

        if ($exitCode !== 0) {
            abort(500, 'Restore gagal: ' . $stderr);
        }
    }
}
