<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // sale_items: heavily read when loading sale details and reports
        Schema::table('sale_items', function (Blueprint $table) {
            $table->index('sale_header_id', 'idx_sale_items_header');
        });

        // sale_headers: dashboard and report queries filter by occurred_at + status
        Schema::table('sale_headers', function (Blueprint $table) {
            $table->index(['occurred_at', 'status'], 'idx_sale_headers_at_status');
            $table->index(['customer_id', 'occurred_at'], 'idx_sale_headers_customer_at');
        });

        // installment_plans: void check queries (sale_header_id, status); plan list queries (customer_id, status)
        Schema::table('installment_plans', function (Blueprint $table) {
            $table->index(['sale_header_id', 'status'], 'idx_installment_plans_header_status');
            $table->index(['customer_id', 'status'], 'idx_installment_plans_customer_status');
        });

        // stock_adjustments: warehouse_stock lookup and date-range list queries
        Schema::table('stock_adjustments', function (Blueprint $table) {
            $table->index(['warehouse_id', 'item_id'], 'idx_stock_adj_warehouse_item');
            $table->index('occurred_at', 'idx_stock_adj_at');
        });

        // stock_transfers: date-range filtering and per-item history
        Schema::table('stock_transfers', function (Blueprint $table) {
            $table->index('occurred_at', 'idx_stock_transfers_at');
            $table->index('item_id', 'idx_stock_transfers_item');
        });
    }

    public function down(): void
    {
        Schema::table('stock_transfers', function (Blueprint $table) {
            $table->dropIndex('idx_stock_transfers_item');
            $table->dropIndex('idx_stock_transfers_at');
        });

        Schema::table('stock_adjustments', function (Blueprint $table) {
            $table->dropIndex('idx_stock_adj_at');
            $table->dropIndex('idx_stock_adj_warehouse_item');
        });

        Schema::table('installment_plans', function (Blueprint $table) {
            $table->dropIndex('idx_installment_plans_customer_status');
            $table->dropIndex('idx_installment_plans_header_status');
        });

        Schema::table('sale_headers', function (Blueprint $table) {
            $table->dropIndex('idx_sale_headers_customer_at');
            $table->dropIndex('idx_sale_headers_at_status');
        });

        Schema::table('sale_items', function (Blueprint $table) {
            $table->dropIndex('idx_sale_items_header');
        });
    }
};
