<?php

namespace App\Exports;

use App\Models\Item;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithTitle;
use Maatwebsite\Excel\Concerns\WithStyles;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

class StockReportExport implements FromCollection, WithHeadings, WithTitle, WithStyles, ShouldAutoSize
{
    public function collection()
    {
        return Item::with('kategoriRelation')
            ->orderBy('nama')
            ->get()
            ->map(fn($i) => [
                $i->kode_item ?? '-',
                $i->nama,
                $i->kategoriRelation?->nama ?? $i->kategori ?? '-',
                (int) $i->stok,
                (int) $i->stok_minimal,
                $i->stok < $i->stok_minimal ? 'MINIM' : 'AMAN',
                (int) $i->harga_beli,
                (int) $i->harga_jual,
                (int) ($i->stok * $i->harga_beli),
            ]);
    }

    public function headings(): array
    {
        return [
            'Kode Item',
            'Nama Produk',
            'Kategori',
            'Stok',
            'Stok Minimal',
            'Status',
            'Harga Beli (Rp)',
            'Harga Jual (Rp)',
            'Nilai Stok (Rp)',
        ];
    }

    public function title(): string
    {
        return 'Laporan Stok';
    }

    public function styles(Worksheet $sheet): array
    {
        return [
            1 => ['font' => ['bold' => true, 'size' => 11]],
        ];
    }
}
