// resources/js/components/ui/toast.tsx
import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';

type ToastVariant = 'default' | 'success' | 'destructive' | 'warning' | 'info';

type ToastProps = {
  id?: string | number;
  title?: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
};

let addToastInternal: ((t: ToastProps) => void) | null = null;

export function useToast() {
  return {
    toast: (t: ToastProps) => {
      if (addToastInternal) addToastInternal(t);
      else console.warn('Toaster not mounted yet:', t);
    },
  };
}

const VARIANT_STYLES: Record<ToastVariant, { bg: string; border: string; icon: React.ReactNode; bar: string }> = {
  success: {
    bg: 'bg-white dark:bg-slate-900',
    border: 'border-emerald-400',
    icon: <CheckCircle2 size={40} className="text-emerald-500" />,
    bar: 'bg-emerald-500',
  },
  destructive: {
    bg: 'bg-white dark:bg-slate-900',
    border: 'border-red-400',
    icon: <XCircle size={40} className="text-red-500" />,
    bar: 'bg-red-500',
  },
  warning: {
    bg: 'bg-white dark:bg-slate-900',
    border: 'border-amber-400',
    icon: <AlertTriangle size={40} className="text-amber-500" />,
    bar: 'bg-amber-500',
  },
  info: {
    bg: 'bg-white dark:bg-slate-900',
    border: 'border-blue-400',
    icon: <Info size={40} className="text-blue-500" />,
    bar: 'bg-blue-500',
  },
  default: {
    bg: 'bg-white dark:bg-slate-900',
    border: 'border-slate-300',
    icon: <Info size={40} className="text-slate-500" />,
    bar: 'bg-slate-500',
  },
};

function ToastCard({ t, onClose }: { t: ToastProps & { id: number }; onClose: () => void }) {
  const variant = t.variant ?? 'default';
  const styles = VARIANT_STYLES[variant];
  const duration = t.duration ?? 4000;
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    const step = 100 / (duration / 50);
    const interval = setInterval(() => {
      setProgress((p) => {
        if (p <= 0) { clearInterval(interval); return 0; }
        return p - step;
      });
    }, 50);
    return () => clearInterval(interval);
  }, [duration]);

  return (
    <div
      role="alert"
      className={`
        relative w-full max-w-sm rounded-2xl border-2 shadow-2xl overflow-hidden
        ${styles.bg} ${styles.border}
        animate-in fade-in zoom-in-95 duration-200
      `}
    >
      {/* Progress bar */}
      <div
        className={`absolute top-0 left-0 h-1 transition-all ease-linear ${styles.bar}`}
        style={{ width: `${progress}%`, transitionDuration: '50ms' }}
      />

      <div className="p-6 flex flex-col items-center text-center gap-3">
        {/* Icon */}
        <div className="mt-1">{styles.icon}</div>

        {/* Title */}
        {t.title && (
          <p className="text-xl font-bold text-slate-800 dark:text-slate-100 leading-snug">
            {t.title}
          </p>
        )}

        {/* Description */}
        {t.description && (
          <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
            {t.description}
          </p>
        )}

        {/* Close button */}
        <button
          onClick={onClose}
          className="mt-1 px-6 py-2 rounded-xl text-sm font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
        >
          OK
        </button>
      </div>

      {/* X dismiss */}
      <button
        onClick={onClose}
        className="absolute top-3 right-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
      >
        <X size={16} />
      </button>
    </div>
  );
}

/** Mount once at app root */
export function Toaster() {
  const [toasts, setToasts] = useState<Array<ToastProps & { id: number }>>([]);
  const idRef = useRef(1);

  const dismiss = (id: number) => setToasts((prev) => prev.filter((x) => x.id !== id));

  useEffect(() => {
    addToastInternal = (t: ToastProps) => {
      const id = idRef.current++;
      setToasts((prev) => [...prev, { ...t, id }]);
      setTimeout(() => dismiss(id), t.duration ?? 4000);
    };
    return () => { addToastInternal = null; };
  }, []);

  if (!toasts.length) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-4 pointer-events-none">
      <div className="pointer-events-auto flex flex-col items-center gap-4">
        {toasts.map((t) => (
          <ToastCard key={t.id} t={t} onClose={() => dismiss(t.id)} />
        ))}
      </div>
    </div>
  );
}