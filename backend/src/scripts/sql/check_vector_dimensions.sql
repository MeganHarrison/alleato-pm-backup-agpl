-- =============================================================================
-- Diagnostic SQL to check vector column dimensions
-- =============================================================================
-- This script helps identify vector columns without proper dimension specifications
-- Run this BEFORE the create_vector_search_functions_fixed.sql
-- =============================================================================

-- 1. Check all vector columns in the database
SELECT 
    c.table_schema,
    c.table_name,
    c.column_name,
    c.data_type,
    c.udt_name,
    -- Extract dimension from type modifier if available
    CASE 
        WHEN t.typmodout IS NOT NULL THEN 
            substring(t.typmodout::regproc::text from '\((\d+)\)')
        ELSE 
            'NO DIMENSIONS SPECIFIED'
    END as vector_dimensions
FROM information_schema.columns c
JOIN pg_type t ON c.udt_name = t.typname
WHERE c.udt_name = 'vector'
ORDER BY c.table_schema, c.table_name, c.column_name;

-- 2. Check specific tables mentioned in the functions
SELECT '=== Checking meeting_segments table ===' as info;
SELECT 
    column_name, 
    data_type,
    udt_name,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'meeting_segments' 
AND column_name = 'summary_embedding';

SELECT '=== Checking decisions table ===' as info;
SELECT 
    column_name, 
    data_type,
    udt_name,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'decisions' 
AND column_name = 'embedding';

SELECT '=== Checking risks table ===' as info;
SELECT 
    column_name, 
    data_type,
    udt_name,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'risks' 
AND column_name = 'embedding';

SELECT '=== Checking opportunities table ===' as info;
SELECT 
    column_name, 
    data_type,
    udt_name,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'opportunities' 
AND column_name = 'embedding';

SELECT '=== Checking documents table ===' as info;
SELECT 
    column_name, 
    data_type,
    udt_name,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'documents' 
AND column_name = 'embedding';

-- 3. Get actual table definitions
SELECT '=== Table Definitions ===' as info;
SELECT 
    table_name,
    pg_get_tabledef(c.oid) as table_definition
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' 
AND c.relname IN ('meeting_segments', 'decisions', 'risks', 'opportunities', 'documents')
AND c.relkind = 'r';

-- 4. Check if tables exist at all
SELECT '=== Table Existence Check ===' as info;
SELECT 
    table_schema,
    table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('meeting_segments', 'decisions', 'risks', 'opportunities', 'documents')
ORDER BY table_name;

-- If pg_get_tabledef doesn't exist, use this alternative:
/*
SELECT '=== Alternative Table Info ===' as info;
SELECT 
    a.attname AS column_name,
    pg_catalog.format_type(a.atttypid, a.atttypmod) AS data_type
FROM pg_catalog.pg_attribute a
WHERE a.attrelid IN (
    SELECT c.oid
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' 
    AND c.relname IN ('meeting_segments', 'decisions', 'risks', 'opportunities', 'documents')
)
AND a.attnum > 0
AND NOT a.attisdropped
ORDER BY a.attrelid, a.attnum;
*/