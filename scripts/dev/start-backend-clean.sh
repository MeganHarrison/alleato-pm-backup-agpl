#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BACKEND_DIR="$REPO_ROOT/backend"
PID_FILE="/tmp/alleato-backend-dev.pid"
PORT="${PORT:-8000}"
BACKEND_MATCH="uvicorn src.api.main:app"

get_command_for_pid() {
  local pid="$1"
  ps -p "$pid" -o command= 2>/dev/null || true
}

is_matching_backend_pid() {
  local pid="$1"
  local cmd
  cmd="$(get_command_for_pid "$pid")"
  [[ -n "$cmd" ]] && [[ "$cmd" == *"$BACKEND_MATCH"* ]]
}

stop_pid_if_running() {
  local pid="$1"
  kill "$pid" 2>/dev/null || true
  for _ in {1..20}; do
    if ! ps -p "$pid" >/dev/null 2>&1; then
      return 0
    fi
    sleep 0.25
  done
}

find_listener_pid() {
  lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null | head -n 1 || true
}

# Stop only the backend process previously started by this script.
if [[ -f "$PID_FILE" ]]; then
  managed_pid="$(cat "$PID_FILE" 2>/dev/null || true)"
  if [[ -n "${managed_pid:-}" ]] && is_matching_backend_pid "$managed_pid"; then
    echo "[backend-dev] Stopping managed backend process (PID $managed_pid)"
    stop_pid_if_running "$managed_pid"
  fi
  rm -f "$PID_FILE"
fi

listener_pid="$(find_listener_pid)"
if [[ -n "${listener_pid:-}" ]]; then
  listener_cmd="$(get_command_for_pid "$listener_pid")"
  if [[ "$listener_cmd" == *"$BACKEND_MATCH"* ]]; then
    echo "[backend-dev] Found stale Alleato backend listener on port $PORT (PID $listener_pid) - stopping it"
    stop_pid_if_running "$listener_pid"
  else
    echo "[backend-dev] Port $PORT is already in use by PID $listener_pid"
    echo "[backend-dev] Command: ${listener_cmd:-unknown}"
    echo "[backend-dev] Refusing to start because this script only manages Alleato backend processes."
    exit 1
  fi
fi

if listener_pid="$(find_listener_pid)" && [[ -n "${listener_pid:-}" ]]; then
  echo "[backend-dev] Port $PORT is still in use after cleanup (PID $listener_pid)"
  echo "[backend-dev] Command: $(get_command_for_pid "$listener_pid")"
  exit 1
fi

cd "$BACKEND_DIR"
echo "$$" > "$PID_FILE"
exec ./start.sh
