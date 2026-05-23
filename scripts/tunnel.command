#!/usr/bin/env bash
# ReceiptBox LV — ngrok tunnel launcher (static domain).
#
# Reads the static ngrok domain from .env (APP_URL) and binds the tunnel to it,
# so Telegram never sees the URL change. Auto-restarts on crash.
#
# Usage:
#   1. Double-click from Finder, OR
#   2. ./scripts/tunnel.command from Terminal
#
# Press Ctrl+C to stop.

set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR" || exit 1

# Load nvm (ngrok was installed via npm into the nvm node version).
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  # shellcheck disable=SC1091
  . "$NVM_DIR/nvm.sh"
fi

# Fallback: search common paths if ngrok still not found.
if ! command -v ngrok >/dev/null 2>&1; then
  for candidate in \
      "$NVM_DIR/versions/node/"*/bin \
      /opt/homebrew/bin \
      /usr/local/bin; do
    if [ -x "$candidate/ngrok" ]; then
      export PATH="$candidate:$PATH"
      break
    fi
  done
fi

log() {
  printf "\n\033[1;35m[tunnel.command]\033[0m %s\n" "$*"
}

if ! command -v ngrok >/dev/null 2>&1; then
  echo "ERROR: ngrok not found. Install it with:"
  echo "  npm install -g ngrok"
  echo "  ngrok config add-authtoken YOUR_TOKEN"
  read -r -p "Press Enter to close..."
  exit 1
fi

# Read APP_URL from .env and strip protocol/quotes.
if [ ! -f .env ]; then
  echo "ERROR: .env not found in $PROJECT_DIR"
  read -r -p "Press Enter to close..."
  exit 1
fi

APP_URL_VALUE=$(awk -F= '/^APP_URL=/{gsub(/"/,"",$2); print $2}' .env)
DOMAIN=$(echo "$APP_URL_VALUE" | sed -E 's#^https?://##; s#/.*##')

if [ -z "$DOMAIN" ]; then
  echo "ERROR: could not parse APP_URL from .env"
  read -r -p "Press Enter to close..."
  exit 1
fi

log "Static domain: $DOMAIN"
log "Make sure 'npm run dev' is running on http://localhost:3000."

# Free port 4040 (ngrok local UI) from any leftover ngrok process.
free_ngrok() {
  local pids
  pids=$(pgrep -f "ngrok http" 2>/dev/null || true)
  if [ -n "$pids" ]; then
    log "Killing previous ngrok (pid $pids)…"
    # shellcheck disable=SC2086
    kill $pids 2>/dev/null || true
    sleep 1
  fi
}

cleanup() {
  log "Shutting down ngrok…"
  free_ngrok
  exit 0
}

trap cleanup INT TERM

attempt=0
while true; do
  attempt=$((attempt + 1))
  free_ngrok

  log "Starting ngrok (attempt #$attempt) — open https://${DOMAIN}"
  log "ngrok admin UI: http://localhost:4040"
  log "Press Ctrl+C to stop."

  set +e
  ngrok http --url="$DOMAIN" 3000
  exit_code=$?
  set -e

  if [ $exit_code -eq 0 ] || [ $exit_code -eq 130 ] || [ $exit_code -eq 143 ]; then
    log "ngrok stopped cleanly (exit $exit_code)."
    break
  fi

  log "ngrok crashed (exit $exit_code). Restarting in 3s…"
  sleep 3
done
