# Offline POS Mode Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow the POS terminal to queue and process transactions even when the internet connection is unavailable, syncing automatically when connectivity is restored.

**Architecture:** Service worker (via `vite-plugin-pwa` + Workbox) caches all frontend assets so the terminal loads offline. A Dexie.js IndexedDB database persists the active cart and a queue of pending transactions. When offline, checkout saves to the queue instead of posting to the server; a background sync hook replays the queue once the connection is restored.

**Tech Stack:** `vite-plugin-pwa`, `workbox-strategies`, `dexie`, `navigator.onLine` + browser events, Laravel `idempotency_key` column on `sale_headers`.

---

## Token Estimate per Task

| Task | Description | Est. Tokens |
|------|-------------|-------------|
| 1 | Install deps + PWA/Workbox setup | ~3,000 |
| 2 | Dexie DB schema (`lib/db.ts`) | ~2,000 |
| 3 | `use-network` hook | ~1,500 |
| 4 | `use-offline-cart` hook | ~3,000 |
| 5 | `use-sync-queue` hook | ~4,500 |
| 6 | `OfflineIndicator` component | ~2,000 |
| 7 | Terminal.tsx — wire offline checkout | ~5,000 |
| 8 | Backend — idempotency key + migration | ~2,500 |
| 9 | `PendingSync.tsx` page (manual retry UI) | ~3,000 |
| 10 | Route + nav link for pending page | ~1,000 |
| **Total** | | **~27,500 tokens** |

> Token estimates reflect the cost to generate/modify each component with Claude. Actual session usage may vary ±20% depending on context carried forward.

---

## File Map

| Action | Path | Responsibility |
|--------|------|---------------|
| Modify | `vite.config.ts` | Add `vite-plugin-pwa` with Workbox runtime caching |
| Create | `public/manifest.json` | PWA metadata (name, icons, theme color, display: standalone) |
| Create | `resources/js/lib/db.ts` | Dexie schema: `cart` store + `pendingTransactions` store |
| Create | `resources/js/hooks/use-network.ts` | Reactive `isOnline` boolean from `navigator.onLine` |
| Create | `resources/js/hooks/use-offline-cart.ts` | Persist/restore cart to IndexedDB |
| Create | `resources/js/hooks/use-sync-queue.ts` | Watch online state, replay pending transactions, update DB |
| Create | `resources/js/components/offline-indicator.tsx` | Banner/badge: "Offline — N transaksi pending" |
| Modify | `resources/js/pages/pos/Terminal.tsx` | Replace `router.post` with queue-aware checkout |
| Create | `resources/js/pages/pos/PendingSync.tsx` | Manual list of queued transactions with retry/cancel |
| Modify | `resources/js/layouts/app-layout.tsx` | Mount `<OfflineIndicator />` globally |
| Create | `database/migrations/2026_03_15_add_idempotency_key_to_sale_headers.php` | Add nullable `idempotency_key` unique column |
| Modify | `app/Http/Controllers/PosController.php` | Accept + deduplicate via `idempotency_key` |

---

## Chunk 1: Infrastructure (PWA + IndexedDB)

### Task 1: Install dependencies and configure PWA

**Files:**
- Modify: `package.json` (via npm install)
- Modify: `vite.config.ts`
- Create: `public/icons/icon-192.png`, `public/icons/icon-512.png` *(copy existing logo or use placeholder)*

- [ ] **Step 1: Install packages**

```bash
npm install -D vite-plugin-pwa workbox-window
npm install dexie
```

Expected: no errors, `package.json` updated.

- [ ] **Step 2: Add PWA plugin to vite.config.ts**

Replace the content of `vite.config.ts`:

