<?php

namespace App\Console\Commands;

use App\Jobs\LicenseSyncJob;
use App\Models\LicenseConfig;
use Illuminate\Console\Command;

class LicenseSetup extends Command
{
    protected $signature   = 'license:setup {key} {panel_url}';
    protected $description = 'Set up license key and panel URL, then trigger first sync';

    public function handle(): int
    {
        $key      = $this->argument('key');
        $panelUrl = rtrim($this->argument('panel_url'), '/');

        LicenseConfig::updateOrCreate(
            ['id' => 1],
            [
                'license_key' => $key,
                'panel_url'   => $panelUrl,
                'valid'       => false,
            ]
        );

        $this->info("License configured. Key: {$key}");
        $this->info("Panel URL: {$panelUrl}");
        $this->info('Running first sync...');

        LicenseSyncJob::dispatchSync();

        $config = LicenseConfig::current();

        if ($config->valid) {
            $this->info('✓ License valid! Status: ' . $config->status);
            $this->info('✓ Modules: ' . implode(', ', $config->modules ?? []));
        } else {
            $this->error('✗ License invalid. Reason: ' . $config->last_reason);
        }

        return self::SUCCESS;
    }
}
