#!/bin/bash

# Check for Next.js dynamic route naming conflicts
# This prevents the fatal error: "You cannot use different slug names for the same dynamic path"

set -e

# Get to project root (script may be called from anywhere)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

echo "🔍 Checking for dynamic route conflicts..."

# Find all dynamic route directories
ROUTES=$(find frontend/src/app -type d -name "\[*\]" 2>/dev/null | sort)

if [ -z "$ROUTES" ]; then
  echo "✅ No dynamic routes found"
  exit 0
fi

# Track conflicts using a temp file (bash 3.x compatible)
TEMP_FILE=$(mktemp)
trap "rm -f $TEMP_FILE" EXIT

CONFLICTS_FOUND=0

# Group routes by parent directory
while IFS= read -r route; do
  parent=$(dirname "$route")
  param=$(basename "$route")
  echo "$parent|$param" >> "$TEMP_FILE"
done <<< "$ROUTES"

# Check for conflicts within each parent
while IFS= read -r line; do
  parent=$(echo "$line" | cut -d'|' -f1)

  # Get all params for this parent
  params=$(grep "^$parent|" "$TEMP_FILE" | cut -d'|' -f2 | sort -u)
  param_count=$(echo "$params" | wc -l | tr -d ' ')

  # If more than one unique param name for the same parent, it's a conflict
  if [ "$param_count" -gt 1 ]; then
    echo ""
    echo "❌ CONFLICT DETECTED:"
    echo "   Parent: $parent"
    echo "   Params: $(echo "$params" | tr '\n' ',' | sed 's/,$//')"
    echo ""
    echo "   This will cause Next.js error:"
    first_param=$(echo "$params" | head -1)
    second_param=$(echo "$params" | tail -1)
    echo "   [Error: You cannot use different slug names for the same dynamic path ('$first_param' !== '$second_param').]"
    echo ""
    echo "   Fix: Use the same parameter name for both routes, or delete the obsolete one."
    echo "   See: .agents/rules/CRITICAL-NEXTJS-ROUTING-RULES.md"
    echo ""
    CONFLICTS_FOUND=1
  fi
done <<< "$(cut -d'|' -f1 "$TEMP_FILE" | sort -u)"

if [ $CONFLICTS_FOUND -eq 1 ]; then
  echo "❌ Route conflicts found. Fix before committing."
  exit 1
fi

echo "✅ No route conflicts found"
exit 0