```typescript
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import laravel from 'laravel-vite-plugin';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
    server: {
        host: '127.0.0.1',
        port: 5173,
        strictPort: true,
        hmr: { host: '127.0.0.1' },
    },
    plugins: [
        laravel({
            input: ['resources/css/app.css', 'resources/js/app.tsx'],
            ssr: 'resources/js/ssr.tsx',
            refresh: true,
        }),
        react(),
        tailwindcss(),
        VitePWA({
            registerType: 'autoUpdate',
            injectRegister: 'auto',
            strategies: 'generateSW',
            workbox: {
                // Cache all Vite-built assets
                globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
                // Runtime caching: cache Inertia page loads (GET only)
                runtimeCaching: [
                    {
                        urlPattern: ({ request }) =>
                            request.mode === 'navigate' &&
                            request.method === 'GET',
                        handler: 'NetworkFirst',
                        options: {
                            cacheName: 'inertia-pages',
                            networkTimeoutSeconds: 5,
                            cacheableResponse: { statuses: [200] },
                        },
                    },
                ],
                // Never cache POST/mutation requests
                navigateFallback: null,
            },
            manifest: {
                name: 'POS App',
                short_name: 'POS',
                description: 'Point of Sale & Inventory',
                theme_color: '#1e293b',
                background_color: '#ffffff',
                display: 'standalone',
                start_url: '/pos/terminal',
                icons: [
                    { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
                    { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
                ],
            },
        }),
    ],
    esbuild: { jsx: 'automatic' },
    resolve: {
        alias: { 'ziggy-js': resolve(__dirname, 'vendor/tightenco/ziggy') },
    },
});
```

- [ ] **Step 3: Add placeholder icons**

```bash
# Copy any existing 192×192 and 512×512 images, or generate placeholders:
mkdir -p public/icons
# If store logo exists at storage/app/public/logos/, use it.
# Otherwise create a simple placeholder:
php artisan tinker --execute="
  \$img = imagecreatetruecolor(192, 192);
  \$bg = imagecolorallocate(\$img, 30, 41, 59);
  imagefill(\$img, 0, 0, \$bg);
  imagepng(\$img, public_path('icons/icon-192.png'));
  imagedestroy(\$img);
  \$img2 = imagecreatetruecolor(512, 512);
  \$bg2 = imagecolorallocate(\$img2, 30, 41, 59);
  imagefill(\$img2, 0, 0, \$bg2);
  imagepng(\$img2, public_path('icons/icon-512.png'));
  imagedestroy(\$img2);
  echo 'Icons created';
"
```

- [ ] **Step 4: Build and verify service worker is generated**

```bash
npm run build
ls public/build/  # Should contain sw.js and workbox-*.js
```

Expected output includes `sw.js`.

- [ ] **Step 5: Commit**

```bash
git add vite.config.ts package.json package-lock.json public/icons/
git commit -m "feat(pwa): add vite-plugin-pwa with Workbox asset caching"
```

---

### Task 2: Dexie IndexedDB schema

**Files:**
- Create: `resources/js/lib/db.ts`

- [ ] **Step 1: Create the database module**

```typescript
// resources/js/lib/db.ts
import Dexie, { type Table } from 'dexie';

export interface CartItem {
    itemId: number;
    name: string;
    code: string;
    unitPrice: number;
    quantity: number;
    discountAmount: number;
}

export interface SavedCart {
    id?: number;          // auto-increment
    warehouseId: number | null;
    customerId: number | null;
    payMethod: string;
    discount: string;
    note: string;
    items: CartItem[];
    updatedAt: number;    // Date.now()
}

export interface PendingTransaction {
    id?: number;           // auto-increment, used as local reference
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
```

- [ ] **Step 2: Verify module resolves (TypeScript check)**

```bash
npm run types 2>&1 | grep "lib/db"
```

Expected: no errors mentioning `lib/db.ts`.

- [ ] **Step 3: Commit**

```bash
git add resources/js/lib/db.ts
git commit -m "feat(offline): add Dexie IndexedDB schema for cart and pending transactions"
```

---

### Task 3: Network detection hook

**Files:**
- Create: `resources/js/hooks/use-network.ts`

- [ ] **Step 1: Create the hook**

