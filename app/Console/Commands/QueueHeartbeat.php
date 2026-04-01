<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;

class QueueHeartbeat extends Command
{
    protected $signature   = 'app:queue-heartbeat';
    protected $description = 'Write a queue worker heartbeat to cache (used by health check)';

    public function handle(): int
    {
        Cache::put('queue:heartbeat', now()->toIso8601String(), 120);

        return self::SUCCESS;
    }
}
