#!/bin/bash

# Test Supabase migrations locally
# This script applies migrations to a local Supabase instance

echo "🚀 Testing Supabase Migrations"
echo "=============================="

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}❌ Supabase CLI is not installed${NC}"
    echo "Install with: npm install -g supabase"
    exit 1
fi

# Change to the screenshot capture directory
cd "$(dirname "$0")/.." || exit

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -d "supabase/migrations" ]; then
    echo -e "${RED}❌ Not in the correct directory${NC}"
    echo "Current directory: $(pwd)"
    exit 1
fi

echo -e "${YELLOW}📁 Working directory:${NC} $(pwd)"
echo ""

# Start local Supabase if not already running
echo "Starting local Supabase instance..."
supabase start

# Check the status
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to start Supabase${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}✅ Supabase started successfully${NC}"
echo ""

# Reset database to clean state
echo "Resetting database to clean state..."
supabase db reset --debug

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to reset database${NC}"
    echo "This might be because initial tables don't exist. Continuing..."
fi

echo ""
echo "Applying migrations..."
echo "---------------------"

# Apply each migration individually to catch errors
for migration in supabase/migrations/*.sql; do
    if [ -f "$migration" ]; then
        filename=$(basename "$migration")
        echo -n "Applying $filename... "
        
        # Run the migration
        supabase db execute --file "$migration" 2>/tmp/migration_error.log
        
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✓${NC}"
        else
            echo -e "${RED}✗${NC}"
            echo -e "${RED}Error in $filename:${NC}"
            cat /tmp/migration_error.log
            echo ""
        fi
    fi
done

echo ""
echo "Testing seed data..."
echo "-------------------"

# Apply seed data if it exists
if [ -f "supabase/seed.sql" ]; then
    echo -n "Applying seed data... "
    supabase db execute --file "supabase/seed.sql" 2>/tmp/seed_error.log
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓${NC}"
    else
        echo -e "${RED}✗${NC}"
        echo -e "${RED}Error in seed data:${NC}"
        cat /tmp/seed_error.log
    fi
else
    echo -e "${YELLOW}⚠️  No seed.sql file found${NC}"
fi

echo ""
echo "Running validation queries..."
echo "----------------------------"

# Test queries to validate the schema
cat > /tmp/test_queries.sql << 'EOF'
-- Test 1: Check all tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- Test 2: Check all enum types exist
SELECT typname 
FROM pg_type 
WHERE typtype = 'e' 
  AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
ORDER BY typname;

-- Test 3: Check all views exist
SELECT table_name 
FROM information_schema.views 
WHERE table_schema = 'public'
ORDER BY table_name;

-- Test 4: Check foreign key relationships
SELECT 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
ORDER BY tc.table_name, kcu.column_name;

-- Test 5: Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename LIKE '%financial%' OR tablename IN ('budgets', 'invoices', 'commitments')
ORDER BY tablename;
EOF

echo -n "Running validation queries... "
supabase db execute --file /tmp/test_queries.sql > /tmp/validation_results.txt 2>&1

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓${NC}"
    echo ""
    echo "Validation Results:"
    echo "==================="
    cat /tmp/validation_results.txt
else
    echo -e "${RED}✗${NC}"
    echo "Validation query errors:"
    cat /tmp/validation_results.txt
fi

# Show connection info
echo ""
echo "Connection Info:"
echo "================"
supabase status

echo ""
echo -e "${GREEN}✅ Migration testing complete!${NC}"
echo ""
echo "You can now:"
echo "  - Access Supabase Studio at: http://localhost:54323"
echo "  - Connect to the database at: postgresql://postgres:postgres@localhost:54322/postgres"
echo "  - Stop Supabase with: supabase stop"

# Cleanup
rm -f /tmp/migration_error.log /tmp/seed_error.log /tmp/test_queries.sql /tmp/validation_results.txt