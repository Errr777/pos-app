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
        private string $dateTo
    ) {}

    public function collection()
    {
        return SaleHeader::with('cashier', 'customer')
            ->where('status', 'completed')
            ->whereBetween('occurred_at', [
                $this->dateFrom . ' 00:00:00',
                $this->dateTo . ' 23:59:59',
            ])
            ->orderBy('occurred_at')
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
