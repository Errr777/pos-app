# Stage 1: Build Frontend (React + Vite)
FROM node:22-alpine AS frontend-builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Runtime PHP & Nginx (Production)
FROM php:8.3-fpm-alpine

# Install system dependencies & PHP extensions
RUN apk add --no-cache \
    nginx \
    supervisor \
    libpng-dev \
    libxml2-dev \
    zip \
    unzip \
    libzip-dev

RUN docker-php-ext-install pdo_mysql bcmath gd zip

# Konfigurasi Nginx & Supervisord
COPY ./docker/nginx/default.conf /etc/nginx/http.d/default.conf
COPY ./docker/supervisord.conf /etc/supervisor/conf.d/supervisord.conf

WORKDIR /var/www/html

# Copy Laravel backend & Frontend Build
COPY --chown=www-data:www-data . .
COPY --from=frontend-builder --chown=www-data:www-data /app/public /var/www/html/public

# Install Composer (Production mode)
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer
RUN composer install --no-dev --optimize-autoloader

# Persiapkan folder storage agar writable
RUN chmod -R 775 storage bootstrap/cache

EXPOSE 80

CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]