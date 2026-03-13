<?php

namespace App\Exports;

use App\Models\Item;
use App\Models\SaleItem;
use Illuminate\Support\Facades\DB;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;
use Maatwebsite\Excel\Concerns\WithStyles;
use Maatwebsite\Excel\Concerns\WithTitle;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

class AbcAnalysisExport implements FromCollection, WithHeadings, WithMapping, WithTitle, WithStyles, ShouldAutoSize
{
    public function __construct(
        private string $dateFrom,
        private string $dateTo,
        private array  $allowedIds = [],
        private string $warehouseId = ''
    ) {}

    public function collection()
    {
        $salesSub = SaleItem::select(
                'sale_items.item_id',
                DB::raw('SUM(sale_items.quantity) as qty'),
                DB::raw('SUM(sale_items.line_total) as rev')
            )
            ->join('sale_headers', function ($j) {
                $j->on('sale_headers.id', '=', 'sale_items.sale_header_id')
                  ->where('sale_headers.status', 'completed')
                  ->whereBetween('sale_headers.occurred_at', [
                      $this->dateFrom . ' 00:00:00',
                      $this->dateTo   . ' 23:59:59',
                  ]);
                if (!empty($this->allowedIds)) {
                    $j->whereIn('sale_headers.warehouse_id', $this->allowedIds);
                }
                if ($this->warehouseId !== '') {
                    $wId = (int) $this->warehouseId;
                    if (empty($this->allowedIds) || in_array($wId, $this->allowedIds)) {
                        $j->where('sale_headers.warehouse_id', $wId);
                    }
                }
            })
            ->groupBy('sale_items.item_id');

        $items = Item::select([
                'items.id',
                'items.kode_item',
                'items.nama',
                'items.kategori',
                'items.harga_beli',
                'items.harga_jual',
                DB::raw('COALESCE(si.qty, 0) as total_sold'),
                DB::raw('COALESCE(si.rev, 0) as total_revenue'),
                DB::raw('COALESCE(si.qty * items.harga_beli, 0) as total_cogs'),
            ])
            ->leftJoinSub($salesSub, 'si', 'si.item_id', '=', 'items.id')
            ->orderByDesc('total_revenue')
            ->get();

        $grandTotal = (int) $items->sum('total_revenue');
        $cumulative = 0;
        $no = 0;

        return $items->map(function ($item) use ($grandTotal, &$cumulative, &$no) {
            $no++;
            $cumulative += (int) $item->total_revenue;
            $cumulativePct = $grandTotal > 0 ? round($cumulative / $grandTotal * 100, 1) : 0;
            $class  = $cumulativePct <= 80 ? 'A' : ($cumulativePct <= 95 ? 'B' : 'C');
            $profit = (int) $item->total_revenue - (int) $item->total_cogs;
            $margin = (int) $item->total_revenue > 0
                ? round($profit / (int) $item->total_revenue * 100, 1)
                : 0;

            return (object) [
                'no'            => $no,
                'code'          => $item->kode_item,
                'name'          => $item->nama,
                'category'      => $item->kategori,
                'totalSold'     => (int) $item->total_sold,
                'totalRevenue'  => (int) $item->total_revenue,
                'totalCogs'     => (int) $item->total_cogs,
                'profit'        => $profit,
                'margin'        => $margin,
                'cumulativePct' => $cumulativePct,
                'class'         => $class,
            ];
        });
    }

    public function headings(): array
    {
        return [
            'No', 'Kode', 'Nama Produk', 'Kategori',
            'Total Terjual', 'Revenue (Rp)', 'COGS (Rp)', 'Profit (Rp)',
            'Margin %', 'Kumulatif %', 'Kelas',
        ];
    }

    public function map($row): array
    {
        return [
            $row->no,
            $row->code,
            $row->name,
            $row->category,
            $row->totalSold,
            $row->totalRevenue,
            $row->totalCogs,
            $row->profit,
            $row->margin,
            $row->cumulativePct,
            $row->class,
        ];
    }

    public function title(): string
    {
        return 'ABC Analysis';
    }

    public function styles(Worksheet $sheet): array
    {
        return [
            1 => ['font' => ['bold' => true, 'size' => 11]],
        ];
    }
}
