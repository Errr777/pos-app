<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Item extends Model
{
    use HasFactory;

    protected $table = 'items';

    protected $fillable = [
        'type',
        'kode_item',
        'nama',
        'deskripsi',
        'image_path',
        'stok',
        'stok_minimal',
        'harga_beli',
        'harga_jual',
        'kategori',
        'id_kategori',
        'preferred_supplier_id',
    ];

    protected $casts = [
        'stok'                  => 'integer',
        'stok_minimal'          => 'integer',
        'harga_beli'            => 'integer',
        'harga_jual'            => 'integer',
        'id_kategori'           => 'integer',
        'preferred_supplier_id' => 'integer',
    ];

    public function kategoriRelation()
    {
        return $this->belongsTo(Kategori::class, 'id_kategori');
    }

    public function tags()
    {
        return $this->belongsToMany(Tag::class, 'item_tag');
    }

    public function preferredSupplier()
    {
        return $this->belongsTo(Supplier::class, 'preferred_supplier_id');
    }

    public function variants()
    {
        return $this->hasMany(ItemVariant::class)->where('is_active', true)->orderBy('name');
    }

    public function warehousePrices()
    {
        return $this->hasMany(WarehouseItemPrice::class);
    }
}