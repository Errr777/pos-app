<?php

namespace App\Http\Controllers;

use App\Helpers\AuditLogger;
use App\Models\DeliveryOrder;
use App\Models\DeliveryOrderItem;
use App\Models\Item;
use App\Models\StockTransfer;
use App\Models\User;
use App\Models\Warehouse;
use App\Models\WarehouseItem;
use App\Models\WarehouseItemPrice;
use App\Traits\FiltersWarehouseByUser;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Inertia\Inertia;

class DeliveryOrderController extends Controller
{
    use FiltersWarehouseByUser;

    public function __construct()
    {
        $this->middleware(function ($request, $next) {
            $user = $request->user();
            if (! $user) return redirect()->route('login');

            $method = $request->method();
            $action = match(true) {
                $method === 'DELETE'                         => 'can_delete',
                in_array($method, ['POST', 'PUT', 'PATCH']) => 'can_write',
                default                                      => 'can_view',
            };

            if (! $user->hasPermission('inventory', $action)) {
                return $request->wantsJson()
                    ? response()->json(['error' => 'Forbidden'], 403)
                    : abort(403);
            }

            return $next($request);
        });
    }

    // ── INDEX ─────────────────────────────────────────────────────────────────

    public function index(Request $request)
    {
        $search   = trim((string) $request->get('search', ''));
        $status   = $request->get('status', '');
        $dateFrom = $request->get('date_from');
        $dateTo   = $request->get('date_to');
        $perPage  = 20;

        $query = DeliveryOrder::with(['fromWarehouse', 'toWarehouse', 'items'])
            ->leftJoin('warehouses as fw', 'delivery_orders.from_warehouse_id', '=', 'fw.id')
            ->leftJoin('warehouses as tw', 'delivery_orders.to_warehouse_id',   '=', 'tw.id')
            ->select('delivery_orders.*');

        if ($search !== '') {
            $term = strtolower($search);
            $query->where(function ($q) use ($term) {
                $q->whereRaw('LOWER(delivery_orders.do_number) like ?', ["%{$term}%"])
                  ->orWhereRaw('LOWER(delivery_orders.sender_name) like ?', ["%{$term}%"])
                  ->orWhereRaw('LOWER(delivery_orders.recipient_name) like ?', ["%{$term}%"])
                  ->orWhereRaw('LOWER(fw.name) like ?', ["%{$term}%"])
                  ->orWhereRaw('LOWER(tw.name) like ?', ["%{$term}%"]);
            });
        }

        if ($status)   $query->where('delivery_orders.status', $status);
        if ($dateFrom) $query->whereDate('delivery_orders.created_at', '>=', $dateFrom);
        if ($dateTo)   $query->whereDate('delivery_orders.created_at', '<=', $dateTo);

        $orders = $query->orderBy('delivery_orders.created_at', 'desc')
            ->paginate($perPage)
            ->withQueryString()
            ->through(fn ($do) => [
                'id'            => hid($do->id),
                'doNumber'      => $do->do_number,
                'status'        => $do->status,
                'fromName'      => $do->fromWarehouse?->name ?? '-',
                'toName'        => $do->toWarehouse?->name   ?? '-',
                'senderName'    => $do->sender_name,
                'recipientName' => $do->recipient_name,
                'itemCount'     => $do->items->count(),
                'sentAt'        => $do->sent_at?->toISOString(),
                'confirmedAt'   => $do->confirmed_at?->toISOString(),
                'createdAt'     => $do->created_at?->toISOString(),
            ]);

        $warehouses = Warehouse::where('is_active', true)
            ->orderBy('is_default', 'desc')->orderBy('name')
            ->get()->map(fn ($w) => ['id' => hid($w->id), 'name' => $w->name, 'is_default' => (bool) $w->is_default]);

        return Inertia::render('inventory/DeliveryOrders', [
            'orders'     => $orders,
            'warehouses' => $warehouses,
            'filters'    => $request->only(['search', 'status', 'date_from', 'date_to']),
        ]);
    }

    // ── CREATE FORM ────────────────────────────────────────────────────────────

