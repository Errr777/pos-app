import { useEffect, useState } from 'react';
import { usePage } from '@inertiajs/react';
import { X, CheckCircle2, AlertCircle } from 'lucide-react';
import { type SharedData } from '@/types';

export default function FlashMessage() {
    const { flash } = usePage<SharedData>().props;
    const [visible, setVisible] = useState(false);
    const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

    useEffect(() => {
        if (flash.success) {
            setMessage({ text: flash.success, type: 'success' });
            setVisible(true);
        } else if (flash.error) {
            setMessage({ text: flash.error, type: 'error' });
            setVisible(true);
        }
    }, [flash.success, flash.error]);

    useEffect(() => {
        if (!visible) return;
        const timer = setTimeout(() => setVisible(false), 4000);
        return () => clearTimeout(timer);
    }, [visible, message]);

    if (!visible || !message) return null;

    const isSuccess = message.type === 'success';

    return (
        <div
            className={`fixed top-4 right-4 z-50 flex items-start gap-3 rounded-xl border px-4 py-3 shadow-lg text-sm max-w-sm transition-all ${
                isSuccess
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-900/30 dark:border-emerald-800 dark:text-emerald-300'
                    : 'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-900/30 dark:border-rose-800 dark:text-rose-300'
            }`}
            role="alert"
        >
            {isSuccess
                ? <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                : <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-rose-600 dark:text-rose-400" />
            }
            <span className="flex-1">{message.text}</span>
            <button onClick={() => setVisible(false)} className="shrink-0 opacity-60 hover:opacity-100 transition-opacity">
                <X className="h-4 w-4" />
            </button>
        </div>
    );
}
