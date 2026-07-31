#!/bin/bash

# Run Supabase Migrations Script
# This script applies all pending migrations to your Supabase database

echo "Running Supabase migrations..."

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "Error: Supabase CLI is not installed."
    echo "Please install it from: https://supabase.com/docs/guides/cli"
    exit 1
fi

# Check if we're in the right directory
if [ ! -d "supabase/migrations" ]; then
    echo "Error: supabase/migrations directory not found."
    echo "Please run this script from the project root."
    exit 1
fi

# Initialize Supabase if not already done
if [ ! -f "supabase/config.toml" ]; then
    echo "Initializing Supabase..."
    supabase init
fi

# Apply migrations
echo "Applying migrations..."
supabase db push

echo "Migration complete!"
echo ""
echo "Note: If you need to run specific migrations manually, you can use:"
echo "  supabase db execute -f supabase/migrations/004_fix_schema_mismatches.sql"