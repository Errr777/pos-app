<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Customer extends Model
{
    protected $fillable = [
        'code',
        'name',
        'phone',
        'email',
        'address',
        'city',
        'notes',
        'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    public function saleHeaders()
    {
        return $this->hasMany(SaleHeader::class);
    }

    public function installmentPlans()
    {
        return $this->hasMany(InstallmentPlan::class);
    }

    public function hasActiveCredit(): bool
    {
        return $this->installmentPlans()
            ->whereIn('status', ['active', 'overdue'])
            ->exists();
    }

    public function isBlockedForCredit(): bool
    {
        return $this->installmentPlans()
            ->where('status', 'overdue')
            ->exists();
    }
}