```typescript
// resources/js/hooks/use-network.ts
import { useEffect, useState } from 'react';

export function useNetwork(): boolean {
    const [isOnline, setIsOnline] = useState(() => navigator.onLine);

    useEffect(() => {
        const goOnline  = () => setIsOnline(true);
        const goOffline = () => setIsOnline(false);

        window.addEventListener('online',  goOnline);
        window.addEventListener('offline', goOffline);

        return () => {
            window.removeEventListener('online',  goOnline);
            window.removeEventListener('offline', goOffline);
        };
    }, []);

    return isOnline;
}
```

- [ ] **Step 2: Type-check**

```bash
npm run types 2>&1 | grep "use-network"
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add resources/js/hooks/use-network.ts
git commit -m "feat(offline): add useNetwork hook for online/offline detection"
```

---

### Task 4: Offline cart persistence hook

**Files:**
- Create: `resources/js/hooks/use-offline-cart.ts`

This hook replaces the bare `useState<CartItem[]>([])` in Terminal.tsx with an IndexedDB-backed version. The cart auto-saves on every change and restores on mount.

- [ ] **Step 1: Create the hook**

```typescript
// resources/js/hooks/use-offline-cart.ts
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

export function useOfflineCart(): UseOfflineCartReturn {
    const [isRestored, setIsRestored] = useState(false);
    const [state, setState] = useState<CartState>({
        warehouseId: null,
        customerId:  null,
        payMethod:   'cash',
        discount:    '',
        note:        '',
        items:       [],
    });

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

    // Persist cart to IndexedDB on every state change (after restore)
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
        setState({ warehouseId: null, customerId: null, payMethod: 'cash', discount: '', note: '', items: [] });
        db.cart.delete(CART_ID);
    }, []);

    return {
        ...state,
        setItems:       (v) => setField('items', v),
        setWarehouseId: (v) => setField('warehouseId', v),
        setCustomerId:  (v) => setField('customerId', v),
        setPayMethod:   (v) => setField('payMethod', v),
        setDiscount:    (v) => setField('discount', v),
        setNote:        (v) => setField('note', v),
        clearCart,
        isRestored,
    };
}
```

- [ ] **Step 2: Type-check**

```bash
npm run types 2>&1 | grep "use-offline-cart"
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add resources/js/hooks/use-offline-cart.ts
git commit -m "feat(offline): persist cart to IndexedDB via useOfflineCart hook"
```

---

## Chunk 2: Sync Queue + UI

### Task 5: Sync queue hook

**Files:**
- Create: `resources/js/hooks/use-sync-queue.ts`

This hook watches `isOnline`, finds all `pending` transactions in IndexedDB, and POSTs them to the server one at a time. On success it deletes the record. On failure it marks it `failed` with the reason.

- [ ] **Step 1: Create the hook**