    public function create(Request $request)
    {
        $mainWarehouse = Warehouse::where('is_default', true)->first();

        $warehouses = Warehouse::where('is_active', true)
            ->orderBy('is_default', 'desc')->orderBy('name')
            ->get()->map(fn ($w) => [
                'id'         => hid($w->id),
                'name'       => $w->name,
                'code'       => $w->code,
                'is_default' => (bool) $w->is_default,
            ]);

        // Items with stock at main warehouse
        $items = DB::table('items')
            ->where('items.type', 'barang')
            ->leftJoin('warehouse_items as wi', function ($join) use ($mainWarehouse) {
                $join->on('wi.item_id', '=', 'items.id')
                     ->where('wi.warehouse_id', $mainWarehouse?->id);
            })
            ->select('items.id', 'items.nama', 'items.kode_item', 'items.kategori',
                     'items.harga_jual',
                     DB::raw('COALESCE(wi.stok, 0) as main_stock'))
            ->orderBy('items.nama')
            ->get()
            ->map(fn ($i) => [
                'id'          => hid($i->id),
                'name'        => $i->nama,
                'code'        => $i->kode_item,
                'category'    => $i->kategori,
                'global_price'=> $i->harga_jual,
                'main_stock'  => (int) $i->main_stock,
            ]);

        $users = User::orderBy('name')->get()->map(fn ($u) => [
            'id'   => hid($u->id),
            'name' => $u->name,
            'role' => $u->role,
        ]);

        // Build prefill from query params (coming from Transfer Stok form)
        $prefill = null;
        if ($request->has('item_id') && $request->has('to_id')) {
            $prefillItem = $items->firstWhere('id', hid(dhid((string) $request->get('item_id'))));
            if ($prefillItem) {
                $prefill = [
                    'to_warehouse_id' => $request->get('to_id'), // already hash from redirect
                    'item'            => $prefillItem,
                    'quantity'        => max(1, (int) $request->get('quantity', 1)),
                    'reference'       => $request->get('reference'),
                    'note'            => $request->get('note'),
                ];
            }
        }

        // Pending DOs grouped by outlet (to_warehouse_id) for the merge banner
        $pendingByOutlet = DeliveryOrder::where('status', 'pending')
            ->where('from_warehouse_id', $mainWarehouse?->id)
            ->orderBy('created_at', 'desc')
            ->get()
            ->groupBy('to_warehouse_id')
            ->map(fn ($group) => $group->map(fn ($do) => [
                'id'       => hid($do->id),
                'doNumber' => $do->do_number,
            ])->values())
            ->toArray();

        return Inertia::render('inventory/CreateDeliveryOrder', [
            'mainWarehouse'   => $mainWarehouse ? [
                'id'   => hid($mainWarehouse->id),
                'name' => $mainWarehouse->name,
                'code' => $mainWarehouse->code,
            ] : null,
            'warehouses'      => $warehouses,
            'items'           => $items,
            'users'           => $users,
            'prefill'         => $prefill,
            'pendingByOutlet' => $pendingByOutlet,
        ]);
    }

    // ── STORE ─────────────────────────────────────────────────────────────────

