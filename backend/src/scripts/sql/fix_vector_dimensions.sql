-- =============================================================================
-- Fix Vector Column Dimensions
-- =============================================================================
-- This script updates vector columns that don't have dimensions specified
-- Run this BEFORE the create_vector_search_functions_fixed.sql
-- =============================================================================

-- 1. First, let's check what we're dealing with
DO $$
BEGIN
    RAISE NOTICE 'Checking vector columns...';
END $$;

-- 2. Fix meeting_segments table if needed
DO $$
BEGIN
    -- Check if table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'meeting_segments') THEN
        -- Check if column exists and needs fixing
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'meeting_segments' 
            AND column_name = 'summary_embedding'
            AND udt_name = 'vector'
        ) THEN
            -- Try to alter the column to add dimensions
            BEGIN
                ALTER TABLE meeting_segments 
                ALTER COLUMN summary_embedding TYPE vector(1536);
                RAISE NOTICE 'Fixed meeting_segments.summary_embedding';
            EXCEPTION
                WHEN OTHERS THEN
                    RAISE NOTICE 'Could not alter meeting_segments.summary_embedding: %', SQLERRM;
            END;
        END IF;
    ELSE
        RAISE NOTICE 'Table meeting_segments does not exist';
    END IF;
END $$;

-- 3. Fix decisions table if needed
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'decisions') THEN
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'decisions' 
            AND column_name = 'embedding'
            AND udt_name = 'vector'
        ) THEN
            BEGIN
                ALTER TABLE decisions 
                ALTER COLUMN embedding TYPE vector(1536);
                RAISE NOTICE 'Fixed decisions.embedding';
            EXCEPTION
                WHEN OTHERS THEN
                    RAISE NOTICE 'Could not alter decisions.embedding: %', SQLERRM;
            END;
        END IF;
    ELSE
        RAISE NOTICE 'Table decisions does not exist';
    END IF;
END $$;

-- 4. Fix risks table if needed
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'risks') THEN
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'risks' 
            AND column_name = 'embedding'
            AND udt_name = 'vector'
        ) THEN
            BEGIN
                ALTER TABLE risks 
                ALTER COLUMN embedding TYPE vector(1536);
                RAISE NOTICE 'Fixed risks.embedding';
            EXCEPTION
                WHEN OTHERS THEN
                    RAISE NOTICE 'Could not alter risks.embedding: %', SQLERRM;
            END;
        END IF;
    ELSE
        RAISE NOTICE 'Table risks does not exist';
    END IF;
END $$;

-- 5. Fix opportunities table if needed
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'opportunities') THEN
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'opportunities' 
            AND column_name = 'embedding'
            AND udt_name = 'vector'
        ) THEN
            BEGIN
                ALTER TABLE opportunities 
                ALTER COLUMN embedding TYPE vector(1536);
                RAISE NOTICE 'Fixed opportunities.embedding';
            EXCEPTION
                WHEN OTHERS THEN
                    RAISE NOTICE 'Could not alter opportunities.embedding: %', SQLERRM;
            END;
        END IF;
    ELSE
        RAISE NOTICE 'Table opportunities does not exist';
    END IF;
END $$;

-- 6. Fix documents table if needed
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'documents') THEN
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'documents' 
            AND column_name = 'embedding'
            AND udt_name = 'vector'
        ) THEN
            BEGIN
                ALTER TABLE documents 
                ALTER COLUMN embedding TYPE vector(1536);
                RAISE NOTICE 'Fixed documents.embedding';
            EXCEPTION
                WHEN OTHERS THEN
                    RAISE NOTICE 'Could not alter documents.embedding: %', SQLERRM;
            END;
        END IF;
    ELSE
        RAISE NOTICE 'Table documents does not exist';
    END IF;
END $$;

-- 7. Fix tasks table if needed (in case it exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tasks') THEN
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'tasks' 
            AND column_name = 'embedding'
            AND udt_name = 'vector'
        ) THEN
            BEGIN
                ALTER TABLE tasks 
                ALTER COLUMN embedding TYPE vector(1536);
                RAISE NOTICE 'Fixed tasks.embedding';
            EXCEPTION
                WHEN OTHERS THEN
                    RAISE NOTICE 'Could not alter tasks.embedding: %', SQLERRM;
            END;
        END IF;
    END IF;
END $$;

-- 8. Show final state
SELECT 
    'Final vector column state:' as info,
    c.table_name,
    c.column_name,
    pg_catalog.format_type(a.atttypid, a.atttypmod) as data_type
FROM information_schema.columns c
JOIN pg_catalog.pg_attribute a ON (
    a.attname = c.column_name AND
    a.attrelid = (c.table_schema||'.'||c.table_name)::regclass
)
WHERE c.udt_name = 'vector'
AND c.table_schema = 'public'
ORDER BY c.table_name, c.column_name;