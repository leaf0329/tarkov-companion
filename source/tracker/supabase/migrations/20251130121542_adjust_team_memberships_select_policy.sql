-- Broaden team_memberships SELECT policy so owners can read their teams without team<->membership recursion
DO $$
BEGIN
  IF to_regclass('public.team_memberships') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Users can view memberships for their teams" ON public.team_memberships';
    EXECUTE '
      CREATE POLICY "Users can view memberships for their teams" ON public.team_memberships
        FOR SELECT USING (
          user_id = (select auth.uid())
          OR EXISTS (
            SELECT 1 FROM public.team_memberships tm2
            WHERE tm2.team_id = team_memberships.team_id
              AND tm2.user_id = (select auth.uid())
              AND tm2.role = ''owner''
          )
        )
    ';
  END IF;
END $$;
