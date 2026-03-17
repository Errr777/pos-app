<?php

namespace App\Console\Commands;

use App\Support\BackupEncryption;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

class BackupDatabase extends Command
{
    protected $signature = 'backup:database {--keep=7 : Number of daily backups to retain}';
    protected $description = 'Backup the database to storage/backups/ (AES-256-CBC encrypted)';

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
            $relPath = "backups/db-{$date}.sqlite.enc";
            $encPath = $disk->path($relPath);
            @mkdir(dirname($encPath), 0755, true);
            BackupEncryption::encryptFile($dbPath, $encPath);

        } elseif ($driver === 'mysql' || $driver === 'mariadb') {
            $conn     = config("database.connections.{$driver}");
            $host     = $conn['host'];
            $port     = $conn['port'];
            $database = $conn['database'];
            $username = $conn['username'];
            $password = $conn['password'];

            $tmpFile = tempnam(sys_get_temp_dir(), 'db_backup_') . '.sql';

            $cnfFile   = tempnam(sys_get_temp_dir(), 'mysql_cnf_');
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
                @unlink($tmpFile);
                $this->error("mysqldump failed: " . implode("\n", $output));
                return self::FAILURE;
            }

            $relPath = "backups/db-{$date}.sql.enc";
            $encPath = $disk->path($relPath);
            @mkdir(dirname($encPath), 0755, true);
            BackupEncryption::encryptFile($tmpFile, $encPath);
            @unlink($tmpFile);

        } else {
            $this->error("Unsupported DB driver: {$driver}.");
            return self::FAILURE;
        }

        $this->info("Backup saved (encrypted): {$relPath}");
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
