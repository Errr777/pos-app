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
} from 'lucide-react';
import AppLogo from './app-logo';

const allNavItems: NavItem[] = [
    {
        title: 'Dashboard',
        href: '/dashboard',
        icon: LayoutGrid,
        single: true,
        module: 'dashboard',
    },
    {
        title: 'Produk',
        href: '#',
        icon: BoxIcon,
        single: false,
        module: 'items',
        items: [
            { title: 'Daftar Produk',   href: '/item/' },
            { title: 'Tambah Produk',   href: '/tambah_item' },
            { title: 'Kategori Produk', href: '/category/' },
            { title: 'Stok Minimum',    href: '/stock_alerts' },
        ],
    },
    {
        title: 'Inventory',
        href: '#',
        icon: LayoutList,
        single: false,
        module: 'inventory',
        items: [
            { title: 'Histori Inventaris', href: '/inventory' },
            { title: 'Log Stok',           href: '/inventory/stock_log' },
            { title: 'Stok Masuk',         href: '/inventory/stock_in' },
            { title: 'Stok Keluar',        href: '/inventory/stock_out' },
        ],
    },
    {
        title: 'Laporan',
        href: '#',
        icon: ClipboardList,
        single: false,
        module: 'reports',
        items: [
            { title: 'Laporan Stok',      href: '/report/stock' },
            { title: 'Laporan Penjualan', href: '/report/sales' },
            { title: 'Laporan Kas',       href: '/report/cashflow' },
        ],
    },
    {
        title: 'Pengguna',
        href: '#',
        icon: User2,
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
