<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use App\Models\User;

class UserSeeder extends Seeder
{
    public function run(): void
    {
        $users = [
            [
                'name'              => 'Admin',
                'email'             => 'admin@admin.com',
                'role'              => 'admin',
                'password'          => Hash::make('12345678'),
                'email_verified_at' => now(),
            ],
            [
                'name'              => 'Budi Staff',
                'email'             => 'staff@pos.com',
                'role'              => 'staff',
                'password'          => Hash::make('12345678'),
                'email_verified_at' => now(),
            ],
            [
                'name'              => 'Kasir Satu',
                'email'             => 'kasir1@pos.com',
                'role'              => 'kasir',
                'password'          => Hash::make('12345678'),
                'email_verified_at' => now(),
            ],
            [
                'name'              => 'Kasir Dua',
                'email'             => 'kasir2@pos.com',
                'role'              => 'kasir',
                'password'          => Hash::make('12345678'),
                'email_verified_at' => now(),
            ],
        ];

        foreach ($users as $data) {
            User::firstOrCreate(
                ['email' => $data['email']],
                array_merge($data, ['created_at' => now(), 'updated_at' => now()])
            );
        }
    }
}
