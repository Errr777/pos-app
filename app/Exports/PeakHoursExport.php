<?php

namespace App\Exports;

use App\Models\SaleHeader;
use Illuminate\Support\Facades\DB;
use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMultipleSheets;
use Maatwebsite\Excel\Concerns\WithStyles;
use Maatwebsite\Excel\Concerns\WithTitle;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

class PeakHoursExport implements WithMultipleSheets
{
    public function __construct(
        private string $dateFrom,
        private string $dateTo,
        private array  $allowedIds = [],
        private string $warehouseId = ''
    ) {}

    public function sheets(): array
    {
        [$matrix] = $this->buildMatrix();

        return [
            new PeakHoursCountSheet($matrix),
            new PeakHoursRevenueSheet($matrix),
        ];
    }

    private function buildMatrix(): array
    {
        $query = SaleHeader::select([
            DB::raw("CAST(strftime('%H', occurred_at) AS INTEGER) as hour"),
            DB::raw("CAST(strftime('%w', occurred_at) AS INTEGER) as day_of_week"),
            DB::raw('COUNT(*) as trx_count'),
            DB::raw('SUM(grand_total) as revenue'),
        ])
        ->where('status', 'completed')
        ->whereBetween('occurred_at', [$this->dateFrom . ' 00:00:00', $this->dateTo . ' 23:59:59'])
        ->groupBy('hour', 'day_of_week')
        ->orderBy('hour')
        ->orderBy('day_of_week');

        if (!empty($this->allowedIds)) {
            $query->whereIn('warehouse_id', $this->allowedIds);
        }
        if ($this->warehouseId !== '') {
            $wId = (int) $this->warehouseId;
            if (empty($this->allowedIds) || in_array($wId, $this->allowedIds)) {
                $query->where('warehouse_id', $wId);
            }
        }

        $rows = $query->get();

        $matrix = [];
        for ($h = 0; $h < 24; $h++) {
            for ($d = 0; $d < 7; $d++) {
                $matrix[$h][$d] = ['count' => 0, 'revenue' => 0];
            }
        }
        foreach ($rows as $row) {
            $matrix[(int)$row->hour][(int)$row->day_of_week] = [
                'count'   => (int) $row->trx_count,
                'revenue' => (int) $row->revenue,
            ];
        }

        return [$matrix];
    }
}

class PeakHoursCountSheet implements FromArray, WithHeadings, WithTitle, WithStyles, ShouldAutoSize
{
    public function __construct(private array $matrix) {}

    public function array(): array
    {
        $rows = [];
        for ($h = 0; $h < 24; $h++) {
            $rows[] = [
                sprintf('%02d:00', $h),
                $this->matrix[$h][1]['count'], // Mon
                $this->matrix[$h][2]['count'], // Tue
                $this->matrix[$h][3]['count'], // Wed
                $this->matrix[$h][4]['count'], // Thu
                $this->matrix[$h][5]['count'], // Fri
                $this->matrix[$h][6]['count'], // Sat
                $this->matrix[$h][0]['count'], // Sun
            ];
        }
        return $rows;
    }

    public function headings(): array
    {
        return ['Jam', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
    }

    public function title(): string
    {
        return 'Jumlah Transaksi';
    }

    public function styles(Worksheet $sheet): array
    {
        return [
            1 => ['font' => ['bold' => true, 'size' => 11]],
        ];
    }
}

class PeakHoursRevenueSheet implements FromArray, WithHeadings, WithTitle, WithStyles, ShouldAutoSize
{
    public function __construct(private array $matrix) {}

    public function array(): array
    {
        $rows = [];
        for ($h = 0; $h < 24; $h++) {
            $rows[] = [
                sprintf('%02d:00', $h),
                $this->matrix[$h][1]['revenue'],
                $this->matrix[$h][2]['revenue'],
                $this->matrix[$h][3]['revenue'],
                $this->matrix[$h][4]['revenue'],
                $this->matrix[$h][5]['revenue'],
                $this->matrix[$h][6]['revenue'],
                $this->matrix[$h][0]['revenue'],
            ];
        }
        return $rows;
    }

    public function headings(): array
    {
        return ['Jam', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
    }

    public function title(): string
    {
        return 'Revenue (Rp)';
    }

    public function styles(Worksheet $sheet): array
    {
        return [
            1 => ['font' => ['bold' => true, 'size' => 11]],
        ];
    }
}
