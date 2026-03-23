<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        // MySQL/MariaDB: extend the ENUM to include 'tag'. SQLite has no ENUM type, so skip.
        if (in_array(Schema::getConnection()->getDriverName(), ['mysql', 'mariadb'])) {
            DB::statement("ALTER TABLE promotions MODIFY COLUMN applies_to ENUM('all', 'category', 'item', 'tag') NOT NULL DEFAULT 'all'");
        }
    }

    public function down(): void
    {
        if (in_array(Schema::getConnection()->getDriverName(), ['mysql', 'mariadb'])) {
            // Move any 'tag' rows back to 'all' before shrinking the enum
            DB::statement("UPDATE promotions SET applies_to = 'all' WHERE applies_to = 'tag'");
            DB::statement("ALTER TABLE promotions MODIFY COLUMN applies_to ENUM('all', 'category', 'item') NOT NULL DEFAULT 'all'");
        }
    }
};
