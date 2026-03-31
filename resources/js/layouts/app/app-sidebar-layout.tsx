import { AppContent } from '@/components/app-content';
import { AppShell } from '@/components/app-shell';
import { AppSidebar } from '@/components/app-sidebar';
import { AppSidebarHeader } from '@/components/app-sidebar-header';
import FlashMessage from '@/components/FlashMessage';
import LicenseExpiryBanner from '@/components/LicenseExpiryBanner';
import { OfflineIndicator } from '@/components/offline-indicator';
import { useNetwork } from '@/hooks/use-network';
import { useSyncQueue } from '@/hooks/use-sync-queue';
import { type BreadcrumbItem } from '@/types';
import { type PropsWithChildren } from 'react';

export default function AppSidebarLayout({ children, breadcrumbs = [] }: PropsWithChildren<{ breadcrumbs?: BreadcrumbItem[] }>) {
    const isOnline = useNetwork();
    const { pendingCount, isSyncing, syncNow } = useSyncQueue(isOnline);

    return (
        <AppShell variant="sidebar">
            <AppSidebar />
            <AppContent variant="sidebar" className="overflow-x-hidden">
                <AppSidebarHeader breadcrumbs={breadcrumbs} />
                <LicenseExpiryBanner />
                {children}
            </AppContent>
            <FlashMessage />
            <OfflineIndicator
                isOnline={isOnline}
                pendingCount={pendingCount}
                isSyncing={isSyncing}
                onSyncNow={syncNow}
            />
        </AppShell>
    );
}
