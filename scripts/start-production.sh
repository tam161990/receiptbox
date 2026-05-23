#!/usr/bin/env sh
set -e

if [ -n "$DATA_DIR" ]; then
  mkdir -p "$DATA_DIR/uploads"
fi

npx prisma migrate deploy

HOST="${HOST:-0.0.0.0}"
PORT="${PORT:-3000}"
exec npx next start -H "$HOST" -p "$PORT"
