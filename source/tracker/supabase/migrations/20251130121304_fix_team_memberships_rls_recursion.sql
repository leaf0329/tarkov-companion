-- Fix RLS recursion on teams/team_memberships by simplifying SELECT policy
DO $$
BEGIN
  IF to_regclass('public.team_memberships') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Users can view memberships for their teams" ON public.team_memberships';
    EXECUTE 'CREATE POLICY "Users can view memberships for their teams" ON public.team_memberships FOR SELECT USING ((select auth.uid()) = user_id)';
  END IF;
END $$;
