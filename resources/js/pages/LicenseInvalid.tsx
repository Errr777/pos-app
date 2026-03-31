import { usePage } from '@inertiajs/react';
import { ShieldAlert } from 'lucide-react';

const REASON_MSG: Record<string, string> = {
    suspended: 'Lisensi aplikasi ini telah disuspend. Hubungi administrator.',
    expired:   'Lisensi aplikasi ini telah expired. Perpanjang untuk melanjutkan.',
    not_found: 'Lisensi tidak ditemukan di server. Hubungi administrator.',
};

export default function LicenseInvalid() {
    const { flash } = usePage<any>().props;
    const reason = (flash as any)?.reason ?? 'unknown';

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="max-w-sm w-full text-center space-y-4 p-8">
                <div className="flex justify-center">
                    <ShieldAlert size={48} className="text-red-500" />
                </div>
                <h1 className="text-xl font-bold text-gray-900">Lisensi Tidak Valid</h1>
                <p className="text-sm text-gray-600">
                    {REASON_MSG[reason] ?? 'Terjadi masalah dengan lisensi aplikasi. Hubungi administrator.'}
                </p>
                <p className="text-xs text-gray-400">Kode: {reason}</p>
            </div>
        </div>
    );
}
