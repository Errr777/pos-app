import { router, usePage } from '@inertiajs/react';
import { Bell, Package, AlertTriangle, CreditCard } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';

interface SharedData {
    notifications?: { lowStockCount: number; pendingPoCount: number; overdueInstallmentCount: number };
    [key: string]: unknown;
}

export function NotificationBell() {
    const { notifications } = usePage<SharedData>().props;
    const lowStock       = notifications?.lowStockCount         ?? 0;
    const pendingPo      = notifications?.pendingPoCount        ?? 0;
    const overdueCicilan = notifications?.overdueInstallmentCount ?? 0;
    const total          = lowStock + pendingPo + overdueCicilan;

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative h-8 w-8">
                    <Bell size={16} />
                    {total > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white leading-none">
                            {total > 99 ? '99+' : total}
                        </span>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 p-0">
                <div className="px-4 py-3 border-b">
                    <p className="text-sm font-semibold">Notifikasi</p>
                </div>
                {total === 0 ? (
                    <p className="px-4 py-6 text-center text-sm text-muted-foreground">Tidak ada notifikasi</p>
                ) : (
                    <div className="divide-y">
                        {lowStock > 0 && (
                            <button
                                onClick={() => router.visit(route('item.low_stock'))}
                                className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-muted transition-colors"
                            >
                                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600">
                                    <AlertTriangle size={14} />
                                </div>
                                <div>
                                    <p className="text-sm font-medium">{lowStock} item stok minim</p>
                                    <p className="text-xs text-muted-foreground">Stok di bawah batas minimum</p>
                                </div>
                            </button>
                        )}
                        {pendingPo > 0 && (
                            <button
                                onClick={() => router.visit(route('po.index'))}
                                className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-muted transition-colors"
                            >
                                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                                    <Package size={14} />
                                </div>
                                <div>
                                    <p className="text-sm font-medium">{pendingPo} PO menunggu</p>
                                    <p className="text-xs text-muted-foreground">Draft / dipesan / sebagian diterima</p>
                                </div>
                            </button>
                        )}
                        {overdueCicilan > 0 && (
                            <button
                                onClick={() => router.visit(route('pos.kredit'))}
                                className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-muted transition-colors"
                            >
                                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400">
                                    <CreditCard size={14} />
                                </div>
                                <div>
                                    <p className="text-sm font-medium">{overdueCicilan} cicilan jatuh tempo</p>
                                    <p className="text-xs text-muted-foreground">Pembayaran menunggu atau lewat jatuh tempo</p>
                                </div>
                            </button>
                        )}
                    </div>
                )}
            </PopoverContent>
        </Popover>
    );
}