    public function store(Request $request)
    {
        $decodedItems = collect($request->items ?? [])->map(function ($i) {
            $i['item_id'] = dhid((string) ($i['item_id'] ?? ''));
            return $i;
        })->toArray();

        $request->merge([
            'to_warehouse_id' => dhid((string) ($request->to_warehouse_id ?? '')),
            'sender_id'       => $request->sender_id ? dhid((string) $request->sender_id) : null,
            'items'           => $decodedItems,
        ]);

        $request->validate([
            'to_warehouse_id'          => 'required|integer|exists:warehouses,id',
            'sender_name'              => 'required|string|max:100',
            'sender_id'                => 'nullable|integer|exists:users,id',
            'note'                     => 'nullable|string|max:1000',
            'items'                    => 'required|array|min:1',
            'items.*.item_id'          => 'required|integer|exists:items,id',
            'items.*.quantity'         => 'required|integer|min:1',
            'items.*.unit_price'       => 'required|integer|min:0',
        ]);

        $mainWarehouse = Warehouse::where('is_default', true)->firstOrFail();
        $toWarehouseId = (int) $request->to_warehouse_id;

        if ($toWarehouseId === $mainWarehouse->id) {
            return back()->withErrors(['to_warehouse_id' => 'Tidak dapat mengirim ke gudang utama sendiri.'])->withInput();
        }

        $errorResponse = null;

        DB::transaction(function () use ($request, $mainWarehouse, $toWarehouseId, &$errorResponse) {
            $cartItems = $request->items;

            // Validate stock at source (main warehouse)
            foreach ($cartItems as $ci) {
                $item = Item::findOrFail($ci['item_id']);
                $wi   = WarehouseItem::where('warehouse_id', $mainWarehouse->id)
                    ->where('item_id', $item->id)->first();
                $available = $wi ? $wi->stok : 0;

                if ($available < $ci['quantity']) {
                    $errorResponse = ['items' => "Stok {$item->nama} di {$mainWarehouse->name} tidak cukup. Tersedia: {$available}, diminta: {$ci['quantity']}"];
                    return;
                }
            }

            // Create delivery order
            $do = DeliveryOrder::create([
                'do_number'         => DeliveryOrder::generateNumber(),
                'from_warehouse_id' => $mainWarehouse->id,
                'to_warehouse_id'   => $toWarehouseId,
                'status'            => 'pending',
                'sender_id'         => $request->sender_id ?? Auth::id(),
                'sender_name'       => $request->sender_name,
                'sent_at'           => now(),
                'note'              => $request->note,
                'created_by'        => Auth::id(),
            ]);

            // Create line items
            foreach ($cartItems as $ci) {
                $item = Item::find($ci['item_id']);
                DeliveryOrderItem::create([
                    'delivery_order_id'  => $do->id,
                    'item_id'            => $ci['item_id'],
                    'item_name_snapshot' => $item->nama,
                    'item_code_snapshot' => $item->kode_item,
                    'quantity'           => (int) $ci['quantity'],
                    'unit_price'         => (int) $ci['unit_price'],
                ]);
            }

            AuditLogger::log('delivery_order.created', $do, null, [
                'do_number'   => $do->do_number,
                'to'          => $toWarehouseId,
                'items_count' => count($cartItems),
            ]);
        });

        if ($errorResponse) {
            return back()->withErrors($errorResponse)->withInput();
        }

        return redirect()->route('delivery_orders.index')
            ->with('success', 'Surat Jalan berhasil dibuat.');
    }

    // ── SHOW ──────────────────────────────────────────────────────────────────

    public function show(DeliveryOrder $deliveryOrder)
    {
        $deliveryOrder->load(['fromWarehouse', 'toWarehouse', 'items.item', 'sender', 'recipient', 'creator']);

        $props = ['order' => $this->formatOrder($deliveryOrder)];

        // When pending, pass items that have stock at the source warehouse
        // so the inline "Tambah Produk" form can show a search list.
        if ($deliveryOrder->isPending()) {
            $fromId = $deliveryOrder->from_warehouse_id;
            $existingItemIds = $deliveryOrder->items->pluck('item_id')->toArray();

            $addableItems = DB::table('items')
                ->where('items.type', 'barang')
                ->leftJoin('warehouse_items as wi', function ($join) use ($fromId) {
                    $join->on('wi.item_id', '=', 'items.id')
                         ->where('wi.warehouse_id', $fromId);
                })
                ->select('items.id', 'items.nama', 'items.kode_item', 'items.harga_jual',
                         DB::raw('COALESCE(wi.stok, 0) as main_stock'))
                ->having('main_stock', '>', 0)
                ->orderBy('items.nama')
                ->get()
                ->filter(fn ($i) => ! in_array($i->id, $existingItemIds))
                ->map(fn ($i) => [
                    'id'          => hid($i->id),
                    'name'        => $i->nama,
                    'code'        => $i->kode_item,
                    'global_price'=> $i->harga_jual,
                    'main_stock'  => (int) $i->main_stock,
                ])
                ->values();

            $props['addableItems'] = $addableItems;
        }

        return Inertia::render('inventory/ShowDeliveryOrder', $props);
    }

    // ── ADD ITEM (pending only) ────────────────────────────────────────────────