```typescript
// resources/js/hooks/use-sync-queue.ts
import { useCallback, useEffect, useRef, useState } from 'react';
import { db, type PendingTransaction } from '@/lib/db';

export function useSyncQueue(isOnline: boolean) {
    const [pendingCount, setPendingCount] = useState(0);
    const [isSyncing, setIsSyncing]       = useState(false);
    const syncLockRef = useRef(false);

    // Keep pendingCount reactive
    useEffect(() => {
        const refresh = () =>
            db.pendingTransactions
                .where('status').anyOf(['pending', 'failed'])
                .count()
                .then(setPendingCount);

        refresh();
        // Re-check every time the hook re-renders (triggered by isOnline changes)
    }, [isOnline]);

    const syncNow = useCallback(async () => {
        if (syncLockRef.current || !isOnline) return;
        syncLockRef.current = true;
        setIsSyncing(true);

        try {
            const pending = await db.pendingTransactions
                .where('status').anyOf(['pending', 'failed'])
                .toArray();

            for (const tx of pending) {
                await db.pendingTransactions.update(tx.id!, { status: 'syncing' });

                try {
                    const res = await fetch('/pos', {
                        method:  'POST',
                        headers: {
                            'Content-Type':     'application/json',
                            'Accept':           'application/json',
                            'X-Requested-With': 'XMLHttpRequest',
                            'X-CSRF-TOKEN':     (document.querySelector('meta[name=csrf-token]') as HTMLMetaElement)?.content ?? '',
                        },
                        body: JSON.stringify({ ...tx.payload, idempotency_key: tx.idempotencyKey }),
                    });

                    if (res.ok) {
                        await db.pendingTransactions.delete(tx.id!);
                    } else {
                        const err = await res.json().catch(() => ({}));
                        await db.pendingTransactions.update(tx.id!, {
                            status:     'failed',
                            failReason: err?.message ?? `HTTP ${res.status}`,
                            attempts:   (tx.attempts ?? 0) + 1,
                        });
                    }
                } catch (networkErr) {
                    await db.pendingTransactions.update(tx.id!, {
                        status:    'failed',
                        failReason: String(networkErr),
                        attempts:  (tx.attempts ?? 0) + 1,
                    });
                    break; // Network is down again — stop syncing
                }
            }
        } finally {
            syncLockRef.current = false;
            setIsSyncing(false);
            const count = await db.pendingTransactions
                .where('status').anyOf(['pending', 'failed'])
                .count();
            setPendingCount(count);
        }
    }, [isOnline]);

    // Auto-sync when coming back online
    useEffect(() => {
        if (isOnline) syncNow();
    }, [isOnline, syncNow]);

    const addToQueue = useCallback(
        async (payload: PendingTransaction['payload'], idempotencyKey: string) => {
            await db.pendingTransactions.add({
                idempotencyKey,
                payload,
                status:    'pending',
                attempts:  0,
                createdAt: Date.now(),
            });
            setPendingCount((c) => c + 1);
        },
        [],
    );

    return { pendingCount, isSyncing, syncNow, addToQueue };
}
```

- [ ] **Step 2: Type-check**

```bash
npm run types 2>&1 | grep "use-sync-queue"
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add resources/js/hooks/use-sync-queue.ts
git commit -m "feat(offline): add useSyncQueue hook to replay pending transactions on reconnect"
```

---

### Task 6: OfflineIndicator component

**Files:**
- Create: `resources/js/components/offline-indicator.tsx`
- Modify: `resources/js/layouts/app-layout.tsx` (mount indicator)

- [ ] **Step 1: Create the component**

```tsx
// resources/js/components/offline-indicator.tsx
import { WifiOff, RefreshCw } from 'lucide-react';
import { router } from '@inertiajs/react';

interface Props {
    isOnline:     boolean;
    pendingCount: number;
    isSyncing:    boolean;
    onSyncNow:    () => void;
}

export function OfflineIndicator({ isOnline, pendingCount, isSyncing, onSyncNow }: Props) {
    // Hidden when online and nothing pending
    if (isOnline && pendingCount === 0) return null;

    return (
        <div
            className={`fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium shadow-lg
                ${isOnline ? 'bg-amber-500 text-white' : 'bg-red-600 text-white'}`}
        >
            <WifiOff className="h-4 w-4" />
            {isOnline ? (
                <>
                    <span>{pendingCount} transaksi pending</span>
                    <button
                        onClick={onSyncNow}
                        disabled={isSyncing}
                        className="ml-1 flex items-center gap-1 underline disabled:opacity-50"
                    >
                        <RefreshCw className={`h-3 w-3 ${isSyncing ? 'animate-spin' : ''}`} />
                        {isSyncing ? 'Menyinkron…' : 'Sync sekarang'}
                    </button>
                    <button
                        onClick={() => router.visit(route('pos.pending'))}
                        className="ml-1 underline"
                    >
                        Lihat
                    </button>
                </>
            ) : (
                <>
                    <span>Offline{pendingCount > 0 ? ` — ${pendingCount} pending` : ''}</span>
                </>
            )}
        </div>
    );
}
```

- [ ] **Step 2: Read app-layout.tsx to find the right mount point**

```bash
grep -n "children\|outlet\|AppSidebar\|main" resources/js/layouts/app-layout.tsx | head -20
```

- [ ] **Step 3: Mount OfflineIndicator in app-layout.tsx**

