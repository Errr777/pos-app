// resources/js/components/ui/use-toast.tsx
import React, { ReactNode } from 'react';
import { Toaster, useToast as _useToast } from './toast';

type ToastProviderProps = { children: ReactNode };

export function ToastProvider({ children }: ToastProviderProps) {
  // The Toaster internally registers a global addToast function
  return (
    <>
      <Toaster />
      {children}
    </>
  );
}

/** Export a hook to match shadcn API: `const { toast } = useToast()` */
export function useToast() {
  return _useToast();
}