    public function addItem(Request $request, DeliveryOrder $deliveryOrder)
    {
        if (! $deliveryOrder->isPending()) {
            return back()->withErrors(['status' => 'Item hanya dapat ditambahkan ke Surat Jalan dengan status pending.']);
        }

        $request->merge([
            'item_id' => dhid((string) ($request->item_id ?? '')),
        ]);

        $request->validate([
            'item_id'    => 'required|integer|exists:items,id',
            'quantity'   => 'required|integer|min:1',
            'unit_price' => 'required|integer|min:0',
        ]);

        $fromId = $deliveryOrder->from_warehouse_id;
        $item   = Item::findOrFail($request->item_id);

        // Prevent duplicate items on the same SJ
        if ($deliveryOrder->items()->where('item_id', $item->id)->exists()) {
            return back()->withErrors(['item_id' => "{$item->nama} sudah ada di Surat Jalan ini."]);
        }

        // Check source stock
        $wi        = WarehouseItem::where('warehouse_id', $fromId)->where('item_id', $item->id)->first();
        $available = $wi ? $wi->stok : 0;
        if ($available < (int) $request->quantity) {
            return back()->withErrors(['quantity' => "Stok {$item->nama} tidak cukup. Tersedia: {$available}"]);
        }

        DeliveryOrderItem::create([
            'delivery_order_id'  => $deliveryOrder->id,
            'item_id'            => $item->id,
            'item_name_snapshot' => $item->nama,
            'item_code_snapshot' => $item->kode_item,
            'quantity'           => (int) $request->quantity,
            'unit_price'         => (int) $request->unit_price,
        ]);

        AuditLogger::log('delivery_order.item_added', $deliveryOrder, null, [
            'do_number' => $deliveryOrder->do_number,
            'item'      => $item->nama,
            'quantity'  => $request->quantity,
        ]);

        return redirect()->route('delivery_orders.show', $deliveryOrder->id)
            ->with('success', "{$item->nama} berhasil ditambahkan ke Surat Jalan.");
    }

    // ── CONFIRM ───────────────────────────────────────────────────────────────

    public function confirm(Request $request, DeliveryOrder $deliveryOrder)
    {
        if (! $deliveryOrder->isPending()) {
            return back()->withErrors(['status' => 'Surat Jalan ini sudah ' . $deliveryOrder->status . '.']);
        }

        $decodedConfirmItems = collect($request->items ?? [])->map(function ($i) {
            $i['doi_id'] = dhid((string) ($i['doi_id'] ?? ''));
            return $i;
        })->toArray();

        $request->merge([
            'recipient_id' => $request->recipient_id ? dhid((string) $request->recipient_id) : null,
            'items'        => $decodedConfirmItems,
        ]);

        $request->validate([
            'recipient_name' => 'required|string|max:100',
            'recipient_id'   => 'nullable|integer|exists:users,id',
            'items'          => 'required|array|min:1',
            'items.*.doi_id'            => 'required|integer',
            'items.*.quantity_received' => 'required|integer|min:0',
        ]);

        // Build lookup: doi_id → quantity_received
        $receivedMap = collect($request->items)
            ->keyBy('doi_id')
            ->map(fn ($i) => (int) $i['quantity_received']);

        $errorResponse = null;

        DB::transaction(function () use ($request, $deliveryOrder, $receivedMap, &$errorResponse) {
            $fromId = $deliveryOrder->from_warehouse_id;
            $toId   = $deliveryOrder->to_warehouse_id;

            foreach ($deliveryOrder->items as $doi) {
                $qtyReceived = $receivedMap->get($doi->id, 0);

                // Always save quantity_received (even 0 = not received)
                $doi->quantity_received = $qtyReceived;
                $doi->save();

                if ($qtyReceived === 0) continue; // skip stock movement

                $item = Item::lockForUpdate()->find($doi->item_id);
                if (! $item) continue;

                // Deduct from source
                $fromWi = WarehouseItem::where('warehouse_id', $fromId)
                    ->where('item_id', $item->id)->lockForUpdate()->first();

                $available = $fromWi ? $fromWi->stok : 0;
                if ($available < $qtyReceived) {
                    $errorResponse = ['stock' => "Stok {$item->nama} di gudang asal tidak cukup ({$available} tersedia, {$qtyReceived} dikonfirmasi)."];
                    return;
                }

                $fromWi->stok -= $qtyReceived;
                $fromWi->save();

                // Add to destination
                $toWi = WarehouseItem::where('warehouse_id', $toId)
                    ->where('item_id', $item->id)->lockForUpdate()->first();

                if (! $toWi) {
                    $toWi = WarehouseItem::create([
                        'warehouse_id' => $toId,
                        'item_id'      => $item->id,
                        'stok'         => 0,
                        'stok_minimal' => 0,
                    ]);
                }
                $toWi->stok += $qtyReceived;
                $toWi->save();

                // Ensure outlet price exists
                WarehouseItemPrice::updateOrCreate(
                    ['warehouse_id' => $toId, 'item_id' => $item->id],
                    ['harga_jual'   => $doi->unit_price]
                );

                // Recalc global stock
                $item->stok = (int) WarehouseItem::where('item_id', $item->id)->sum('stok');
                $item->save();

                // Create stock transfer record
                StockTransfer::create([
                    'txn_id'            => 'TRF-' . strtoupper(Str::random(10)),
                    'from_warehouse_id' => $fromId,
                    'to_warehouse_id'   => $toId,
                    'item_id'           => $item->id,
                    'quantity'          => $qtyReceived,
                    'occurred_at'       => now(),
                    'reference'         => $deliveryOrder->do_number,
                    'actor'             => $request->recipient_name,
                    'note'              => "Konfirmasi Surat Jalan {$deliveryOrder->do_number}",
                    'status'            => 'completed',
                    'delivery_order_id' => $deliveryOrder->id,
                ]);
            }

            // Update delivery order status
            $deliveryOrder->update([
                'status'         => 'confirmed',
                'recipient_id'   => $request->recipient_id ?? Auth::id(),
                'recipient_name' => $request->recipient_name,
                'confirmed_at'   => now(),
            ]);

            AuditLogger::log('delivery_order.confirmed', $deliveryOrder, null, [
                'do_number'      => $deliveryOrder->do_number,
                'recipient_name' => $request->recipient_name,
            ]);
        });

        if ($errorResponse) {
            return back()->withErrors($errorResponse);
        }

        return redirect()->route('delivery_orders.show', $deliveryOrder->id)
            ->with('success', 'Surat Jalan berhasil dikonfirmasi. Stok telah dipindahkan.');
    }

