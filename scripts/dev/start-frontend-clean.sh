#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FRONTEND_DIR="$REPO_ROOT/frontend"
# Keep the managed dev server aligned with Playwright, auth.setup.ts, and
# scripts/agent-browser/agent-browser-verify.mjs, whose canonical default is 3000.
PORT="${PORT:-3000}"
# A checkout gets one shared Next server by default. Per-port PID files used to
# make a second `npm run dev` look independent, which silently started another
# full compiler/cache process on 3001, 3002, and so on. Set
# ALLEATO_ALLOW_PARALLEL_FRONTEND_DEV=1 only for a deliberate isolated server.
ALLOW_PARALLEL_FRONTEND_DEV="${ALLEATO_ALLOW_PARALLEL_FRONTEND_DEV:-0}"
PID_FILE="/tmp/project-management-next-dev.pid"
if [[ "$ALLOW_PARALLEL_FRONTEND_DEV" == "1" ]]; then
  PID_FILE="/tmp/project-management-next-dev-${PORT}.pid"
fi
# 12 GB let one compiler crowd out the OS and every other app. Four GB is the
# safe shared-machine default; an unusually large local investigation can opt
# in with DEV_HEAP_MB=<value> and will be visible in its launch command.
DEV_HEAP_MB="${DEV_HEAP_MB:-4096}"
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
  local port="$1"
  curl -s -o /dev/null -w "%{http_code}" --max-time 3 "http://localhost:${port}" 2>/dev/null | grep -qE "^[23]"
}

next_port_for_pid() {
  local pid="$1"
  local cmd
  cmd="$(ps -p "$pid" -o command= 2>/dev/null || true)"
  if [[ "$cmd" =~ --port[[:space:]]+([0-9]+) ]]; then
    printf '%s\n' "${BASH_REMATCH[1]}"
  elif [[ "$cmd" =~ [[:space:]]-p[[:space:]]+([0-9]+) ]]; then
    printf '%s\n' "${BASH_REMATCH[1]}"
  else
    printf '3000\n'
  fi
}

find_repo_next_pids() {
  pgrep -f "${FRONTEND_DIR}.*next dev" 2>/dev/null || true
}

stop_next_pid() {
  local pid="$1"
  kill "$pid" 2>/dev/null || true
  for _ in {1..20}; do
    if ! ps -p "$pid" >/dev/null 2>&1; then
      return 0
    fi
    sleep 0.25
  done
  # A Next parent can remain parked after its worker has died, retaining the
  # compiler heap without a listener. Escalate only after the process was
  # proven to be this checkout's unresponsive `next dev` parent.
  kill -KILL "$pid" 2>/dev/null || true
  for _ in {1..8}; do
    if ! ps -p "$pid" >/dev/null 2>&1; then
      return 0
    fi
    sleep 0.25
  done
  return 1
}

show_status() {
  local found=0
  local pid
  while IFS= read -r pid; do
    [[ -z "$pid" ]] && continue
    local port
    port="$(next_port_for_pid "$pid")"
    local state="stale"
    if is_server_healthy "$port"; then state="healthy"; fi
    printf '[frontend-dev] %s server: PID %s at http://localhost:%s\n' "$state" "$pid" "$port"
    found=1
  done < <(find_repo_next_pids)
  if [[ "$found" == "0" ]]; then
    echo "[frontend-dev] No Next dev server is running for this checkout."
  fi
}

if [[ "${1:-}" == "--status" ]]; then
  show_status
  exit 0
fi

if [[ "${1:-}" == "--stop" ]]; then
  stopped=0
  while IFS= read -r pid; do
    [[ -z "$pid" ]] && continue
    port="$(next_port_for_pid "$pid")"
    echo "[frontend-dev] Stopping repo-local server PID $pid on port $port."
    stop_next_pid "$pid" || {
      echo "[frontend-dev] Timed out stopping PID $pid." >&2
      exit 1
    }
    stopped=1
  done < <(find_repo_next_pids)
  rm -f /tmp/project-management-next-dev*.pid
  [[ "$stopped" == "1" ]] || echo "[frontend-dev] No repo-local server was running."
  exit 0
fi

if [[ "${1:-}" == "--prune" ]]; then
  pruned=0
  while IFS= read -r pid; do
    [[ -z "$pid" ]] && continue
    port="$(next_port_for_pid "$pid")"
    if ! is_server_healthy "$port"; then
      echo "[frontend-dev] Removing unresponsive repo-local server PID $pid on port $port."
      stop_next_pid "$pid" || {
        echo "[frontend-dev] Timed out stopping PID $pid." >&2
        exit 1
      }
      rm -f "/tmp/project-management-next-dev-${port}.pid"
      pruned=1
    fi
  done < <(find_repo_next_pids)
  [[ "$pruned" == "1" ]] || echo "[frontend-dev] No unresponsive repo-local servers found."
  exit 0
fi

assert_local_node_modules

# If a managed process is already running and the server is healthy, do nothing.
if [[ -f "$PID_FILE" ]]; then
  managed_pid="$(cat "$PID_FILE" 2>/dev/null || true)"
  if [[ -n "${managed_pid:-}" ]] && is_alleato_next_pid "$managed_pid"; then
    managed_port="$(next_port_for_pid "$managed_pid")"
    if is_server_healthy "$managed_port"; then
      echo "[frontend-dev] Shared server already running (PID $managed_pid) at http://localhost:${managed_port}; not starting another compiler."
      exit 0
    fi
    echo "[frontend-dev] Server PID $managed_pid is not responding — restarting."
    stop_next_pid "$managed_pid" || true
  fi
  rm -f "$PID_FILE"
fi

# Refuse a second compiler for this checkout, even when a caller supplied a
# different PORT. Deliberate parallel work must opt in so it is visible in the
# command that creates the extra memory cost.
if [[ "$ALLOW_PARALLEL_FRONTEND_DEV" != "1" ]]; then
  alleato_pids="$(find_repo_next_pids)"
else
  alleato_pids="$(pgrep -f "${FRONTEND_DIR}.*next dev.*--port ${PORT}" 2>/dev/null || true)"
fi
if [[ -n "${alleato_pids:-}" ]]; then
  healthy_pid=""
  healthy_port=""
  while IFS= read -r pid; do
    [[ -z "$pid" ]] && continue
    candidate_port="$(next_port_for_pid "$pid")"
    if is_server_healthy "$candidate_port"; then
      healthy_pid="$pid"
      healthy_port="$candidate_port"
      break
    fi
  done <<< "$alleato_pids"
  if [[ -n "$healthy_pid" ]]; then
    echo "$healthy_pid" > "$PID_FILE"
    echo "[frontend-dev] Shared server already running (PID $healthy_pid) at http://localhost:${healthy_port}; not starting another compiler."
    echo "[frontend-dev] Use that URL, or set ALLEATO_ALLOW_PARALLEL_FRONTEND_DEV=1 for a deliberate isolated server."
    exit 0
  fi
  echo "[frontend-dev] Found stale repo-local Next dev processes — stopping:"
  while IFS= read -r pid; do
    [[ -z "$pid" ]] && continue
    ps -p "$pid" -o pid=,command= 2>/dev/null || true
    stop_next_pid "$pid" || true
  done <<< "$alleato_pids"
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
