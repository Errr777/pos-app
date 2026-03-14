#!/bin/sh
set -e

# Ensure database file and directories exist (volume may be fresh)
mkdir -p /var/www/html/database
touch /var/www/html/database/database.sqlite

# Fix permissions
chown -R www-data:www-data \
    /var/www/html/storage \
    /var/www/html/bootstrap/cache \
    /var/www/html/database
chmod -R 775 \
    /var/www/html/storage \
    /var/www/html/bootstrap/cache

# If APP_URL env var is provided at runtime (e.g. docker-compose env_file),
# update it in the baked .env so artisan commands use the correct URL
if [ -n "$APP_URL" ]; then
    sed -i "s|^APP_URL=.*|APP_URL=${APP_URL}|" /var/www/html/.env
fi

# Run migrations (safe to run on every start — skips already-applied)
php artisan migrate --force --ansi

# Create storage symlink (idempotent)
php artisan storage:link --force 2>/dev/null || true

# Cache config/routes/views for performance
php artisan config:cache --ansi
php artisan route:cache --ansi
php artisan view:cache --ansi

# Start supervisord (nginx + php-fpm + queue-worker)
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
