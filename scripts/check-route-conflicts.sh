#!/usr/bin/env bash
# Check for Next.js dynamic route conflicts
# This script ensures consistent naming of dynamic route parameters

set -euo pipefail

echo "Checking for dynamic route conflicts..."

# Find all dynamic route directories
CONFLICTS=$(
  find frontend/src/app -type d -name "[*]" 2>/dev/null \
    | awk '{
        parent=$0
        sub(/\/[^\/]+$/, "", parent)
        param=$0
        sub(/^.*\//, "", param)
        print parent "\t" param
      }' \
    | sort -u \
    | awk -F '\t' '
        {
          if (params[$1] == "") {
            params[$1] = $2
          } else if (params[$1] != $2) {
            print $1 "\t" params[$1] "," $2
          }
        }
      '
)

if [ -n "$CONFLICTS" ]; then
  echo "❌ CONFLICT DETECTED:"
  while IFS=$'\t' read -r parent params; do
    [ -z "$parent" ] && continue
    echo "   Parent: $parent"
    echo "   Params: $params"
    echo "   [Error: You cannot use different slug names for the same dynamic path]"
  done <<< "$CONFLICTS"
  exit 1
fi

echo "✅ No route conflicts found"
exit 0
