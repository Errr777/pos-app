<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

class BackupDatabase extends Command
{
    protected $signature = 'backup:database {--keep=7 : Number of daily backups to retain}';
    protected $description = 'Backup the database to storage/backups/';

    public function handle(): int
    {
        $driver = config('database.default');
        $disk   = Storage::disk('local');
        $date   = now()->format('Y-m-d_H-i-s');

        $this->info("Running database backup ({$driver})...");

        if ($driver === 'sqlite') {
            $dbPath = config('database.connections.sqlite.database');
            if (!file_exists($dbPath)) {
                $this->error("SQLite file not found: {$dbPath}");
                return self::FAILURE;
            }
            $filename = "backups/db-{$date}.sqlite";
            $disk->put($filename, file_get_contents($dbPath));

        } elseif ($driver === 'mysql') {
            $filename = "backups/db-{$date}.sql";
            $host     = config('database.connections.mysql.host');
            $port     = config('database.connections.mysql.port');
            $database = config('database.connections.mysql.database');
            $username = config('database.connections.mysql.username');
            $password = config('database.connections.mysql.password');

            $tmpFile = storage_path("app/{$filename}");
            @mkdir(dirname($tmpFile), 0755, true);

            // Use --defaults-extra-file to avoid exposing password in process list (ps aux)
            $cnfFile = tempnam(sys_get_temp_dir(), 'mysql_cnf_');
            $escapedPw = str_replace('"', '\\"', $password);
            file_put_contents($cnfFile, "[client]\npassword=\"{$escapedPw}\"\n");
            chmod($cnfFile, 0600);

            $cmd = sprintf(
                'mysqldump --defaults-extra-file=%s --host=%s --port=%s --user=%s %s > %s 2>&1',
                escapeshellarg($cnfFile),
                escapeshellarg($host),
                escapeshellarg($port),
                escapeshellarg($username),
                escapeshellarg($database),
                escapeshellarg($tmpFile),
            );
            exec($cmd, $output, $exitCode);
            @unlink($cnfFile);

            if ($exitCode !== 0) {
                $this->error("mysqldump failed: " . implode("\n", $output));
                return self::FAILURE;
            }
        } else {
            $this->error("Unsupported DB driver: {$driver}. Only sqlite and mysql are supported.");
            return self::FAILURE;
        }

        $this->info("Backup saved: {$filename}");
        $this->pruneOldBackups($disk, (int) $this->option('keep'));

        return self::SUCCESS;
    }

    private function pruneOldBackups($disk, int $keep): void
    {
        $files = collect($disk->exists('backups') ? $disk->files('backups') : [])
            ->filter(fn ($f) => str_starts_with(basename($f), 'db-'))
            ->sortByDesc(fn ($f) => $disk->lastModified($f))
            ->values();

        foreach ($files->slice($keep) as $file) {
            $disk->delete($file);
            $this->line("Pruned old backup: {$file}");
        }
    }
}
