<?php

namespace App\Exports;

use App\Models\PurchaseOrder;
use App\Models\SaleHeader;
use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithStyles;
use Maatwebsite\Excel\Concerns\WithTitle;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

class CashflowExport implements FromCollection, WithHeadings, WithTitle, WithStyles, ShouldAutoSize
{
    public function __construct(
        private string $dateFrom,
        private string $dateTo,
        private string $groupBy = 'daily',
        private array  $allowedIds = [],
        private string $warehouseId = ''
    ) {}

    public function collection(): Collection
    {
        $fmt = $this->groupBy === 'monthly' ? '%Y-%m' : '%Y-%m-%d';

        $inQuery = SaleHeader::selectRaw("strftime('{$fmt}', occurred_at) as period, SUM(grand_total) as total")
            ->where('status', 'completed')
            ->whereBetween('occurred_at', [$this->dateFrom . ' 00:00:00', $this->dateTo . ' 23:59:59'])
            ->groupByRaw("strftime('{$fmt}', occurred_at)");

        if (!empty($this->allowedIds)) $inQuery->whereIn('warehouse_id', $this->allowedIds);
        if ($this->warehouseId !== '') {
            $wId = (int) $this->warehouseId;
            if (empty($this->allowedIds) || in_array($wId, $this->allowedIds)) {
                $inQuery->where('warehouse_id', $wId);
            }
        }

        $cashIn = $inQuery->pluck('total', 'period')->map(fn($v) => (int) $v);

        $outQuery = PurchaseOrder::selectRaw("strftime('{$fmt}', received_at) as period, SUM(grand_total) as total")
            ->where('status', 'received')
            ->whereNotNull('received_at')
            ->whereBetween('received_at', [$this->dateFrom . ' 00:00:00', $this->dateTo . ' 23:59:59'])
            ->groupByRaw("strftime('{$fmt}', received_at)");

        if (!empty($this->allowedIds)) $outQuery->whereIn('warehouse_id', $this->allowedIds);
        if ($this->warehouseId !== '') {
            $wId = (int) $this->warehouseId;
            if (empty($this->allowedIds) || in_array($wId, $this->allowedIds)) {
                $outQuery->where('warehouse_id', $wId);
            }
        }

        $cashOut = $outQuery->pluck('total', 'period')->map(fn($v) => (int) $v);

        $allPeriods = $cashIn->keys()->merge($cashOut->keys())->unique()->sort()->values();

        $rows = $allPeriods->map(fn($p) => [
            $p,
            $cashIn->get($p, 0),
            $cashOut->get($p, 0),
            $cashIn->get($p, 0) - $cashOut->get($p, 0),
        ]);

        // Totals row
        $rows->push([
            'TOTAL',
            (int) $cashIn->sum(),
            (int) $cashOut->sum(),
            (int) $cashIn->sum() - (int) $cashOut->sum(),
        ]);

        return $rows;
    }

    public function headings(): array
    {
        return ['Periode', 'Kas Masuk (Rp)', 'Kas Keluar (Rp)', 'Bersih (Rp)'];
    }

    public function title(): string
    {
        return 'Laporan Kas';
    }

    public function styles(Worksheet $sheet): array
    {
        $lastRow = $sheet->getHighestRow();
        return [
            1        => ['font' => ['bold' => true, 'size' => 11]],
            $lastRow => ['font' => ['bold' => true]],
        ];
    }
}
