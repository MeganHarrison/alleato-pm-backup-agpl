#!/bin/bash
set -e

# Load environment variables from project files when available.
# This keeps local backend runs consistent with root-level dev workflows.
set -a
[ -f .env ] && source .env
[ -f ../.env ] && source ../.env
[ -f ../frontend/.env.local ] && source ../frontend/.env.local
set +a

# Use PORT env var from Render, default to 8000 for local
PORT=${PORT:-8000}

echo "Starting uvicorn on port $PORT..."
if [ -x ".venv/bin/python" ]; then
  exec .venv/bin/python -m uvicorn src.api.main:app --host 0.0.0.0 --port "$PORT"
fi

exec uvicorn src.api.main:app --host 0.0.0.0 --port "$PORT"
