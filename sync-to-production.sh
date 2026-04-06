#!/usr/bin/env bash
# ============================================================
# sync-to-production.sh
# Sync dev folder → production folder, then rebuild assets.
#
# Usage:
#   ./sync-to-production.sh            # full sync + build
#   ./sync-to-production.sh --dry-run  # preview only, no changes
#   ./sync-to-production.sh --files    # sync files only, skip build
# ============================================================

set -euo pipefail

DEV_DIR="$(cd "$(dirname "$0")" && pwd)"
PROD_DIR="/Users/errr/Developer/Project/my/pos/pos-app-production"

DRY_RUN=false
FILES_ONLY=false

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    --files)   FILES_ONLY=true ;;
  esac
done

# ── colours ──────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()    { echo -e "${GREEN}[sync]${NC} $*"; }
warn()    { echo -e "${YELLOW}[warn]${NC} $*"; }
section() { echo -e "\n${GREEN}══ $* ══${NC}"; }

# ── safety checks ────────────────────────────────────────────
if [[ ! -d "$PROD_DIR" ]]; then
  echo -e "${RED}[error]${NC} Production folder not found: $PROD_DIR"
  exit 1
fi

if [[ "$DRY_RUN" == true ]]; then
  warn "DRY RUN — no files will be changed"
fi

section "Syncing files: $DEV_DIR → $PROD_DIR"

RSYNC_FLAGS=(-avz --delete)
[[ "$DRY_RUN" == true ]] && RSYNC_FLAGS+=(--dry-run)

rsync "${RSYNC_FLAGS[@]}" \
  --exclude='.env' \
  --exclude='.env.*' \
  --exclude='node_modules/' \
  --exclude='vendor/' \
  --exclude='public/build/' \
  --exclude='public/hot' \
  --exclude='public/storage' \
  --exclude='bootstrap/ssr/' \
  --exclude='bootstrap/cache/' \
  --exclude='storage/logs/' \
  --exclude='storage/pail/' \
  --exclude='storage/framework/cache/' \
  --exclude='storage/framework/sessions/' \
  --exclude='storage/framework/views/' \
  --exclude='storage/framework/testing/' \
  --exclude='storage/*.key' \
  --exclude='database/database.sqlite' \
  --exclude='.git/' \
  --exclude='.worktrees/' \
  --exclude='.phpunit.cache' \
  --exclude='.phpunit.result.cache' \
  --exclude='.phpactor.json' \
  --exclude='npm-debug.log' \
  --exclude='yarn-error.log' \
  --exclude='.fleet/' \
  --exclude='.idea/' \
  --exclude='.nova/' \
  --exclude='.vscode/' \
  --exclude='.zed/' \
  --exclude='auth.json' \
  "$DEV_DIR/" "$PROD_DIR/"

info "File sync complete."

# ── skip build steps in dry-run or --files mode ──────────────
if [[ "$DRY_RUN" == true || "$FILES_ONLY" == true ]]; then
  [[ "$DRY_RUN" == true ]] && info "Dry run complete — no build steps executed."
  [[ "$FILES_ONLY" == true ]] && info "--files mode — skipping build steps."
  exit 0
fi

# ── build steps ──────────────────────────────────────────────
section "Installing PHP dependencies"
composer install --no-interaction --prefer-dist --optimize-autoloader \
  --working-dir="$PROD_DIR"

section "Installing Node dependencies"
(cd "$PROD_DIR" && npm ci)

section "Building frontend assets"
(cd "$PROD_DIR" && npm run build)

section "Building Docker image"
(cd "$PROD_DIR" && docker compose build)

section "Restarting containers"
(cd "$PROD_DIR" && docker compose up -d)

info "Waiting for app to finish startup (migrations run inside container via start.sh)..."
sleep 5
(cd "$PROD_DIR" && docker compose logs --tail=30 app) || true

info "✓ Sync complete!"