    // ── CANCEL ────────────────────────────────────────────────────────────────

    public function cancel(DeliveryOrder $deliveryOrder)
    {
        if (! $deliveryOrder->isPending()) {
            return back()->withErrors(['status' => 'Hanya Surat Jalan dengan status pending yang dapat dibatalkan.']);
        }

        $deliveryOrder->update(['status' => 'cancelled']);

        AuditLogger::log('delivery_order.cancelled', $deliveryOrder, null, [
            'do_number' => $deliveryOrder->do_number,
        ]);

        return redirect()->route('delivery_orders.index')
            ->with('success', 'Surat Jalan berhasil dibatalkan.');
    }

    // ── PRINT ─────────────────────────────────────────────────────────────────

    public function print(DeliveryOrder $deliveryOrder)
    {
        $deliveryOrder->load(['fromWarehouse', 'toWarehouse', 'items.item', 'sender', 'recipient', 'creator']);

        return Inertia::render('inventory/PrintDeliveryOrder', [
            'order' => $this->formatOrder($deliveryOrder),
        ]);
    }

    // ── HELPER ────────────────────────────────────────────────────────────────

    private function formatOrder(DeliveryOrder $do): array
    {
        return [
            'id'            => hid($do->id),
            'doNumber'      => $do->do_number,
            'status'        => $do->status,
            'fromWarehouse' => $do->fromWarehouse ? [
                'id'       => hid($do->fromWarehouse->id),
                'name'     => $do->fromWarehouse->name,
                'location' => $do->fromWarehouse->location,
                'city'     => $do->fromWarehouse->city,
                'phone'    => $do->fromWarehouse->phone,
            ] : null,
            'toWarehouse'   => $do->toWarehouse ? [
                'id'       => hid($do->toWarehouse->id),
                'name'     => $do->toWarehouse->name,
                'location' => $do->toWarehouse->location,
                'city'     => $do->toWarehouse->city,
                'phone'    => $do->toWarehouse->phone,
            ] : null,
            'senderName'    => $do->sender_name,
            'senderUser'    => $do->sender?->name,
            'recipientName' => $do->recipient_name,
            'recipientUser' => $do->recipient?->name,
            'sentAt'        => $do->sent_at?->toISOString(),
            'confirmedAt'   => $do->confirmed_at?->toISOString(),
            'note'          => $do->note,
            'createdAt'     => $do->created_at?->toISOString(),
            'createdBy'     => $do->creator?->name,
            'items'         => $do->items->map(fn ($doi) => [
                'id'               => hid($doi->id),
                'itemId'           => hid($doi->item_id),
                'itemName'         => $doi->item_name_snapshot,
                'itemCode'         => $doi->item_code_snapshot,
                'quantity'         => $doi->quantity,
                'unitPrice'        => $doi->unit_price,
                'subtotal'         => $doi->quantity * $doi->unit_price,
                'quantityReceived' => $doi->quantity_received,
            ])->values()->all(),
            'grandTotal'    => $do->items->sum(fn ($doi) => $doi->quantity * $doi->unit_price),
        ];
    }
}