Find the outer wrapper `<div>` that wraps the whole layout and add the indicator just before the closing tag. The indicator needs `isOnline`, `pendingCount`, `isSyncing`, `onSyncNow` — these come from hooks. Since `app-layout.tsx` is the global layout, import and call the hooks here:

```tsx
// Add to imports in app-layout.tsx:
import { useNetwork } from '@/hooks/use-network';
import { useSyncQueue } from '@/hooks/use-sync-queue';
import { OfflineIndicator } from '@/components/offline-indicator';

// Inside the layout component, before return:
const isOnline = useNetwork();
const { pendingCount, isSyncing, syncNow } = useSyncQueue(isOnline);

// Add inside the JSX, just before the final closing tag:
<OfflineIndicator
    isOnline={isOnline}
    pendingCount={pendingCount}
    isSyncing={isSyncing}
    onSyncNow={syncNow}
/>
```

- [ ] **Step 4: Type-check**

```bash
npm run types 2>&1 | grep -E "offline-indicator|app-layout"
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add resources/js/components/offline-indicator.tsx resources/js/layouts/app-layout.tsx
git commit -m "feat(offline): add OfflineIndicator global banner with pending count and sync button"
```

---

## Chunk 3: Terminal + Backend

### Task 7: Wire offline checkout into Terminal.tsx

**Files:**
- Modify: `resources/js/pages/pos/Terminal.tsx`

Replace bare `useState` cart with `useOfflineCart`, add `useNetwork` + `useSyncQueue`, and replace the `router.post` checkout with a queue-aware version.

- [ ] **Step 1: Read Terminal.tsx lines 1-110 (imports + state)**

```bash
# In editor, or:
head -110 resources/js/pages/pos/Terminal.tsx
```

- [ ] **Step 2: Replace import block and state declarations**

**Old imports (top of file):**
```tsx
import { useState, useMemo, useRef } from 'react';
```

**New imports — add after the existing imports:**
```tsx
import { useMemo, useRef } from 'react';
import { useNetwork } from '@/hooks/use-network';
import { useOfflineCart } from '@/hooks/use-offline-cart';
import { useSyncQueue } from '@/hooks/use-sync-queue';
import { v4 as uuidv4 } from 'uuid'; // npm install uuid @types/uuid
```

Install uuid:
```bash
npm install uuid
npm install -D @types/uuid
```

- [ ] **Step 3: Replace cart useState declarations with useOfflineCart**

**Remove these lines (approximately lines 91–100):**
```tsx
const [cart, setCart]         = useState<CartItem[]>([]);
const [customerId, setCustomerId] = useState<number | null>(null);
const [payMethod, setPayMethod] = useState('cash');
const [payAmount, setPayAmount] = useState('');
const [discount, setDiscount] = useState('');
const [note, setNote]         = useState('');
```

**Replace with:**
```tsx
const isOnline = useNetwork();
const {
    items: cart, setItems: setCart,
    customerId, setCustomerId,
    payMethod, setPayMethod,
    discount,  setDiscount,
    note,      setNote,
    warehouseId: cartWarehouseId, setWarehouseId: setCartWarehouseId,
    clearCart,
    isRestored,
} = useOfflineCart();
const { pendingCount, isSyncing, syncNow, addToQueue } = useSyncQueue(isOnline);

// Keep payAmount as local state (not worth persisting mid-entry)
const [payAmount, setPayAmount] = useState('');
```

Also sync `warehouseId` changes to the cart persistence:
```tsx
// After the line: const [warehouseId, setWarehouseId] = useState<number | null>(...)
// Add:
useEffect(() => { setCartWarehouseId(warehouseId); }, [warehouseId]);
```

- [ ] **Step 4: Replace the checkout handler**

**Find the existing `handleCheckout` (around line 185–220) and replace the `router.post` block:**

