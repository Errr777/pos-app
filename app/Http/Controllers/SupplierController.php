<?php

namespace App\Http\Controllers;

use App\Helpers\AuditLogger;
use App\Models\Supplier;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Inertia\Inertia;

class SupplierController extends Controller
{
    public function index(Request $request)
    {
        if (!$request->user()->hasPermission('suppliers', 'can_view')) {
            abort(403);
        }

        $perPage = in_array((int) $request->get('per_page', 20), [10, 20, 50, 100])
            ? (int) $request->get('per_page', 20) : 20;
        $search  = trim((string) $request->get('search', ''));
        $status  = $request->get('status', 'all'); // 'all' | 'active' | 'inactive'
        $sortDir = strtolower($request->get('sort_dir', 'asc')) === 'desc' ? 'desc' : 'asc';

        $allowedSort = [
            'name'     => 'name',
            'code'     => 'code',
            'city'     => 'city',
            'phone'    => 'phone',
            'created'  => 'created_at',
        ];
        $sortKey    = $request->get('sort_by', 'name');
        $sortColumn = $allowedSort[$sortKey] ?? 'name';

        $query = Supplier::query();

        if ($search !== '') {
            $term = strtolower($search);
            $query->where(function ($q) use ($term) {
                $q->whereRaw('LOWER(name) like ?', ["%{$term}%"])
                  ->orWhereRaw('LOWER(code) like ?', ["%{$term}%"])
                  ->orWhereRaw('LOWER(contact_person) like ?', ["%{$term}%"])
                  ->orWhereRaw('LOWER(phone) like ?', ["%{$term}%"])
                  ->orWhereRaw('LOWER(email) like ?', ["%{$term}%"])
                  ->orWhereRaw('LOWER(city) like ?', ["%{$term}%"]);
            });
        }

        if ($status === 'active')   $query->where('is_active', true);
        if ($status === 'inactive') $query->where('is_active', false);

        $query->orderBy($sortColumn, $sortDir);

        $suppliers = $query->paginate($perPage)->withQueryString()->through(fn ($s) => [
            'id'            => $s->id,
            'name'          => $s->name,
            'code'          => $s->code,
            'contactPerson' => $s->contact_person,
            'phone'         => $s->phone,
            'email'         => $s->email,
            'address'       => $s->address,
            'city'          => $s->city,
            'notes'         => $s->notes,
            'isActive'      => $s->is_active,
            'createdAt'     => $s->created_at?->toISOString(),
        ]);

        return Inertia::render('supplier/Index', [
            'suppliers' => $suppliers,
            'filters'   => array_merge(
                $request->only(['search', 'per_page', 'status']),
                ['sort_by' => $sortKey, 'sort_dir' => $sortDir]
            ),
        ]);
    }

    public function store(Request $request)
    {
        if (!$request->user()->hasPermission('suppliers', 'can_write')) {
            abort(403);
        }

        $validator = Validator::make($request->all(), [
            'name'           => 'required|string|max:150',
            'code'           => 'nullable|string|max:30|unique:suppliers,code',
            'contact_person' => 'nullable|string|max:100',
            'phone'          => 'nullable|string|max:30',
            'email'          => 'nullable|email|max:150',
            'address'        => 'nullable|string|max:500',
            'city'           => 'nullable|string|max:100',
            'notes'          => 'nullable|string|max:1000',
            'is_active'      => 'boolean',
        ]);

        if ($validator->fails()) {
            return back()->withErrors($validator)->withInput();
        }

        $data = $validator->validated();

        // Auto-generate code if not provided
        if (empty($data['code'])) {
            $next = (Supplier::max('id') ?? 0) + 1;
            $data['code'] = 'SUP-' . str_pad($next, 4, '0', STR_PAD_LEFT);
        }

        $supplier = Supplier::create($data);
        AuditLogger::log('supplier.created', $supplier, null, ['name' => $supplier->name, 'code' => $supplier->code]);

        return redirect()->route('suppliers.index')->with('success', 'Supplier berhasil ditambahkan.');
    }

    public function update(Request $request, Supplier $supplier)
    {
        if (!$request->user()->hasPermission('suppliers', 'can_write')) {
            abort(403);
        }

        $validator = Validator::make($request->all(), [
            'name'           => 'required|string|max:150',
            'code'           => 'nullable|string|max:30|unique:suppliers,code,' . $supplier->id,
            'contact_person' => 'nullable|string|max:100',
            'phone'          => 'nullable|string|max:30',
            'email'          => 'nullable|email|max:150',
            'address'        => 'nullable|string|max:500',
            'city'           => 'nullable|string|max:100',
            'notes'          => 'nullable|string|max:1000',
            'is_active'      => 'boolean',
        ]);

        if ($validator->fails()) {
            return back()->withErrors($validator)->withInput();
        }

        $old = $supplier->only(['name', 'code', 'phone', 'is_active']);
        $supplier->update($validator->validated());
        AuditLogger::log('supplier.updated', $supplier, $old, $supplier->only(['name', 'code', 'phone', 'is_active']));

        return redirect()->route('suppliers.index')->with('success', 'Supplier berhasil diperbarui.');
    }

    public function destroy(Supplier $supplier)
    {
        if (!request()->user()->hasPermission('suppliers', 'can_delete')) {
            abort(403);
        }

        AuditLogger::log('supplier.deleted', $supplier, ['name' => $supplier->name, 'code' => $supplier->code]);
        $supplier->delete();

        return redirect()->route('suppliers.index')->with('success', 'Supplier berhasil dihapus.');
    }
}
