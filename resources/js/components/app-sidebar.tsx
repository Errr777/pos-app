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
  RotateCcw,
  Tag,
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
            { title: 'Penyesuaian Stok',   href: '/inventory/adjustments' },
            { title: 'Stock Opname',       href: '/inventory/opname' },
        ],
    },
    {
        title: 'Gudang',
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
        href: '/customers',
        icon: Users,
        iconColor: 'text-pink-400',
        single: true,
        module: 'customers',
    },
    {
        title: 'Kasir',
        href: '#',
        icon: ShoppingCart,
        iconColor: 'text-violet-400',
        single: false,
        module: 'pos',
        items: [
            { title: 'Terminal POS',      href: '/pos/terminal' },
            { title: 'Riwayat Penjualan', href: '/pos' },
        ],
    },
    {
        title: 'Purchase Order',
        href: '/purchase-orders',
        icon: FileText,
        iconColor: 'text-blue-400',
        single: true,
        module: 'purchase_orders',
    },
    {
        title: 'Retur',
        href: '/returns',
        icon: RotateCcw,
        iconColor: 'text-rose-400',
        single: true,
        module: 'returns',
    },
    {
        title: 'Promo',
        href: '/promotions',
        icon: Tag,
        iconColor: 'text-pink-400',
        single: true,
        module: 'items',
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
        ],
    },
];

const footerNavItems: NavItem[] = [];

export function AppSidebar() {
    const { props } = usePage<{ permissions: Permissions }>();
    const permissions = props.permissions ?? {} as Permissions;

    const visibleItems = allNavItems.filter((item) => {
        if (!item.module) return true;
        return permissions[item.module as keyof Permissions]?.can_view ?? false;
    });

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
