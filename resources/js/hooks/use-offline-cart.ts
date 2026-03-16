import { useCallback, useEffect, useState } from 'react';
import { db, type CartItem, type SavedCart } from '@/lib/db';

const CART_ID = 1; // single active cart slot

interface CartState {
    warehouseId: number | null;
    customerId: number | null;
    payMethod: string;
    discount: string;
    note: string;
    items: CartItem[];
}

interface UseOfflineCartReturn extends CartState {
    setItems:       (items: CartItem[]) => void;
    setWarehouseId: (id: number | null) => void;
    setCustomerId:  (id: number | null) => void;
    setPayMethod:   (m: string) => void;
    setDiscount:    (d: string) => void;
    setNote:        (n: string) => void;
    clearCart:      () => void;
    isRestored:     boolean;
}

const DEFAULT_STATE: CartState = {
    warehouseId: null,
    customerId:  null,
    payMethod:   'cash',
    discount:    '',
    note:        '',
    items:       [],
};

export function useOfflineCart(): UseOfflineCartReturn {
    const [isRestored, setIsRestored] = useState(false);
    const [state, setState] = useState<CartState>(DEFAULT_STATE);

    // Restore cart from IndexedDB on mount
    useEffect(() => {
        db.cart.get(CART_ID).then((saved) => {
            if (saved) {
                setState({
                    warehouseId: saved.warehouseId,
                    customerId:  saved.customerId,
                    payMethod:   saved.payMethod,
                    discount:    saved.discount,
                    note:        saved.note,
                    items:       saved.items,
                });
            }
            setIsRestored(true);
        });
    }, []);

    // Persist cart to IndexedDB whenever state changes (after initial restore)
    useEffect(() => {
        if (!isRestored) return;
        const record: SavedCart = { ...state, id: CART_ID, updatedAt: Date.now() };
        db.cart.put(record);
    }, [state, isRestored]);

    const setField = useCallback(
        <K extends keyof CartState>(key: K, value: CartState[K]) =>
            setState((prev) => ({ ...prev, [key]: value })),
        [],
    );

    const clearCart = useCallback(() => {
        setState(DEFAULT_STATE);
        db.cart.delete(CART_ID);
    }, []);

    const setItems       = useCallback((v: CartItem[])      => setField('items', v),       [setField]);
    const setWarehouseId = useCallback((v: number | null)   => setField('warehouseId', v), [setField]);
    const setCustomerId  = useCallback((v: number | null)   => setField('customerId', v),  [setField]);
    const setPayMethod   = useCallback((v: string)          => setField('payMethod', v),   [setField]);
    const setDiscount    = useCallback((v: string)          => setField('discount', v),    [setField]);
    const setNote        = useCallback((v: string)          => setField('note', v),        [setField]);

    return {
        ...state,
        setItems,
        setWarehouseId,
        setCustomerId,
        setPayMethod,
        setDiscount,
        setNote,
        clearCart,
        isRestored,
    };
}
