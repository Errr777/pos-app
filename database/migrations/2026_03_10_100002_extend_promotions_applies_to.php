<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        DB::statement('PRAGMA foreign_keys = OFF');
        DB::statement('CREATE TABLE promotions_new AS SELECT * FROM promotions');
        DB::statement('DROP TABLE promotions');
        DB::statement("
            CREATE TABLE promotions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name VARCHAR(100) NOT NULL,
                code VARCHAR(50) UNIQUE,
                type VARCHAR(255) NOT NULL DEFAULT 'percentage'
                    CHECK (type IN ('percentage', 'fixed')),
                value INTEGER NOT NULL,
                applies_to VARCHAR(255) NOT NULL DEFAULT 'all'
                    CHECK (applies_to IN ('all', 'category', 'item', 'tag')),
                applies_id INTEGER,
                min_purchase INTEGER NOT NULL DEFAULT 0,
                max_discount INTEGER NOT NULL DEFAULT 0,
                start_date DATE NOT NULL,
                end_date DATE NOT NULL,
                is_active TINYINT(1) NOT NULL DEFAULT 1,
                created_at DATETIME,
                updated_at DATETIME
            )
        ");
        DB::statement('INSERT INTO promotions SELECT * FROM promotions_new');
        DB::statement('DROP TABLE promotions_new');
        DB::statement('PRAGMA foreign_keys = ON');
    }

    public function down(): void
    {
        DB::statement('PRAGMA foreign_keys = OFF');
        DB::statement("CREATE TABLE promotions_new AS SELECT * FROM promotions WHERE applies_to != 'tag'");
        DB::statement('DROP TABLE promotions');
        DB::statement("
            CREATE TABLE promotions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name VARCHAR(100) NOT NULL,
                code VARCHAR(50) UNIQUE,
                type VARCHAR(255) NOT NULL DEFAULT 'percentage'
                    CHECK (type IN ('percentage', 'fixed')),
                value INTEGER NOT NULL,
                applies_to VARCHAR(255) NOT NULL DEFAULT 'all'
                    CHECK (applies_to IN ('all', 'category', 'item')),
                applies_id INTEGER,
                min_purchase INTEGER NOT NULL DEFAULT 0,
                max_discount INTEGER NOT NULL DEFAULT 0,
                start_date DATE NOT NULL,
                end_date DATE NOT NULL,
                is_active TINYINT(1) NOT NULL DEFAULT 1,
                created_at DATETIME,
                updated_at DATETIME
            )
        ");
        DB::statement('INSERT INTO promotions SELECT * FROM promotions_new');
        DB::statement('DROP TABLE promotions_new');
        DB::statement('PRAGMA foreign_keys = ON');
    }
};
