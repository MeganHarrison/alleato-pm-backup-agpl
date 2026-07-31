#!/bin/bash

# Load environment variables
source ../.env

# Run the SQL migration using psql via Supabase
SQL_FILE="create_cost_codes_tables.sql"

echo "Running migration: $SQL_FILE"
echo "Supabase URL: $SUPABASE_URL"

# Extract project ref from URL (lgveqfnpkxvzbnnwuled)
PROJECT_REF=$(echo $SUPABASE_URL | sed 's/https:\/\/\(.*\)\.supabase\.co/\1/')

echo "Project Ref: $PROJECT_REF"

# Use Supabase CLI to run the migration
npx supabase db execute --file "$SQL_FILE" --project-ref "$PROJECT_REF"
