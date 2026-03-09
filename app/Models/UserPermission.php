<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class UserPermission extends Model
{
    protected $fillable = [
        'user_id',
        'module',
        'can_view',
        'can_write',
        'can_delete',
    ];

    protected $casts = [
        'can_view'   => 'boolean',
        'can_write'  => 'boolean',
        'can_delete' => 'boolean',
    ];

    /**
     * All modules in the app and which actions are applicable.
     * 'actions' defines which checkboxes to show in the permission UI.
     */
    public static array $modules = [
        'dashboard'  => ['label' => 'Dashboard',            'actions' => ['view']],
        'items'      => ['label' => 'Produk & Kategori',    'actions' => ['view', 'write', 'delete']],
        'inventory'  => ['label' => 'Inventaris',           'actions' => ['view', 'write', 'delete']],
        'warehouses' => ['label' => 'Gudang',               'actions' => ['view', 'write', 'delete']],
        'reports'    => ['label' => 'Laporan',              'actions' => ['view']],
        'suppliers'       => ['label' => 'Supplier',           'actions' => ['view', 'write', 'delete']],
        'customers'       => ['label' => 'Pelanggan',          'actions' => ['view', 'write', 'delete']],
        'pos'             => ['label' => 'Kasir / POS',        'actions' => ['view', 'write', 'delete']],
        'purchase_orders' => ['label' => 'Purchase Order',     'actions' => ['view', 'write', 'delete']],
        'returns'         => ['label' => 'Retur Barang',       'actions' => ['view', 'write', 'delete']],
        'users'           => ['label' => 'Manajemen Pengguna', 'actions' => ['view', 'write', 'delete']],
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
