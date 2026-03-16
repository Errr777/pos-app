import Dexie, { type Table } from 'dexie';

export interface CartItem {
    itemId: number;
    name: string;
    code: string;
    variantId?: number | null;
    variantName?: string | null;
    unitPrice: number;
    quantity: number;
    discountAmount: number;
    availableStock: number;
    promoName: string | null;
}

export interface SavedCart {
    id?: number;         // auto-increment, always stored at id=1
    warehouseId: number | null;
    customerId: number | null;
    payMethod: string;
    discount: string;
    note: string;
    items: CartItem[];
    updatedAt: number;   // Date.now()
}

export interface PendingTransaction {
    id?: number;          // auto-increment, local reference
    idempotencyKey: string; // UUID v4, sent to server for dedup
    payload: {
        warehouse_id: number;
        customer_id: number | null;
        occurred_at: string;
        payment_method: string;
        payment_amount: number;
        discount_amount: number;
        note: string;
        items: Array<{
            item_id: number;
            variant_id?: number | null;
            variant_name?: string | null;
            quantity: number;
            unit_price: number;
            discount_amount: number;
        }>;
    };
    status: 'pending' | 'syncing' | 'failed';
    failReason?: string;
    createdAt: number;
    attempts: number;
}

class PosDatabase extends Dexie {
    cart!: Table<SavedCart, number>;
    pendingTransactions!: Table<PendingTransaction, number>;

    constructor() {
        super('PosOfflineDB');
        this.version(1).stores({
            cart: '++id',
            pendingTransactions: '++id, status, idempotencyKey',
        });
    }
}

export const db = new PosDatabase();
