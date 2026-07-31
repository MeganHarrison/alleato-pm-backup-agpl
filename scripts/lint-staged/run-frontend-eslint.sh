#!/usr/bin/env bash
# Wrapper for lint-staged: cd into frontend/, run eslint with optional --fix
# and an optional inline strict-rule override, on the file paths passed as
# trailing args.
#
# Why: lint-staged 16 spawns commands without a shell, so we can't use
# `cd X && eslint --rule '<json>' ...` directly in .lintstagedrc.js — the
# JSON quoting breaks the string-argv tokenizer. Wrapping the invocation
# in this script avoids the quoting problem.
#
# Usage:
#   run-frontend-eslint.sh fix <file>...
#   run-frontend-eslint.sh strict <file>...

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
FRONTEND_DIR="${REPO_ROOT}/frontend"
ESLINT_BIN="${FRONTEND_DIR}/node_modules/.bin/eslint"
STAGED_FILTER="${REPO_ROOT}/scripts/lint-staged/filter-eslint-to-staged-lines.mjs"

mode="${1:-}"
shift || true

if [[ -z "$mode" || $# -eq 0 ]]; then
  echo "usage: $0 <fix|strict> <file>..." >&2
  exit 2
fi

cd "$FRONTEND_DIR"

existing_files=()
for file in "$@"; do
  if [[ -f "$file" ]]; then
    existing_files+=("$file")
  fi
done

if [[ ${#existing_files[@]} -eq 0 ]]; then
  exit 0
fi

strict_files=()
kanban_files=()
for file in "${existing_files[@]}"; do
  case "$file" in
    src/features/kanban/*|\
    src/features/kanban/**/*)
      kanban_files+=("$file")
      ;;
    src/app/\(main\)/executive/*|\
    src/app/api/executive/*|\
    src/components/executive/*|\
    src/lib/executive/*|\
    src/app/\(main\)/actions/executive-briefing-actions.ts)
      ;;
    # Design template files: intentional use of hardcoded colors/arbitrary values
    src/components/ds/futuristic-id-card.tsx|\
    src/components/ds/liquid-metal-id-card.tsx|\
    src/components/research-console.tsx)
      ;;
    # Transactional email templates: rendered by Resend/React Email to static
    # HTML for external inboxes, which cannot resolve CSS variables. Inline hex
    # is required here, matching the shared EmailShell palette.
    src/emails/*|\
    src/emails/**/*)
      ;;
    # Redirect-only pages: no JSX rendered, page-shell rule does not apply
    src/app/\(main\)/\[projectId\]/estimates/new/page.tsx)
      ;;
    *)
      strict_files+=("$file")
      ;;
  esac
done

case "$mode" in
  fix)
    exec "$ESLINT_BIN" --no-warn-ignored --fix "${existing_files[@]}"
    ;;
  strict)
    if [[ ${#strict_files[@]} -eq 0 && ${#kanban_files[@]} -eq 0 ]]; then
      exit 0
    fi

    if [[ ${#strict_files[@]} -gt 0 ]]; then
      json_output="$(mktemp)"
      if ! "$ESLINT_BIN" --no-warn-ignored --format json --rule '{"design-system/require-api-client":"error","design-system/no-hardcoded-colors":"error","design-system/no-arbitrary-spacing":"error","design-system/require-semantic-colors":"error","design-system/no-design-violations":"error","design-system/require-page-shell":"error","design-system/no-oversized-shadows":"error","design-system/no-raw-button":"error","design-system/no-raw-form-controls":"error","design-system/no-raw-search-input":"error","design-system/require-money-field":"error","design-system/require-info-alert":"error","design-system/no-raw-table-primitives":"error","design-system/no-raw-page-grid":"error","design-system/no-stacked-table-cell":"error","design-system/no-external-fetch-in-api-routes":"error","no-restricted-imports":["error",{"paths":[{"name":"@/components/ui/dialog","message":"Use \"@/components/ui/unified-modal\" for app-level modals to keep animation, positioning, and spacing consistent."}]}]}' "${strict_files[@]}" > "$json_output"; then
        node "$STAGED_FILTER" "$json_output" "${strict_files[@]}"
        status=$?
        rm -f "$json_output"
        exit "$status"
      fi
      rm -f "$json_output"
    fi

    if [[ ${#kanban_files[@]} -gt 0 ]]; then
      json_output="$(mktemp)"
      if ! "$ESLINT_BIN" --no-warn-ignored --format json --rule '{"design-system/require-api-client":"error","design-system/no-hardcoded-colors":"error","design-system/no-arbitrary-spacing":"off","design-system/require-semantic-colors":"error","design-system/no-design-violations":"off","design-system/require-page-shell":"error","design-system/no-oversized-shadows":"error","design-system/no-raw-button":"error","design-system/no-raw-form-controls":"error","design-system/no-raw-search-input":"error","design-system/require-money-field":"error","design-system/require-info-alert":"error","design-system/no-raw-table-primitives":"error","design-system/no-raw-page-grid":"error","design-system/no-stacked-table-cell":"error","design-system/no-external-fetch-in-api-routes":"error","no-restricted-imports":["error",{"paths":[{"name":"@/components/ui/dialog","message":"Use \"@/components/ui/unified-modal\" for app-level modals to keep animation, positioning, and spacing consistent."}]}]}' "${kanban_files[@]}" > "$json_output"; then
        node "$STAGED_FILTER" "$json_output" "${kanban_files[@]}"
        status=$?
        rm -f "$json_output"
        exit "$status"
      fi
      rm -f "$json_output"
    fi

    exit 0
    ;;
  *)
    echo "unknown mode: $mode (expected fix|strict)" >&2
    exit 2
    ;;
esac
