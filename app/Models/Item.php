<?php

namespace App\Models;

use App\Traits\HasHashId;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Item extends Model
{
    use HasHashId;

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

    public function saleItems()
    {
        return $this->hasMany(\App\Models\SaleItem::class, 'item_id');
    }

    public function purchaseOrderItems()
    {
        return $this->hasMany(\App\Models\PurchaseOrderItem::class, 'item_id');
    }

    public function returnItems()
    {
        return $this->hasMany(\App\Models\ReturnItem::class, 'item_id');
    }

    public function deliveryOrderItems()
    {
        return $this->hasMany(\App\Models\DeliveryOrderItem::class, 'item_id');
    }

    public function stockTransfers()
    {
        return $this->hasMany(\App\Models\StockTransfer::class, 'item_id');
    }
}