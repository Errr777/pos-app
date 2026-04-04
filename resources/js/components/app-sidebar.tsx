import { NavFooter } from '@/components/nav-footer';
import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarRail } from '@/components/ui/sidebar';
import { type NavItem, type Permissions } from '@/types';
import { Link, usePage } from '@inertiajs/react';
import {
  LayoutGrid,
  User2,
  ClipboardList,
  BoxIcon,
  LayoutList,
  Warehouse,
  Truck,
  Users,
  ShoppingCart,
  FileText,
  Tag,
  Receipt,
  Settings2,
  Database,
} from 'lucide-react';
import AppLogo from './app-logo';

const allNavItems: NavItem[] = [
    {
        title: 'Dashboard',
        href: '/dashboard',
        icon: LayoutGrid,
        iconColor: 'text-indigo-400',
        single: true,
        module: 'dashboard',
    },
    {
        title: 'Produk',
        href: '#',
        icon: BoxIcon,
        iconColor: 'text-emerald-400',
        single: false,
        module: 'items',
        items: [
            { title: 'Daftar Produk',   href: '/item/' },
            { title: 'Tambah Produk',   href: '/tambah_item' },
            { title: 'Kategori Produk', href: '/category/' },
            { title: 'Tags Produk',     href: '/tags' },
            { title: 'Stok Minimum',    href: '/stock_alerts' },
        ],
    },
    {
        title: 'Inventory',
        href: '#',
        icon: LayoutList,
        iconColor: 'text-amber-400',
        single: false,
        module: 'inventory',
        items: [
            { title: 'Histori Inventaris', href: '/inventory' },
            { title: 'Log Stok',           href: '/inventory/stock_log' },
            { title: 'Stok Masuk',         href: '/inventory/stock_in' },
            { title: 'Stok Keluar',        href: '/inventory/stock_out' },
            { title: 'Transfer Stok',      href: '/inventory/transfers' },
            { title: 'Surat Jalan',        href: '/inventory/delivery-orders' },
            { title: 'Penyesuaian Stok',   href: '/inventory/adjustments' },
            { title: 'Stock Opname',       href: '/inventory/opname' },
        ],
    },
    {
        title: 'Outlet',
        href: '/warehouses',
        icon: Warehouse,
        iconColor: 'text-cyan-400',
        single: true,
        module: 'warehouses',
    },
    {
        title: 'Supplier',
        href: '/suppliers',
        icon: Truck,
        iconColor: 'text-orange-400',
        single: true,
        module: 'suppliers',
    },
    {
        title: 'Pelanggan',
        href: '#',
        icon: Users,
        iconColor: 'text-pink-400',
        single: false,
        module: 'customers',
        items: [
            { title: 'Daftar Pelanggan', href: '/customers' },
            { title: 'Kredit Pelanggan', href: '/pos/kredit' },
        ],
    },
    {
        title: 'Transaksi',
        href: '#',
        icon: ShoppingCart,
        iconColor: 'text-violet-400',
        single: false,
        module: 'pos',
        items: [
            { title: 'Terminal POS',       href: '/pos/terminal' },
            { title: 'Riwayat Penjualan',  href: '/pos' },
            { title: 'Retur',              href: '/returns', module: 'returns' },
            { title: 'Transaksi Pending',  href: '/pos/pending' },
        ],
    },
    {
        title: 'Purchase Order',
        href: '/purchase-orders',
        icon: FileText,
        iconColor: 'text-blue-400',
        module: 'purchase_orders',
        items: [
            { title: 'Semua PO', href: '/purchase-orders' },
            { title: 'Saran Reorder', href: '/purchase-orders/suggestions' },
        ],
    },
    {
        title: 'Promo',
        href: '/promotions',
        icon: Tag,
        iconColor: 'text-pink-400',
        single: true,
        module: 'pos',
    },
    {
        title: 'Beban',
        href: '/expenses',
        icon: Receipt,
        iconColor: 'text-orange-400',
        single: true,
        module: 'reports',
    },
    {
        title: 'Laporan',
        href: '#',
        icon: ClipboardList,
        iconColor: 'text-amber-300',
        single: false,
        module: 'reports',
        items: [
            { title: 'Laporan Stok',      href: '/report/stock' },
            { title: 'Laporan Penjualan', href: '/report/sales' },
            { title: 'Laporan Kas',       href: '/report/cashflow' },
            { title: 'Laba Rugi',         href: '/report/profit-loss' },
            { title: 'Analisis ABC',      href: '/report/abc' },
            { title: 'Jam Ramai',         href: '/report/peak-hours' },
            { title: 'Perbandingan Cabang', href: '/report/branches' },
        ],
    },
    {
        title: 'Pengguna',
        href: '#',
        icon: User2,
        iconColor: 'text-slate-400',
        single: false,
        module: 'users',
        items: [
            { title: 'Daftar Pengguna', href: '/users' },
            { title: 'Role & Akses',    href: '/users/roles' },
            { title: 'Log Aktivitas',   href: '/audit-log', adminOnly: true },
        ],
    },
];

const adminNavItems: NavItem[] = [
    {
        title: 'Pengaturan Toko',
        href: '/settings/store',
        icon: Settings2,
        iconColor: 'text-slate-400',
        single: true,
    },
    {
        title: 'Backup Database',
        href: '/settings/backups',
        icon: Database,
        iconColor: 'text-slate-400',
        single: true,
    },
];

const footerNavItems: NavItem[] = [];

export function AppSidebar() {
    const { props } = usePage<{ permissions: Permissions; auth: { user: { role?: string } }; license?: { modules: string[] } | null }>();
    const permissions = props.permissions ?? {} as Permissions;
    const isAdmin = props.auth?.user?.role === 'admin';
    const licenseModules = props.license?.modules ?? null; // null = no license configured (allow all)

    const visibleItems = [
        ...allNavItems
            .filter((item) => {
                if (!item.module) return true;
                // Check license module access (skip if no license configured)
                if (licenseModules !== null && !licenseModules.includes(item.module)) return false;
                return permissions[item.module as keyof Permissions]?.can_view ?? false;
            })
            .map((item) => ({
                ...item,
                items: item.items?.filter((sub) => {
                    if (sub.adminOnly && !isAdmin) return false;
                    if (sub.module && !(permissions[sub.module as keyof Permissions]?.can_view ?? false)) return false;
                    return true;
                }),
            })),
        ...(isAdmin ? adminNavItems : []),
    ];

    return (
        <Sidebar collapsible="icon" variant="inset">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
                            <Link href="/dashboard" prefetch>
                                <AppLogo />
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent>
                <NavMain items={visibleItems} />
            </SidebarContent>

            <SidebarFooter>
                <NavFooter items={footerNavItems} className="mt-auto" />
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}
