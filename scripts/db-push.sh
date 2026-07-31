#!/bin/bash
# Wrapper around supabase db push that auto-regenerates types afterward
set -e

echo "Pushing migrations..."
supabase db push "$@"

echo ""
echo "Regenerating database types..."
cd "$(dirname "$0")/../frontend"
npm run db:types

echo ""
echo "✓ Migrations pushed and types updated"
