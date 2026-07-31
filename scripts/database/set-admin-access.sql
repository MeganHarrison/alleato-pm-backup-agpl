-- Script to set admin access for megan@megankharrison.com
-- =============================================================================
-- This script ensures the user has admin privileges to access all features
-- Run this script in Supabase SQL Editor to grant admin access
-- =============================================================================

-- First, check if the user exists and their current admin status
SELECT
    id,
    email,
    is_admin,
    created_at,
    updated_at
FROM user_profiles
WHERE email = 'megan@megankharrison.com';

-- Set the user as admin if not already
UPDATE user_profiles
SET
    is_admin = true,
    updated_at = NOW()
WHERE email = 'megan@megankharrison.com'
AND (is_admin IS NULL OR is_admin = false);

-- Verify the update
SELECT
    id,
    email,
    is_admin,
    'Admin access granted' as status
FROM user_profiles
WHERE email = 'megan@megankharrison.com';

-- Optional verification: Show which tables the admin can now access
SELECT
    'Super admin can access ALL projects without individual memberships' as access_info;
