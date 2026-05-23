#!/usr/bin/env bash
# ReceiptBox LV — auto-restarting dev server launcher for macOS.
#
# Usage:
#   1. Double-click this file from Finder, OR
#   2. Run from Terminal: ./scripts/dev.command
#
# The script will:
#   - Load nvm (if installed)
#   - Free port 3000 from any leftover `next dev` process
#   - Clean .next/ cache before each start (avoids dev-mode corruption)
#   - Start `npm run dev`
#   - If the dev server crashes, wait a few seconds and restart automatically
#   - Press Ctrl+C to stop everything

set -u

# Resolve project root = parent of the scripts/ folder where this file lives.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR" || exit 1

# Pretty print helper.
log() {
  printf "\n\033[1;36m[dev.command]\033[0m %s\n" "$*"
}

# 1) Try to load nvm if installed.
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  # shellcheck disable=SC1091
  . "$NVM_DIR/nvm.sh"
fi

# 2) If npm still missing, try common locations directly (independent of zsh config).
if ! command -v npm >/dev/null 2>&1; then
  for candidate in \
      "$NVM_DIR/versions/node/"*/bin \
      /opt/homebrew/bin \
      /usr/local/bin; do
    if [ -x "$candidate/npm" ]; then
      export PATH="$candidate:$PATH"
      break
    fi
  done
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "ERROR: npm not found. Install Node.js via nvm:"
  echo "  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash"
  echo "Then close & reopen Terminal and try again."
  read -r -p "Press Enter to close..."
  exit 1
fi

log "Node:  $(node -v)"
log "npm:   $(npm -v)"
log "Dir:   $PROJECT_DIR"

# Free port 3000 from any leftover dev server.
free_port() {
  local pids
  pids=$(lsof -t -i :3000 2>/dev/null || true)
  if [ -n "$pids" ]; then
    log "Port 3000 busy (pid $pids) — terminating…"
    # shellcheck disable=SC2086
    kill $pids 2>/dev/null || true
    sleep 1
    pids=$(lsof -t -i :3000 2>/dev/null || true)
    if [ -n "$pids" ]; then
      # shellcheck disable=SC2086
      kill -9 $pids 2>/dev/null || true
    fi
  fi
}

cleanup() {
  log "Shutting down…"
  free_port
  exit 0
}

trap cleanup INT TERM

attempt=0
while true; do
  attempt=$((attempt + 1))
  free_port

  log "Cleaning .next/ cache (attempt #$attempt)…"
  rm -rf .next

  log "Starting npm run dev — open http://localhost:3000"
  log "Press Ctrl+C to stop."
  set +e
  npm run dev
  exit_code=$?
  set -e

  if [ $exit_code -eq 0 ] || [ $exit_code -eq 130 ] || [ $exit_code -eq 143 ]; then
    # 0 = normal exit, 130 = Ctrl+C, 143 = SIGTERM
    log "Dev server stopped cleanly (exit $exit_code)."
    break
  fi

  log "Dev server crashed (exit $exit_code). Restarting in 3s…"
  sleep 3
done

log "Bye."
