#!/usr/bin/env sh
set -e

if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL is not set (Railway Variables → file:/data/prod.db)"
  exit 1
fi

if [ -n "$DATA_DIR" ]; then
  mkdir -p "$DATA_DIR/uploads"
fi

echo "[start] prisma migrate deploy..."
npx prisma migrate deploy

HOST="${HOST:-0.0.0.0}"
PORT="${PORT:-3000}"
echo "[start] next start on ${HOST}:${PORT}..."
exec npx next start -H "$HOST" -p "$PORT"
