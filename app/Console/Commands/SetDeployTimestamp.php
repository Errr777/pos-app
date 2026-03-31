<?php

namespace App\Console\Commands;

use App\Models\AppSetting;
use Illuminate\Console\Command;

class SetDeployTimestamp extends Command
{
    protected $signature   = 'app:set-deploy-timestamp {--version= : Optional app version string}';
    protected $description = 'Record the current timestamp as last_deploy_at in AppSetting (call during deployment)';

    public function handle(): int
    {
        AppSetting::set('last_deploy_at', now()->toIso8601String());

        if ($version = $this->option('version')) {
            AppSetting::set('app_version', $version);
            $this->info("Deploy timestamp and version ({$version}) saved.");
        } else {
            $this->info('Deploy timestamp saved: ' . now()->toIso8601String());
        }

        return self::SUCCESS;
    }
}
