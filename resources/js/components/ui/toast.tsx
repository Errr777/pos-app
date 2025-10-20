// resources/js/components/ui/toast.tsx
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';

type ToastVariant = 'default' | 'success' | 'destructive' | 'warning' | 'info';
type ToastProps = {
  id?: string | number;
  title?: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number; // ms
};

let addToastInternal: ((t: ToastProps) => void) | null = null;

export function useToast() {
  return {
    toast: (t: ToastProps) => {
      if (addToastInternal) addToastInternal(t);
      else console.warn('Toaster not mounted yet — fallback: ', t);
    },
  };
}

/** Visual Toaster — drop into root of app */
export function Toaster() {
  const [toasts, setToasts] = useState<Array<ToastProps & { id: number }>>([]);
  const idRef = useRef(1);

  useEffect(() => {
    addToastInternal = (t: ToastProps) => {
      const id = idRef.current++;
      const toast = { id, ...t };
      setToasts((prev) => [...prev, toast]);
      const timeout = toast.duration ?? 4000;
      setTimeout(() => {
        setToasts((prev) => prev.filter((x) => x.id !== id));
      }, timeout);
    };
    return () => {
      addToastInternal = null;
    };
  }, []);

  if (!toasts.length) return null;

  return (
    <div className="fixed top-6 right-6 z-50 flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className={`max-w-sm w-full rounded-md p-3 shadow-md border ${
            t.variant === 'success'
              ? 'bg-green-600 text-white'
              : t.variant === 'destructive'
              ? 'bg-red-600 text-white'
              : t.variant === 'warning'
              ? 'bg-amber-500 text-black'
              : 'bg-slate-800 text-white'
          }`}
        >
          {t.title && <div className="font-semibold">{t.title}</div>}
          {t.description && <div className="text-sm mt-1">{t.description}</div>}
        </div>
      ))}
    </div>
  );
}