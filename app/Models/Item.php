<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Item extends Model
{
    use HasFactory;

    protected $table = 'items';

    protected $fillable = [
        'kode_barang',
        'nama',
        'deskripsi',
        'stok',
        'stok_minimal',
        'kategori',
        'id_kategori',
    ];

    protected $casts = [
        'stok' => 'integer',
        'stok_minimal' => 'integer',
        'id_kategori' => 'integer',
    ];

    public function kategoriRelation()
    {
        return $this->belongsTo(Kategori::class, 'id_kategori');
    }
}