```tsx
const handleCheckout = () => {
    if (!warehouseId || cart.length === 0) return;
    setSubmitting(true);
    setErrors({});

    const payload = {
        warehouse_id:    warehouseId,
        customer_id:     customerId ?? null,
        occurred_at:     new Date().toISOString(),
        payment_method:  payMethod,
        payment_amount:  parseInt(payAmount.replace(/\D/g, ''), 10) || grandTotal,
        discount_amount: parseInt(discount.replace(/\D/g, ''), 10) || 0,
        note:            note,
        items: cart.map((ci) => ({
            item_id:         ci.itemId,
            quantity:        ci.quantity,
            unit_price:      ci.unitPrice,
            discount_amount: ci.discountAmount,
        })),
    };

    if (!isOnline) {
        // OFFLINE PATH: queue locally
        const idempotencyKey = uuidv4();
        addToQueue(payload, idempotencyKey).then(() => {
            setReceiptModal({
                saleNumber:   `OFFLINE-${idempotencyKey.slice(0, 8).toUpperCase()}`,
                grandTotal,
                changeAmount: Math.max(0, payload.payment_amount - grandTotal),
            });
            clearCart();
            setPayAmount('');
            setSubmitting(false);
        });
        return;
    }

    // ONLINE PATH: normal Inertia submission (unchanged)
    router.post(route('pos.store'), { ...payload, idempotency_key: uuidv4() }, {
        preserveScroll: true,
        onSuccess: (page) => {
            const flash = (page.props as Record<string, unknown>);
            setReceiptModal({
                saleNumber:   String(flash.saleNumber ?? ''),
                grandTotal,
                changeAmount: Math.max(0, payload.payment_amount - grandTotal),
            });
            clearCart();
            setPayAmount('');
            setSubmitting(false);
        },
        onError: (errs) => { setErrors(errs); setSubmitting(false); },
    });
};
```

- [ ] **Step 5: Update button label to show offline state**

Find the submit button (approximately: `disabled={submitting || cart.length === 0}`):

```tsx
// Add to the button or near it:
{!isOnline && (
    <span className="text-xs opacity-75 block">Mode Offline — transaksi akan disimpan lokal</span>
)}
```

- [ ] **Step 6: Show pending count badge near checkout (optional but recommended)**

Near the "Proses Transaksi" button, add:
```tsx
{pendingCount > 0 && (
    <p className="text-xs text-amber-600">
        {pendingCount} transaksi belum tersinkron
    </p>
)}
```

- [ ] **Step 7: Type-check**

```bash
npm run types 2>&1 | grep "Terminal"
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add resources/js/pages/pos/Terminal.tsx package.json package-lock.json
git commit -m "feat(offline): wire Terminal.tsx to offline cart and sync queue"
```

---

### Task 8: Backend — idempotency key

**Files:**
- Create: `database/migrations/2026_03_15_add_idempotency_key_to_sale_headers.php`
- Modify: `app/Http/Controllers/PosController.php`

- [ ] **Step 1: Create migration**

```bash
php artisan make:migration add_idempotency_key_to_sale_headers --table=sale_headers
```

Edit the generated file:

```php
public function up(): void
{
    Schema::table('sale_headers', function (Blueprint $table) {
        $table->string('idempotency_key', 36)->nullable()->unique()->after('note');
    });
}

public function down(): void
{
    Schema::table('sale_headers', function (Blueprint $table) {
        $table->dropColumn('idempotency_key');
    });
}
```

- [ ] **Step 2: Run migration**

```bash
php artisan migrate
```

Expected: `Migrating: ...add_idempotency_key_to_sale_headers` → `Migrated`.

- [ ] **Step 3: Add idempotency_key to PosController validation + dedup logic**

In `app/Http/Controllers/PosController.php`, inside `store()`:

**Add to validator rules:**
```php
'idempotency_key' => 'nullable|string|size:36',
```

**After `$data = $validator->validated();`, add:**
```php
// Idempotency: if this key was already processed, return the existing sale
if (!empty($data['idempotency_key'])) {
    $existing = SaleHeader::where('idempotency_key', $data['idempotency_key'])->first();
    if ($existing) {
        $result = [
            'saleNumber'   => $existing->sale_number,
            'grandTotal'   => $existing->grand_total,
            'changeAmount' => $existing->change_amount,
            'saleId'       => $existing->id,
        ];
        if ($request->wantsJson()) {
            return response()->json($result);
        }
        return redirect()->route('pos.show', $result['saleId'])
            ->with('success', "Penjualan {$result['saleNumber']} sudah diproses.");
    }
}
```

