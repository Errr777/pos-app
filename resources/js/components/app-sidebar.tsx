import { NavFooter } from '@/components/nav-footer';
import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarRail } from '@/components/ui/sidebar';
import { type NavItem } from '@/types';
import { Link } from '@inertiajs/react';

import {
  AudioWaveform,
  BookOpen,
  Folder, 
  LayoutGrid, 
  Bot,
  Command,
  Frame,
  GalleryVerticalEnd,
  Map,
  PieChart,
  Settings2,
  SquareTerminal,
  Settings,
  User2,
  ClipboardList,
  Coins,
  BoxIcon,
  Warehouse,
  LayoutList,
} from "lucide-react"
import AppLogo from './app-logo';

const mainNavItems: NavItem[] = [
    {
        title: 'Dashboard',
        href: '/dashboard',
        icon: LayoutGrid,
        single: true,
    },
    {
      title: "items",
      href: "#",
      icon: BoxIcon,
      isActive: true,
      single: false,
      items: [
        {
            title: "Daftar Produk",
            href: "/item/",
        },
        {
            title: "Tambah Produk",
            href: "/tambah_item",
        },
        {
            title: "Kategori Produk",
            href: "/category/",
        },
        {
            title: "Stok Minimum",
            href: "/stock_alerts",
        },
        {
            title: "Impor Produk",
            href: "/items/import",
        },
        {
            title: "Ekspor Produk",
            href: "/items/export",
        },
        ],
    },
    {
      title: "Inventory",
      href: "#",
      icon: LayoutList,
      single: false,
      items: [
        {
            title: "Histori Inventaris",
            href: "/inventory",
        },
        {
            title: "Log Stok",
            href: "/inventory/stock_log",
        },
        {
            title: "Stok Masuk",
            href: "/inventory/stock_in",
        },
        {
            title: "Stok Keluar",
            href: "/inventory/stock_out",
        },
        {
            title: "Mutasi Stok",
            href: "/inventory/mutation",
        },
        {
            title: "Ekspor Mutasi",
            href: "/inventory/export",
        },
        ],
    },
    {
      title: "Finance",
      href: "#",
      icon: Coins,
      single: false,
      items: [
        {
            title: "Semua Transaksi",
            href: "/transactions",
            icon: "list",
        },
        {
            title: "Tambah Transaksi",
            href: "/transactions/new",
            icon: "plus-circle",
        },
        {
            title: "Transaksi Masuk",
            href: "/transactions/income",
            icon: "arrow-down",
        },
        {
            title: "Transaksi Keluar",
            href: "/transactions/expense",
            icon: "arrow-up",
        },
        {
            title: "Kategori Transaksi",
            href: "/transactions/categories",
            icon: "layers",
        },
        {
            title: "Ekspor Transaksi",
            href: "/transactions/export",
            icon: "download",
        },
        ],
    },
    {
      title: "Reports",
      href: "#",
      icon: ClipboardList,
      single: false,
      items: [
        {
            title: "Laporan Kas",
            href: "/reports/cashflow",
            icon: "file-text",
        },
        {
            title: "Laporan Penjualan",
            href: "/reports/sales",
            icon: "shopping-bag",
        },
        {
            title: "Laporan Stok Barang",
            href: "/report/stock",
            icon: "package",
        },
        {
            title: "Grafik Penjualan",
            href: "/report/sales-graph",
            icon: "bar-chart-2",
        },
        {
            title: "Grafik Kas",
            href: "/report/cash-graph",
            icon: "pie-chart",
        },
        {
            title: "Ekspor Laporan",
            href: "/report/export",
            icon: "download",
        },
        ],
    },
    {
      title: "Settings",
      href: "#",
      icon: Settings2,
      single: false,
      items: [
        {
            title: "Profil Usaha",
            href: "/settings/business-profile",
            icon: "briefcase",
        },
        {
            title: "Manajemen User",
            href: "/settings/users",
            icon: "users",
        },
        {
            title: "Manajemen Role & Akses",
            href: "/settings/roles",
            icon: "key",
        },
        {
            title: "Pengaturan Aplikasi",
            href: "/settings/app",
            icon: "settings",
        },
        {
            title: "Backup & Restore Data",
            href: "/settings/backup",
            icon: "database",
        },
        {
            title: "Integrasi API",
            href: "/settings/integrations",
            icon: "plug",
        },
        {
            title: "Tema & Tampilan",
            href: "/settings/theme",
            icon: "moon",
        },
        ],
    },
    {
      title: "User Management",
      href: "#",
      icon: User2,
      single: false,
      items: [
        {
            title: "Daftar Pengguna",
            href: "/users",
            icon: "users",
        },
        {
            title: "Tambah Pengguna",
            href: "/users/new",
            icon: "user-plus",
        },
        {
            title: "Role & Hak Akses",
            href: "/users/roles",
            icon: "shield",
        },
        {
            title: "Aktivitas Pengguna",
            href: "/users/activity",
            icon: "activity",
        },
        {
            title: "Reset Password",
            href: "/users/reset-password",
            icon: "refresh-cw",
        },
        {
            title: "Ekspor Data Pengguna",
            href: "/users/export",
            icon: "download",
        },
        ],
    },
];

const footerNavItems: NavItem[] = [
    {
        title: 'Repository',
        href: 'https://github.com/laravel/react-starter-kit',
        icon: Folder,
    },
    {
        title: 'Documentation',
        href: 'https://laravel.com/docs/starter-kits#react',
        icon: BookOpen,
    },
];

export function AppSidebar() {
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
                <NavMain items={mainNavItems} />
            </SidebarContent>

            <SidebarFooter>
                <NavFooter items={footerNavItems} className="mt-auto" />
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}
