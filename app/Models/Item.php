<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Item extends Model
{
    use HasFactory;

    protected $table = 'items';

    protected $fillable = [
        'kode_item',
        'nama',
        'deskripsi',
        'stok',
        'stok_minimal',
        'harga_beli',
        'harga_jual',
        'kategori',
        'id_kategori',
    ];

    protected $casts = [
        'stok'        => 'integer',
        'stok_minimal'=> 'integer',
        'harga_beli'  => 'integer',
        'harga_jual'  => 'integer',
        'id_kategori' => 'integer',
    ];

    public function kategoriRelation()
    {
        return $this->belongsTo(Kategori::class, 'id_kategori');
    }

    public function tags()
    {
        return $this->belongsToMany(Tag::class, 'item_tag');
    }
}