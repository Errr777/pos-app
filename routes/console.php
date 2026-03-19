<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::command('backup:database --keep=7')
    ->dailyAt('02:00')
    ->appendOutputTo(storage_path('logs/backup.log'));

Schedule::command('installments:mark-overdue')
    ->dailyAt('01:00')
    ->appendOutputTo(storage_path('logs/installments.log'));
