<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        DB::statement("ALTER TABLE promotions MODIFY COLUMN applies_to ENUM('all', 'category', 'item', 'tag') NOT NULL DEFAULT 'all'");
    }

    public function down(): void
    {
        // Move any 'tag' rows back to 'all' before shrinking the enum
        DB::statement("UPDATE promotions SET applies_to = 'all' WHERE applies_to = 'tag'");
        DB::statement("ALTER TABLE promotions MODIFY COLUMN applies_to ENUM('all', 'category', 'item') NOT NULL DEFAULT 'all'");
    }
};
