<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Promotion extends Model
{
    protected $fillable = [
        'name', 'code', 'type', 'value', 'applies_to',
        'applies_id', 'min_purchase', 'max_discount',
        'start_date', 'end_date', 'is_active',
    ];

    protected $casts = [
        'value'        => 'integer',
        'min_purchase' => 'integer',
        'max_discount' => 'integer',
        'is_active'    => 'boolean',
        'start_date'   => 'date',
        'end_date'     => 'date',
    ];

    public function scopeActive($query)
    {
        return $query->where('is_active', true)
            ->where('start_date', '<=', today())
            ->where('end_date', '>=', today());
    }
}
