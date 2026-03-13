<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Expense extends Model
{
    protected $fillable = [
        'occurred_at',
        'category',
        'amount',
        'description',
        'warehouse_id',
        'created_by',
    ];

    protected $casts = [
        'occurred_at' => 'date',
        'amount'      => 'integer',
        'warehouse_id'=> 'integer',
        'created_by'  => 'integer',
    ];

    public const CATEGORIES = [
        'Gaji'          => 'Gaji & Upah',
        'Sewa'          => 'Sewa Tempat',
        'Utilitas'      => 'Listrik & Air',
        'Transportasi'  => 'Transportasi',
        'Pemasaran'     => 'Pemasaran',
        'Perlengkapan'  => 'Perlengkapan',
        'Pemeliharaan'  => 'Pemeliharaan',
        'Lain-lain'     => 'Lain-lain',
    ];

    public function warehouse()
    {
        return $this->belongsTo(Warehouse::class);
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