**Inside `SaleHeader::create([...])`, add:**
```php
'idempotency_key' => $data['idempotency_key'] ?? null,
```

- [ ] **Step 4: Add to `$fillable` on SaleHeader model**

```bash
grep -n "fillable" app/Models/SaleHeader.php
```

Add `'idempotency_key'` to the `$fillable` array.

- [ ] **Step 5: Run tests**

```bash
composer run test
```

Expected: all existing tests pass.

- [ ] **Step 6: Commit**

```bash
git add database/migrations/ app/Http/Controllers/PosController.php app/Models/SaleHeader.php
git commit -m "feat(offline): add idempotency_key to sale_headers to prevent duplicate transactions on sync"
```

---

### Task 9: PendingSync page

**Files:**
- Create: `resources/js/pages/pos/PendingSync.tsx`

This page lists all queued transactions from IndexedDB with retry and cancel buttons.

- [ ] **Step 1: Create the page**

```tsx
// resources/js/pages/pos/PendingSync.tsx
import { useEffect, useState } from 'react';
import AppLayout from '@/layouts/app-layout';
import { db, type PendingTransaction } from '@/lib/db';
import { useNetwork } from '@/hooks/use-network';
import { useSyncQueue } from '@/hooks/use-sync-queue';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils'; // adjust import if helper exists
import { RefreshCw, Trash2, WifiOff } from 'lucide-react';
import type { BreadcrumbItem } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'POS', href: '/pos' },
    { title: 'Transaksi Pending', href: '/pos/pending' },
];

export default function PendingSync() {
    const [rows, setRows] = useState<PendingTransaction[]>([]);
    const isOnline = useNetwork();
    const { isSyncing, syncNow } = useSyncQueue(isOnline);

    const reload = () =>
        db.pendingTransactions.orderBy('createdAt').reverse().toArray().then(setRows);

    useEffect(() => { reload(); }, []);

    const handleDelete = async (id: number) => {
        await db.pendingTransactions.delete(id);
        reload();
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                    <h1 className="text-xl font-semibold">Transaksi Pending ({rows.length})</h1>
                    <Button
                        onClick={() => syncNow().then(reload)}
                        disabled={!isOnline || isSyncing}
                        variant="default"
                        size="sm"
                    >
                        <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
                        {isSyncing ? 'Menyinkron…' : 'Sync Sekarang'}
                    </Button>
                </div>

                {!isOnline && (
                    <div className="flex items-center gap-2 rounded-md bg-red-50 p-3 text-red-700 text-sm">
                        <WifiOff className="h-4 w-4" />
                        Tidak ada koneksi. Transaksi akan disinkron otomatis saat online.
                    </div>
                )}

                {rows.length === 0 && (
                    <p className="text-muted-foreground text-sm">Tidak ada transaksi pending.</p>
                )}

                <div className="space-y-3">
                    {rows.map((tx) => (
                        <div key={tx.id} className="rounded-lg border p-4 space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="font-mono text-xs text-muted-foreground">
                                    {tx.idempotencyKey}
                                </span>
                                <Badge variant={
                                    tx.status === 'failed'  ? 'destructive' :
                                    tx.status === 'syncing' ? 'secondary'   : 'outline'
                                }>
                                    {tx.status}
                                </Badge>
                            </div>
                            <div className="text-sm">
                                <span className="font-medium">
                                    {tx.payload.items.length} item
                                </span>
                                {' · '}
                                <span>Total: Rp {tx.payload.payment_amount.toLocaleString('id-ID')}</span>
                                {' · '}
                                <span className="text-muted-foreground">
                                    {new Date(tx.createdAt).toLocaleString('id-ID')}
                                </span>
                            </div>
                            {tx.failReason && (
                                <p className="text-xs text-red-600">Error: {tx.failReason}</p>
                            )}
                            <div className="flex gap-2">
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => handleDelete(tx.id!)}
                                >
                                    <Trash2 className="h-3 w-3 mr-1" />
                                    Hapus
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </AppLayout>
    );
}
```

