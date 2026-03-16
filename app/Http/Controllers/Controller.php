<?php

namespace App\Http\Controllers;

abstract class Controller
{
    protected array $middlewares = [];

    public function middleware(callable|string $middleware, array $options = []): static
    {
        $this->middlewares[] = ['middleware' => $middleware, 'options' => $options];
        return $this;
    }

    public function getMiddleware(): array
    {
        return $this->middlewares;
    }
}
