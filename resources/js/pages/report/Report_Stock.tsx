import { useMemo, useState } from 'react';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import { Search, Eye, Download, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/components/ui/popover';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { format } from 'date-fns';

// 🧭 Breadcrumbs
const breadcrumbs: BreadcrumbItem[] = [
  { title: 'Dashboard', href: '/dashboard' },
  { title: 'Laporan Stok', href: '/stock-report' },
];

// 📦 Dummy log stok
const initialStockLogs = Array.from({ length: 30 }).map((_, idx) => ({
  id: idx + 1,
  code: `BRG-${1000 + idx}`,
  name: `Produk ${String.fromCharCode(65 + (idx % 26))}`,
  description: `Deskripsi produk ${idx + 1} untuk testing laporan stok`,
  category: ['Makanan', 'Minuman', 'Alat Tulis', 'Elektronik'][idx % 4],
  qrcode: `QRCODE-${1000 + idx}`,
  stock_in: Math.floor(Math.random() * 50),
  stock_out: Math.floor(Math.random() * 30),
  stock_min: 10 + Math.floor(Math.random() * 10),
  date: new Date(Date.now() - idx * 86400000).toISOString().split('T')[0],
}));

type SortKey =
  | 'code'
  | 'name'
  | 'category'
  | 'stock_in'
  | 'stock_out'
  | 'stock_min'
  | 'date'
  | 'stock_final';

type SortConfig = {
  key: SortKey;
  direction: 'asc' | 'desc';
};

export default function StockReport() {
  const [logs] = useState(initialStockLogs);
  const [query, setQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // 📄 Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // 📅 Date Range
  const [dateFrom, setDateFrom] = useState<Date | null>(null);
  const [dateTo, setDateTo] = useState<Date | null>(null);

  // 🔽 Sorting
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);

  const handleSort = (key: SortKey) => {
    setCurrentPage(1); // reset ke halaman 1 saat ganti sort
    setSortConfig((prev) => {
      if (!prev || prev.key !== key) return { key, direction: 'asc' };
      return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
    });
  };

  const sortIcon = (key: SortKey) => {
    if (sortConfig?.key !== key) return '⇅';
    return sortConfig.direction === 'asc' ? '▲' : '▼';
  };

  // 🔍 Filtering by query + date range
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchesQuery =
        log.name.toLowerCase().includes(query.toLowerCase()) ||
        log.code.toLowerCase().includes(query.toLowerCase()) ||
        log.category.toLowerCase().includes(query.toLowerCase()) ||
        log.qrcode.toLowerCase().includes(query.toLowerCase());

      const logDate = new Date(log.date);
      const matchesDate =
        (!dateFrom || logDate >= dateFrom) && (!dateTo || logDate <= dateTo);

      return matchesQuery && matchesDate;
    });
  }, [logs, query, dateFrom, dateTo]);

  // 🔽 Apply sorting (setelah filter, sebelum paginate & export)
  const sortedLogs = useMemo(() => {
    if (!sortConfig) return filteredLogs;

    const getVal = (log: typeof filteredLogs[number], key: SortKey) => {
      if (key === 'stock_final') return log.stock_in - log.stock_out;
      if (key === 'date') return new Date(log.date).getTime();
      return (log as any)[key];
    };

    const dir = sortConfig.direction === 'asc' ? 1 : -1;

    return [...filteredLogs].sort((a, b) => {
      const aVal = getVal(a, sortConfig.key);
      const bVal = getVal(b, sortConfig.key);

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return (aVal - bVal) * dir;
      }
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return aVal.localeCompare(bVal, undefined, { sensitivity: 'base' }) * dir;
      }
      // fallback (mis. date as number timestamp)
      return ((aVal as number) - (bVal as number)) * dir;
    });
  }, [filteredLogs, sortConfig]);

  // 📄 Pagination logic
  const totalPages = Math.ceil(sortedLogs.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedLogs = sortedLogs.slice(startIndex, startIndex + itemsPerPage);

  // 📥 Export CSV (mengikuti urutan sorting yang aktif)
  const handleExportCSV = () => {
    const header =
      'Kode,Nama,Deskripsi,Kategori,QR Code,Stok Masuk,Stok Keluar,Stok Minimal,Stok Akhir,Tanggal\n';
    const rows = sortedLogs
      .map(
        (log) =>
          `${log.code},"${log.name}","${log.description}",${log.category},${log.qrcode},${log.stock_in},${log.stock_out},${log.stock_min},${log.stock_in - log.stock_out},${log.date}`
      )
      .join('\n');

    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'laporan_stok.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleViewDetail = (item: any) => {
    setSelectedItem(item);
    setIsModalOpen(true);
  };

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title="Laporan Stok" />
      <div className="relative min-h-[100vh] flex-1 overflow-hidden rounded-xl border border-sidebar-border/70 md:min-h-min dark:border-sidebar-border bg-white dark:bg-background p-4">
        {/* 🔎 Search, Date Range & Export */}
        <div className="flex flex-col md:flex-row justify-between mb-4 gap-2">
          <div className="flex gap-2 w-full md:w-auto">
            {/* Search */}
            <div className="relative w-full md:w-64">
              <span className="absolute inset-y-0 left-3 flex items-center text-muted-foreground pointer-events-none">
                <Search size={18} />
              </span>
              <input
                type="text"
                placeholder="Cari stok..."
                className="w-full px-10 py-2 border rounded-lg bg-muted pl-12"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setCurrentPage(1); // reset ke halaman 1
                }}
              />
            </div>

            {/* Date From */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-40 justify-start">
                  <Calendar size={16} className="mr-2" />
                  {dateFrom ? format(dateFrom, 'dd-MM-yyyy') : 'Dari'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-slate-700 text-white">
                <CalendarPicker
                  mode="single"
                  selected={dateFrom ?? undefined}
                  onSelect={(date) => {
                    setDateFrom(date || null);
                    setCurrentPage(1);
                  }}
                />
              </PopoverContent>
            </Popover>

            {/* Date To */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-40 justify-start">
                  <Calendar size={16} className="mr-2" />
                  {dateTo ? format(dateTo, 'dd-MM-yyyy') : 'Sampai'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-slate-700 text-white">
                <CalendarPicker
                  mode="single"
                  selected={dateTo ?? undefined}
                  onSelect={(date) => {
                    setDateTo(date || null);
                    setCurrentPage(1);
                  }}
                />
              </PopoverContent>
            </Popover>
          </div>

          <Button onClick={handleExportCSV} className="gap-2">
            <Download size={16} />
            <span>Export CSV</span>
          </Button>
        </div>

        {/* 📊 Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full border rounded-xl">
            <thead>
              <tr className="bg-muted">
                <th
                  className="px-4 py-2 text-left cursor-pointer select-none"
                  onClick={() => handleSort('code')}
                  aria-sort={sortConfig?.key === 'code' ? sortConfig.direction : 'none'}
                >
                  Kode {sortIcon('code')}
                </th>
                <th
                  className="px-4 py-2 text-left cursor-pointer select-none"
                  onClick={() => handleSort('name')}
                  aria-sort={sortConfig?.key === 'name' ? sortConfig.direction : 'none'}
                >
                  Nama {sortIcon('name')}
                </th>
                <th
                  className="px-4 py-2 text-left cursor-pointer select-none"
                  onClick={() => handleSort('category')}
                  aria-sort={sortConfig?.key === 'category' ? sortConfig.direction : 'none'}
                >
                  Kategori {sortIcon('category')}
                </th>
                <th
                  className="px-4 py-2 text-left cursor-pointer select-none"
                  onClick={() => handleSort('stock_in')}
                  aria-sort={sortConfig?.key === 'stock_in' ? sortConfig.direction : 'none'}
                >
                  Stok Masuk {sortIcon('stock_in')}
                </th>
                <th
                  className="px-4 py-2 text-left cursor-pointer select-none"
                  onClick={() => handleSort('stock_out')}
                  aria-sort={sortConfig?.key === 'stock_out' ? sortConfig.direction : 'none'}
                >
                  Stok Keluar {sortIcon('stock_out')}
                </th>
                <th
                  className="px-4 py-2 text-left cursor-pointer select-none"
                  onClick={() => handleSort('stock_final')}
                  aria-sort={sortConfig?.key === 'stock_final' ? sortConfig.direction : 'none'}
                >
                  Stok Akhir {sortIcon('stock_final')}
                </th>
                <th
                  className="px-4 py-2 text-left cursor-pointer select-none"
                  onClick={() => handleSort('date')}
                  aria-sort={sortConfig?.key === 'date' ? sortConfig.direction : 'none'}
                >
                  Tanggal {sortIcon('date')}
                </th>
                <th className="px-4 py-2 text-left">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {paginatedLogs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-6 text-muted-foreground">
                    Tidak ada data stok
                  </td>
                </tr>
              ) : (
                paginatedLogs.map((log) => (
                  <tr key={log.id} className="border-b last:border-b-0">
                    <td className="px-4 py-2">{log.code}</td>
                    <td className="px-4 py-2">{log.name}</td>
                    <td className="px-4 py-2">{log.category}</td>
                    <td className="px-4 py-2">{log.stock_in}</td>
                    <td className="px-4 py-2">{log.stock_out}</td>
                    <td className="px-4 py-2 font-semibold">
                      {log.stock_in - log.stock_out}
                    </td>
                    <td className="px-4 py-2">{log.date}</td>
                    <td className="px-4 py-2">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => handleViewDetail(log)}
                              className="text-primary border border-white hover:bg-primary hover:text-slate-600 hover:border-0 p-2 rounded-full transition"
                              aria-label="Lihat"
                            >
                              <Eye size={18} />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>Lihat Detail</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 📄 Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex justify-between items-center mt-4">
            <p className="text-sm text-muted-foreground">
              Menampilkan {startIndex + 1} -{' '}
              {Math.min(startIndex + itemsPerPage, sortedLogs.length)} dari{' '}
              {sortedLogs.length} data
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => p - 1)}
              >
                Prev
              </Button>
              {Array.from({ length: totalPages }).map((_, i) => (
                <Button
                  key={i}
                  variant={i + 1 === currentPage ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCurrentPage(i + 1)}
                >
                  {i + 1}
                </Button>
              ))}
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}

        {/* 📋 Detail Modal */}
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Detail Stok</DialogTitle>
              <DialogDescription>
                Informasi lengkap barang dan pergerakan stok.
              </DialogDescription>
            </DialogHeader>
            {selectedItem && (
              <div className="space-y-2">
                <p><strong>Kode:</strong> {selectedItem.code}</p>
                <p><strong>Nama:</strong> {selectedItem.name}</p>
                <p><strong>Deskripsi:</strong> {selectedItem.description}</p>
                <p><strong>Kategori:</strong> {selectedItem.category}</p>
                <p><strong>QR Code:</strong> {selectedItem.qrcode}</p>
                <p><strong>Stok Masuk:</strong> {selectedItem.stock_in}</p>
                <p><strong>Stok Keluar:</strong> {selectedItem.stock_out}</p>
                <p><strong>Stok Minimal:</strong> {selectedItem.stock_min}</p>
                <p><strong>Stok Akhir:</strong> {selectedItem.stock_in - selectedItem.stock_out}</p>
                <p><strong>Tanggal:</strong> {selectedItem.date}</p>
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${selectedItem.qrcode}`}
                  alt="QR Code"
                  className="mx-auto mt-4 rounded-lg border p-3"
                />
              </div>
            )}
            <DialogFooter>
              <Button onClick={() => setIsModalOpen(false)}>Tutup</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}