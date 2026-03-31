import { usePage } from '@inertiajs/react';
import { AlertTriangle } from 'lucide-react';

interface License {
    valid: boolean;
    status: string;
    expires_at: string | null;
}

interface SharedData {
    auth: { user: { role: string } | null };
    license: License | null;
    [key: string]: unknown;
}

export default function LicenseExpiryBanner() {
    const { auth, license } = usePage<SharedData>().props;

    if (!license?.expires_at || auth.user?.role !== 'admin') return null;

    const expiresAt = new Date(license.expires_at);
    const now = new Date();
    const diffDays = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays > 14) return null;

    const isUrgent = diffDays <= 3;
    const expiredAlready = diffDays <= 0;

    const text = expiredAlready
        ? 'Lisensi telah berakhir. Segera hubungi administrator.'
        : `Lisensi berakhir dalam ${diffDays} hari (${expiresAt.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}). Segera perpanjang.`;

    return (
        <div className={`flex items-center gap-3 px-4 py-2.5 text-sm ${isUrgent ? 'bg-red-600 text-white' : 'bg-amber-50 border-b border-amber-200 text-amber-900'}`}>
            <AlertTriangle size={15} className="shrink-0" />
            <span className="flex-1">{text}</span>
        </div>
    );
}
