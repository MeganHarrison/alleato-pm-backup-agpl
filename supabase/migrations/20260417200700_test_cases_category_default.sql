-- Add default for category so direct Supabase Studio inserts don't fail the NOT NULL constraint.
ALTER TABLE test_cases ALTER COLUMN category SET DEFAULT 'General';
