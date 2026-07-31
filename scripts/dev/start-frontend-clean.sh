#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FRONTEND_DIR="$REPO_ROOT/frontend"
# Keep the managed dev server aligned with Playwright, auth.setup.ts, and
# scripts/agent-browser/agent-browser-verify.mjs, whose canonical default is 3000.
PORT="${PORT:-3000}"
PID_FILE="/tmp/project-management-next-dev-${PORT}.pid"
DEV_HEAP_MB="${DEV_HEAP_MB:-12288}"
NEXT_DEV_ENGINE="${NEXT_DEV_ENGINE:-webpack}"
NEXT_DIST_DIR="${NEXT_DIST_DIR:-.next-dev-${PORT}}"
NEXT_TSCONFIG_PATH="${NEXT_TSCONFIG_PATH:-.tsconfig-dev-${PORT}.json}"

find_escaped_node_modules_link() {
  if [[ ! -d "$FRONTEND_DIR/node_modules" ]]; then
    return 1
  fi

  local link
  while IFS= read -r link; do
    local target
    target="$(realpath "$link" 2>/dev/null || true)"
    if [[ -n "$target" && "$target" != "$FRONTEND_DIR/"* ]]; then
      printf '%s -> %s\n' "$link" "$target"
      return 0
    fi
  done < <(find "$FRONTEND_DIR/node_modules" -maxdepth 1 -type l 2>/dev/null | sort)

  return 1
}

assert_local_node_modules() {
  local escaped_link
  escaped_link="$(find_escaped_node_modules_link || true)"
  if [[ -n "$escaped_link" ]]; then
    cat >&2 <<EOF
[frontend-dev] Refusing to start with node_modules symlinked outside this checkout.
[frontend-dev] First escaped dependency: $escaped_link
[frontend-dev] Repair with:
[frontend-dev]   rm -rf "$FRONTEND_DIR/node_modules" "$FRONTEND_DIR/.next"
[frontend-dev]   pnpm --dir "$FRONTEND_DIR" install --frozen-lockfile
EOF
    exit 1
  fi
}

is_alleato_next_pid() {
  local pid="$1"
  local cmd
  cmd="$(ps -p "$pid" -o command= 2>/dev/null || true)"
  [[ -n "$cmd" ]] && [[ "$cmd" == *"next dev"* ]] && [[ "$cmd" == *"$FRONTEND_DIR"* ]]
}

is_server_healthy() {
  curl -s -o /dev/null -w "%{http_code}" --max-time 3 "http://localhost:${PORT}" 2>/dev/null | grep -qE "^[23]"
}

assert_local_node_modules

# If a managed process is already running and the server is healthy, do nothing.
if [[ -f "$PID_FILE" ]]; then
  managed_pid="$(cat "$PID_FILE" 2>/dev/null || true)"
  if [[ -n "${managed_pid:-}" ]] && is_alleato_next_pid "$managed_pid"; then
    if is_server_healthy; then
      echo "[frontend-dev] Server already running (PID $managed_pid) and healthy at http://localhost:${PORT} — following existing process."
      while kill -0 "$managed_pid" 2>/dev/null; do sleep 1; done
      exit 0
    fi
    echo "[frontend-dev] Server PID $managed_pid is not responding — restarting."
    kill "$managed_pid" 2>/dev/null || true
    for _ in {1..20}; do
      if ! ps -p "$managed_pid" >/dev/null 2>&1; then break; fi
      sleep 0.25
    done
  fi
  rm -f "$PID_FILE"
fi

# Kill any existing repo-local Next dev processes on our port.
alleato_pids="$(pgrep -f "${FRONTEND_DIR}.*next dev.*--port ${PORT}" 2>/dev/null || true)"
if [[ -n "${alleato_pids:-}" ]]; then
  if is_server_healthy; then
    echo "[frontend-dev] Found healthy repo-local server — adopting."
    first_pid="$(echo "$alleato_pids" | head -1)"
    echo "$first_pid" > "$PID_FILE"
    while kill -0 "$first_pid" 2>/dev/null; do sleep 1; done
    exit 0
  fi
  echo "[frontend-dev] Found stale repo-local Next dev processes — killing:"
  while IFS= read -r pid; do
    [[ -z "$pid" ]] && continue
    ps -p "$pid" -o pid=,command= 2>/dev/null || true
    kill "$pid" 2>/dev/null || true
  done <<< "$alleato_pids"
  for _ in {1..20}; do
    remaining="$(pgrep -f "${FRONTEND_DIR}.*next dev.*--port ${PORT}" 2>/dev/null || true)"
    [[ -z "${remaining:-}" ]] && break
    sleep 0.25
  done
fi

cd "$FRONTEND_DIR"
echo "$$" > "$PID_FILE"
export NODE_OPTIONS="--max-old-space-size=${DEV_HEAP_MB}"
export NEXT_DIST_DIR
export NEXT_TSCONFIG_PATH
NEXT_BIN="$FRONTEND_DIR/node_modules/.bin/next"

if [[ ! -x "$NEXT_BIN" ]]; then
  echo "[frontend-dev] Missing local Next.js binary at $NEXT_BIN" >&2
  exit 1
fi

rm -rf "$FRONTEND_DIR/$NEXT_DIST_DIR"

# Next automatically adds `${distDir}/types/**/*.ts` to the configured
# TypeScript file. Give every port its own ignored config so concurrent dev
# servers never mutate the tracked production tsconfig or make builds scan
# another server's generated output.
node "$FRONTEND_DIR/scripts/dev/write-dev-tsconfig.mjs" \
  "$FRONTEND_DIR/tsconfig.json" \
  "$FRONTEND_DIR/$NEXT_TSCONFIG_PATH" \
  "$NEXT_DIST_DIR"

if [[ "$NEXT_DEV_ENGINE" == "turbopack" ]]; then
  exec "$NEXT_BIN" dev --port "$PORT" --turbopack
fi

exec "$NEXT_BIN" dev --port "$PORT"
