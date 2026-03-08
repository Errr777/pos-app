import { LucideIcon } from 'lucide-react';
import type { Config } from 'ziggy-js';

export interface Auth {
    user: User;
}

export interface BreadcrumbItem {
    title: string;
    href: string;
}

export interface NavGroup {
    title: string;
    items: NavItem[];
}

export interface NavItem {
    title: string;
    href: string;
    icon?: LucideIcon | null;
    isActive?: boolean;
    single?: boolean;
    module?: string;
    items?: { title: string; href: string; icon?: string }[];
}

export type ModuleKey = 'dashboard' | 'items' | 'inventory' | 'reports' | 'users';

export interface ModulePermission {
    can_view: boolean;
    can_write: boolean;
    can_delete: boolean;
}

export type Permissions = Record<ModuleKey, ModulePermission>;

export interface SharedData {
    name: string;
    quote: { message: string; author: string };
    auth: Auth;
    ziggy: Config & { location: string };
    sidebarOpen: boolean;
    permissions: Permissions;
    [key: string]: unknown;
}

export interface User {
    id: number;
    name: string;
    email: string;
    role?: string;
    avatar?: string;
    email_verified_at: string | null;
    created_at: string;
    updated_at: string;
    [key: string]: unknown;
}
