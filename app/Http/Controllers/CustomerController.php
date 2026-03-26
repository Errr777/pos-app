<?php

namespace App\Http\Controllers;

use App\Helpers\AuditLogger;
use App\Models\Customer;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Inertia\Inertia;

class CustomerController extends Controller
{
    public function index(Request $request)
    {
        if (! $request->user()->hasPermission('customers', 'can_view')) {
            abort(403);
        }

        $perPage = in_array((int) $request->get('per_page', 20), [10, 20, 50, 100])
            ? (int) $request->get('per_page', 20) : 20;
        $search = trim((string) $request->get('search', ''));
        $status = $request->get('status', 'all');
        $sortDir = strtolower($request->get('sort_dir', 'asc')) === 'desc' ? 'desc' : 'asc';

        $allowedSort = [
            'name' => 'name',
            'code' => 'code',
            'city' => 'city',
            'phone' => 'phone',
            'created' => 'created_at',
        ];
        $sortKey = $request->get('sort_by', 'name');
        $sortColumn = $allowedSort[$sortKey] ?? 'name';

        $query = Customer::query();

        if ($search !== '') {
            $term = strtolower($search);
            $query->where(function ($q) use ($term) {
                $q->whereRaw('LOWER(name) like ?', ["%{$term}%"])
                    ->orWhereRaw('LOWER(code) like ?', ["%{$term}%"])
                    ->orWhereRaw('LOWER(phone) like ?', ["%{$term}%"])
                    ->orWhereRaw('LOWER(email) like ?', ["%{$term}%"])
                    ->orWhereRaw('LOWER(city) like ?', ["%{$term}%"]);
            });
        }

        if ($status === 'active') {
            $query->where('is_active', true);
        }
        if ($status === 'inactive') {
            $query->where('is_active', false);
        }

        $query->orderBy($sortColumn, $sortDir);

        $customers = $query->paginate($perPage)->withQueryString()->through(fn ($c) => [
            'id' => hid($c->id),
            'code' => $c->code,
            'name' => $c->name,
            'phone' => $c->phone,
            'email' => $c->email,
            'address' => $c->address,
            'city' => $c->city,
            'notes' => $c->notes,
            'isActive' => $c->is_active,
            'createdAt' => $c->created_at?->toISOString(),
        ]);

        return Inertia::render('customers/Index', [
            'customers' => $customers,
            'filters' => array_merge(
                $request->only(['search', 'per_page', 'status']),
                ['sort_by' => $sortKey, 'sort_dir' => $sortDir]
            ),
        ]);
    }

    public function show(Request $request, Customer $customer)
    {
        if (! $request->user()->hasPermission('customers', 'can_view')) {
            abort(403);
        }

        $plans = \App\Helpers\InstallmentPlanMapper::forCustomer($customer);

        $totalOutstanding = $plans
            ->where('status', '!=', 'completed')
            ->sum(fn ($p) => $p['remainingAmount']);

        return Inertia::render('customers/Show', [
            'customer' => [
                'id' => hid($customer->id),
                'name' => $customer->name,
                'code' => $customer->code,
                'phone' => $customer->phone,
                'email' => $customer->email,
                'address' => $customer->address,
                'city' => $customer->city,
                'notes' => $customer->notes,
            ],
            'plans' => $plans,
            'totalOutstanding' => $totalOutstanding,
            'isBlocked' => $customer->isBlockedForCredit(),
        ]);
    }

    public function store(Request $request)
    {
        if (! $request->user()->hasPermission('customers', 'can_write')) {
            abort(403);
        }

        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:150',
            'code' => 'nullable|string|max:30|unique:customers,code',
            'phone' => 'nullable|string|max:30',
            'email' => 'nullable|email|max:150',
            'address' => 'nullable|string|max:500',
            'city' => 'nullable|string|max:100',
            'notes' => 'nullable|string|max:1000',
            'is_active' => 'boolean',
        ]);

        if ($validator->fails()) {
            return back()->withErrors($validator)->withInput();
        }

        $data = $validator->validated();

        if (empty($data['code'])) {
            $next = (Customer::max('id') ?? 0) + 1;
            $data['code'] = 'CUST-'.str_pad($next, 4, '0', STR_PAD_LEFT);
        }

        $customer = Customer::create($data);
        AuditLogger::log('customer.created', $customer, null, ['name' => $customer->name, 'code' => $customer->code]);

        return redirect()->route('customers.index')->with('success', 'Pelanggan berhasil ditambahkan.');
    }

    public function update(Request $request, Customer $customer)
    {
        if (! $request->user()->hasPermission('customers', 'can_write')) {
            abort(403);
        }

        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:150',
            'code' => 'nullable|string|max:30|unique:customers,code,'.$customer->id,
            'phone' => 'nullable|string|max:30',
            'email' => 'nullable|email|max:150',
            'address' => 'nullable|string|max:500',
            'city' => 'nullable|string|max:100',
            'notes' => 'nullable|string|max:1000',
            'is_active' => 'boolean',
        ]);

        if ($validator->fails()) {
            return back()->withErrors($validator)->withInput();
        }

        $old = $customer->only(['name', 'code', 'phone', 'is_active']);
        $customer->update($validator->validated());
        AuditLogger::log('customer.updated', $customer, $old, $customer->only(['name', 'code', 'phone', 'is_active']));

        return redirect()->route('customers.index')->with('success', 'Pelanggan berhasil diperbarui.');
    }

    public function destroy(Customer $customer)
    {
        if (! request()->user()->hasPermission('customers', 'can_delete')) {
            abort(403);
        }

        AuditLogger::log('customer.deleted', $customer, ['name' => $customer->name, 'code' => $customer->code]);
        $customer->delete();

        return redirect()->route('customers.index')->with('success', 'Pelanggan berhasil dihapus.');
    }
}
