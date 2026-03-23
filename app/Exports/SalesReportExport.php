<?php

namespace App\Exports;

use App\Models\SaleHeader;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithTitle;
use Maatwebsite\Excel\Concerns\WithStyles;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

class SalesReportExport implements FromCollection, WithHeadings, WithTitle, WithStyles, ShouldAutoSize
{
    public function __construct(
        private string $dateFrom,
        private string $dateTo,
        private string $warehouseId = '',
        private string $method = '',
        private array $allowedIds = [],
    ) {}

    public function collection()
    {
        $q = SaleHeader::with('cashier', 'customer')
            ->where('status', 'completed')
            ->whereBetween('occurred_at', [
                $this->dateFrom . ' 00:00:00',
                $this->dateTo . ' 23:59:59',
            ]);

        if (! empty($this->allowedIds)) {
            $q->whereIn('warehouse_id', $this->allowedIds);
        }
        if ($this->warehouseId !== '') {
            $wId = (int) $this->warehouseId;
            if (empty($this->allowedIds) || in_array($wId, $this->allowedIds)) {
                $q->where('warehouse_id', $wId);
            }
        }
        if ($this->method !== '') {
            $q->where('payment_method', $this->method);
        }

        return $q->orderBy('occurred_at')
            ->get()
            ->map(fn($s) => [
                $s->sale_number,
                $s->occurred_at?->format('d/m/Y H:i'),
                $s->cashier?->name ?? '-',
                $s->customer?->name ?? 'Walk-in',
                $s->subtotal,
                $s->discount_amount,
                $s->grand_total,
                strtoupper($s->payment_method ?? '-'),
                strtoupper($s->status),
            ]);
    }

    public function headings(): array
    {
        return [
            'No. Transaksi',
            'Waktu',
            'Kasir',
            'Pelanggan',
            'Subtotal (Rp)',
            'Diskon (Rp)',
            'Grand Total (Rp)',
            'Metode Bayar',
            'Status',
        ];
    }

    public function title(): string
    {
        return 'Laporan Penjualan';
    }

    public function styles(Worksheet $sheet): array
    {
        return [
            1 => ['font' => ['bold' => true, 'size' => 11]],
        ];
    }
}
