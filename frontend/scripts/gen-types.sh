#!/bin/bash
# gen-types.sh
# Regenerates Supabase TypeScript types from the database schema.
#
# Run this script whenever the database schema changes to keep
# the TypeScript types in sync with the actual database structure.
#
# Usage:
#   ./scripts/gen-types.sh
#
# Prerequisites:
#   - Supabase CLI installed (npx supabase)
#   - SUPABASE_PROJECT_ID set (or uses default from this script)
#   - Authenticated with Supabase (npx supabase login)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$(dirname "$SCRIPT_DIR")"
TYPES_DIR="$FRONTEND_DIR/src/types"
OUTPUT_FILE="$TYPES_DIR/database.types.ts"

# Default project ID (can be overridden with SUPABASE_PROJECT_ID env var)
PROJECT_ID="${SUPABASE_PROJECT_ID:-lgveqfnpkxvzbnnwuled}"

echo "=================================================="
echo "Supabase Type Generator"
echo "=================================================="
echo ""
echo "Project ID: $PROJECT_ID"
echo "Output file: $OUTPUT_FILE"
echo ""

# Ensure types directory exists
mkdir -p "$TYPES_DIR"

# Generate types
echo "Generating types..."
npx supabase gen types typescript \
  --project-id "$PROJECT_ID" \
  --schema public \
  > "$OUTPUT_FILE"

if [ $? -eq 0 ]; then
  echo ""
  echo "✓ Types generated successfully!"
  echo ""
  echo "Output: $OUTPUT_FILE"
  echo ""
  echo "Next steps:"
  echo "1. Review the generated types for any changes"
  echo "2. Update database-extensions.ts if needed"
  echo "3. Run 'npm run typecheck' to verify no type errors"
  echo ""
else
  echo ""
  echo "✗ Type generation failed!"
  echo ""
  echo "Make sure you are logged in:"
  echo "  npx supabase login"
  echo ""
  exit 1
fi
