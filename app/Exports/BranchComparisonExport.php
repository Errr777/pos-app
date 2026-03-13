<?php

namespace App\Exports;

use App\Models\SaleHeader;
use App\Models\SaleItem;
use App\Models\Warehouse;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithStyles;
use Maatwebsite\Excel\Concerns\WithTitle;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

class BranchComparisonExport implements FromCollection, WithHeadings, WithTitle, WithStyles, ShouldAutoSize
{
    public function __construct(
        private string $dateFrom,
        private string $dateTo,
        private array  $allowedIds = []
    ) {}

    public function collection(): Collection
    {
        $warehouseQuery = Warehouse::where('is_active', true)->orderBy('name');
        if (!empty($this->allowedIds)) $warehouseQuery->whereIn('id', $this->allowedIds);
        $warehouses = $warehouseQuery->get();

        return $warehouses->map(function ($w) {
            $baseSales = SaleHeader::where('warehouse_id', $w->id)
                ->where('status', 'completed')
                ->whereBetween('occurred_at', [$this->dateFrom . ' 00:00:00', $this->dateTo . ' 23:59:59']);

            $trxCount = (int) (clone $baseSales)->count();
            $revenue  = (int) (clone $baseSales)->sum('grand_total');
            $avgOrder = $trxCount > 0 ? (int) round($revenue / $trxCount) : 0;

            $cogs = (int) SaleItem::whereHas('saleHeader', fn($q) =>
                $q->where('warehouse_id', $w->id)
                  ->where('status', 'completed')
                  ->whereBetween('occurred_at', [$this->dateFrom . ' 00:00:00', $this->dateTo . ' 23:59:59'])
            )->join('items', 'items.id', '=', 'sale_items.item_id')
             ->sum(DB::raw('sale_items.quantity * items.harga_beli'));

            $topItem = SaleItem::whereHas('saleHeader', fn($q) =>
                $q->where('warehouse_id', $w->id)
                  ->where('status', 'completed')
                  ->whereBetween('occurred_at', [$this->dateFrom . ' 00:00:00', $this->dateTo . ' 23:59:59'])
            )->selectRaw('item_name_snapshot, SUM(quantity) as qty')
             ->groupBy('item_name_snapshot')
             ->orderByDesc('qty')
             ->first();

            return [
                $w->name,
                $w->city ?? '-',
                $trxCount,
                $revenue,
                $cogs,
                $revenue - $cogs,
                $avgOrder,
                $topItem?->item_name_snapshot ?? '-',
            ];
        });
    }

    public function headings(): array
    {
        return [
            'Outlet', 'Kota', 'Transaksi', 'Revenue (Rp)',
            'COGS (Rp)', 'Profit (Rp)', 'Rata-rata Order (Rp)', 'Produk Terlaris',
        ];
    }

    public function title(): string
    {
        return 'Perbandingan Cabang';
    }

    public function styles(Worksheet $sheet): array
    {
        return [
            1 => ['font' => ['bold' => true, 'size' => 11]],
        ];
    }
}
