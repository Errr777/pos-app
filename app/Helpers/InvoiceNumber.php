<?php

namespace App\Helpers;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class InvoiceNumber
{
    public static function generate(): string
    {
        $today = Carbon::today()->toDateString();

        return DB::transaction(function () use ($today) {
            $row = DB::table('invoice_sequences')
                ->where('date', $today)
                // lockForUpdate() is a no-op on SQLite (dev) but provides row-level locking on MariaDB (production).
                ->lockForUpdate()
                ->first();

            if ($row) {
                $sequence = $row->sequence + 1;
                DB::table('invoice_sequences')
                    ->where('date', $today)
                    ->update(['sequence' => $sequence, 'updated_at' => now()]);
            } else {
                $sequence = 1;
                DB::table('invoice_sequences')->insert([
                    'date' => $today,
                    'sequence' => $sequence,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }

            return 'INV-'
                .str_replace('-', '', $today)
                .'-'
                .str_pad($sequence, 4, '0', STR_PAD_LEFT);
        });
    }
}
