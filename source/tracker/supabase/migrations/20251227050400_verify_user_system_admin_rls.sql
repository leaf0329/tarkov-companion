-- Verify RLS policies on user_system.is_admin field
-- This migration tests that the admin flag cannot be set or modified by regular users

-- Create a test function that verifies RLS enforcement
CREATE OR REPLACE FUNCTION public.test_user_system_admin_rls()
RETURNS TABLE(test_name text, passed boolean, details text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  test_user_id uuid;
  current_jwt_role text;
BEGIN
  -- Store current JWT role
  current_jwt_role := current_setting('request.jwt.claim.role', true);

  -- Test 1: Verify RLS is enabled on user_system table
  RETURN QUERY
  SELECT
    'RLS enabled on user_system' AS test_name,
    relrowsecurity AS passed,
    CASE
      WHEN relrowsecurity THEN 'Row Level Security is enabled'
      ELSE 'CRITICAL: Row Level Security is NOT enabled'
    END AS details
  FROM pg_class
  WHERE relname = 'user_system' AND relnamespace = 'public'::regnamespace;

  -- Test 2: Verify column-level permissions are revoked
  RETURN QUERY
  SELECT
    'is_admin INSERT permission revoked from authenticated' AS test_name,
    NOT has_column_privilege('authenticated', 'public.user_system', 'is_admin', 'INSERT') AS passed,
    CASE
      WHEN NOT has_column_privilege('authenticated', 'public.user_system', 'is_admin', 'INSERT')
      THEN 'INSERT permission correctly revoked'
      ELSE 'CRITICAL: INSERT permission still granted'
    END AS details;

  RETURN QUERY
  SELECT
    'is_admin UPDATE permission revoked from authenticated' AS test_name,
    NOT has_column_privilege('authenticated', 'public.user_system', 'is_admin', 'UPDATE') AS passed,
    CASE
      WHEN NOT has_column_privilege('authenticated', 'public.user_system', 'is_admin', 'UPDATE')
      THEN 'UPDATE permission correctly revoked'
      ELSE 'CRITICAL: UPDATE permission still granted'
    END AS details;

  -- Test 3: Verify trigger exists
  RETURN QUERY
  SELECT
    'user_system_protect_is_admin trigger exists' AS test_name,
    EXISTS (
      SELECT 1 FROM pg_trigger
      WHERE tgname = 'user_system_protect_is_admin'
        AND tgrelid = 'public.user_system'::regclass
    ) AS passed,
    CASE
      WHEN EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'user_system_protect_is_admin'
          AND tgrelid = 'public.user_system'::regclass
      )
      THEN 'Trigger is active'
      ELSE 'CRITICAL: Trigger does not exist'
    END AS details;

  -- Test 4: Verify default value is false and column is NOT NULL
  RETURN QUERY
  SELECT
    'is_admin has safe defaults' AS test_name,
    (
      a.attnotnull AND
      pg_get_expr(d.adbin, d.adrelid) = 'false'
    ) AS passed,
    CASE
      WHEN a.attnotnull AND pg_get_expr(d.adbin, d.adrelid) = 'false'
      THEN 'Column is NOT NULL with DEFAULT false'
      ELSE 'WARNING: Column should be NOT NULL with DEFAULT false'
    END AS details
  FROM pg_attribute a
  LEFT JOIN pg_attrdef d ON (a.attrelid, a.attnum) = (d.adrelid, d.adnum)
  WHERE a.attrelid = 'public.user_system'::regclass
    AND a.attname = 'is_admin';

  RETURN;
END;
$$;
-- Run the test function and output results
DO $$
DECLARE
  test_result record;
  all_passed boolean := true;
BEGIN
  RAISE NOTICE '=== User System Admin RLS Verification ===';
  RAISE NOTICE '';

  FOR test_result IN SELECT * FROM public.test_user_system_admin_rls()
  LOOP
    IF test_result.passed THEN
      RAISE NOTICE '✓ %: %', test_result.test_name, test_result.details;
    ELSE
      RAISE WARNING '✗ %: %', test_result.test_name, test_result.details;
      all_passed := false;
    END IF;
  END LOOP;

  RAISE NOTICE '';
  IF all_passed THEN
    RAISE NOTICE '=== All RLS tests passed ===';
  ELSE
    RAISE WARNING '=== Some RLS tests FAILED - review warnings above ===';
  END IF;
END;
$$;
-- Drop the test function (cleanup)
DROP FUNCTION IF EXISTS public.test_user_system_admin_rls();
-- Add comment documenting the security measures
COMMENT ON COLUMN public.user_system.is_admin IS
  'Admin flag for privileged users. Protected by:
   1. RLS policies (users can only view their own row)
   2. Column-level permission revocation (no INSERT/UPDATE for authenticated role)
   3. Trigger prevent_user_system_admin_mutation (blocks client modifications)
   Only service_role can set or modify this field.';
