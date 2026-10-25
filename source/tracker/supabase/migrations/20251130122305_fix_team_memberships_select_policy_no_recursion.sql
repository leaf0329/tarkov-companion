-- Replace team_memberships SELECT policy to avoid self-recursion
DO $$
BEGIN
  IF to_regclass('public.team_memberships') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Users can view memberships for their teams" ON public.team_memberships';
    EXECUTE '
      CREATE POLICY "Users can view memberships for their teams" ON public.team_memberships
        FOR SELECT USING (
          user_id = (select auth.uid())
          OR team_id IN (
            SELECT id FROM public.teams
            WHERE owner_id = (select auth.uid())
          )
        )
    ';
  END IF;
END $$;
