<?php

namespace App\Models;

use App\Traits\HasHashId;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Kategori extends Model
{
    use HasHashId;

    use HasFactory;

    protected $table = 'kategoris';

    protected $fillable = ['nama', 'deskripsi'];

    public function items()
    {
        return $this->hasMany(Item::class, 'id_kategori');
    }

    
}