- [ ] **Step 2: Type-check**

```bash
npm run types 2>&1 | grep "PendingSync"
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add resources/js/pages/pos/PendingSync.tsx
git commit -m "feat(offline): add PendingSync page listing queued transactions with retry/delete"
```

---

### Task 10: Route + sidebar nav link

**Files:**
- Modify: `routes/web.php`
- Modify: `resources/js/components/app-sidebar.tsx` (add link if visible)

- [ ] **Step 1: Add route in routes/web.php**

Inside the main auth group, alongside existing POS routes:

```php
Route::get('/pos/pending', fn () => Inertia::render('pos/PendingSync'))
    ->name('pos.pending');
```

> Note: this route serves a client-side-only page (IndexedDB data), no controller needed.

- [ ] **Step 2: Add nav link in app-sidebar.tsx (conditional)**

Find the POS nav item. Add a child link or a separate item:

```tsx
// This nav item only shows visually — the page loads IndexedDB data client-side
// Add near the POS section, conditionally shown only when isOnline=false or pendingCount > 0
// For simplicity, always show it under POS for kasir users
{ title: 'Transaksi Pending', href: '/pos/pending', icon: RefreshCw }
```

- [ ] **Step 3: Verify route resolves**

```bash
php artisan route:list | grep pending
```

Expected: `GET /pos/pending  pos.pending`.

- [ ] **Step 4: Final build check**

```bash
npm run build 2>&1 | tail -20
```

Expected: no errors, `sw.js` listed in output.

- [ ] **Step 5: Commit**

```bash
git add routes/web.php resources/js/components/app-sidebar.tsx
git commit -m "feat(offline): add /pos/pending route and sidebar nav link"
```

---

## Verification Checklist

After all tasks are complete, verify end-to-end:

- [ ] Open terminal: `npm run dev` + `php artisan serve`
- [ ] Login, go to `/pos/terminal`
- [ ] In Chrome DevTools → Network → set to **Offline**
- [ ] Add items to cart → observe banner "Offline" appears
- [ ] Click "Proses Transaksi" → receipt modal shows `OFFLINE-XXXXXXXX`
- [ ] Cart is cleared; go back, add new items — confirm old cart not restored
- [ ] Go to `/pos/pending` → see the queued transaction
- [ ] DevTools → set back to **Online**
- [ ] `OfflineIndicator` changes to amber "N transaksi pending"
- [ ] Click "Sync sekarang" → transaction disappears from `/pos/pending`
- [ ] Check `/pos` history — transaction now appears
- [ ] Refresh page mid-cart → cart restored from IndexedDB
- [ ] Simulate duplicate: POST same `idempotency_key` twice → second call returns existing sale, no duplicate
- [ ] `npm run build` → confirm `sw.js` is generated in `public/build/`
- [ ] `composer run test` → all tests pass

---

## Notes for Executor

1. **`app-layout.tsx` edit (Task 6)**: Read the full file before editing to find the exact wrapper div. The `useNetwork` and `useSyncQueue` calls must be inside the React component function body, not at module level.

2. **CSRF token**: The `useSyncQueue` fetch uses `document.querySelector('meta[name=csrf-token]')`. Verify this meta tag exists in `resources/js/app.tsx` or the root Blade template (`resources/views/app.blade.php`). If not, add `<meta name="csrf-token" content="{{ csrf_token() }}">` there.

3. **`uuid` package**: Added in Task 7. Run `npm install uuid && npm install -D @types/uuid` before editing Terminal.tsx.

4. **SaleHeader `$fillable`**: Check `app/Models/SaleHeader.php` for the `$fillable` array and add `'idempotency_key'` — required for `SaleHeader::create()` to accept the new column.

5. **Icons in PWA manifest**: The `public/icons/icon-192.png` and `icon-512.png` must exist before running `npm run build`. Use the Tinker approach in Task 1 Step 3, or copy any existing store logo.
