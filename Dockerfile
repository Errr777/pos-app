# Stage 1: Build Frontend (React + Vite)
FROM node:22.22.2-alpine AS frontend-builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Runtime PHP & Nginx (Production)
FROM php:8.3.30-fpm-alpine

# Install system dependencies & PHP extensions
RUN apk add --no-cache \
    nginx \
    supervisor \
    libpng-dev \
    libxml2-dev \
    zip \
    unzip \
    libzip-dev

RUN docker-php-ext-install pdo_mysql bcmath gd zip calendar

# Konfigurasi Nginx & Supervisord
COPY ./docker/nginx/default.conf /etc/nginx/http.d/default.conf
COPY ./docker/supervisord.conf /etc/supervisor/conf.d/supervisord.conf

WORKDIR /var/www/html

# Copy Laravel backend & Frontend Build
COPY --chown=www-data:www-data . .
COPY --from=frontend-builder --chown=www-data:www-data /app/public /var/www/html/public

# Install Composer (Production mode)
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer
RUN mkdir -p bootstrap/cache \
        storage/logs \
        storage/framework/cache \
        storage/framework/sessions \
        storage/framework/views \
    && chmod -R 775 bootstrap/cache storage \
    && composer install --no-dev --optimize-autoloader

# Copy & wire start script
COPY ./docker/start.sh /usr/local/bin/start.sh
RUN chmod +x /usr/local/bin/start.sh

# Persiapkan folder storage agar writable
RUN chmod -R 775 storage bootstrap/cache

EXPOSE 80

CMD ["/usr/local/bin/start.sh"]