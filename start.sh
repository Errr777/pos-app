#!/bin/sh
set -e

# Wait for MySQL to be ready
echo "[start] Waiting for MySQL..."
until php -r "new PDO('mysql:host=${DB_HOST:-host.docker.internal};port=${DB_PORT:-3306};dbname=${DB_DATABASE}', '${DB_USERNAME}', '${DB_PASSWORD}');" 2>/dev/null; do
    sleep 2
done
echo "[start] MySQL ready."

# Fix permissions
chown -R www-data:www-data \
    /var/www/html/storage \
    /var/www/html/bootstrap/cache
chmod -R 775 \
    /var/www/html/storage \
    /var/www/html/bootstrap/cache

# Run migrations (safe to run on every start — skips already-applied)
php artisan migrate --force --ansi

# Create storage symlink (idempotent)
php artisan storage:link --force 2>/dev/null || true

# Cache config/routes/views for performance
php artisan config:cache --ansi
php artisan route:cache --ansi
php artisan view:cache --ansi

# Start supervisord (nginx + php-fpm)
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
