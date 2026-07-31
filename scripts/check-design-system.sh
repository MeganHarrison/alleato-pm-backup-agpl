#!/usr/bin/env bash
# Design system check hook for Claude Code PostToolUse
# Reads JSON input from stdin, checks if the edited file is a .tsx in frontend/src/
# and runs ESLint design-system rules on it.

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | grep -o '"file_path":"[^"]*"' | head -1 | sed 's/"file_path":"//;s/"$//')

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# Only check .tsx files under frontend/src/
case "$FILE_PATH" in
  */frontend/src/*.tsx)
    cd /Users/meganharrison/Documents/alleato-pm/frontend || exit 0
    RELATIVE=$(echo "$FILE_PATH" | sed 's|.*/frontend/||')
    RESULT=$(npx eslint --no-error-on-unmatched-pattern --quiet \
      --rule 'design-system/no-hardcoded-colors: warn' \
      --rule 'design-system/require-semantic-colors: warn' \
      "$RELATIVE" 2>/dev/null | grep "design-system/" | head -5)
    if [ -n "$RESULT" ]; then
      echo "$RESULT"
    fi
    ;;
esac
