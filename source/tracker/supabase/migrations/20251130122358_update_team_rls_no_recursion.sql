-- Break recursive RLS between teams and team_memberships
DO $$
BEGIN
  -- teams SELECT policy: allow owner or users whose user_system.team_id matches
  IF to_regclass('public.teams') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Users can view teams they are members of" ON public.teams';
    EXECUTE 'CREATE POLICY "Users can view teams they are members of" ON public.teams
      FOR SELECT USING (
        owner_id = (select auth.uid())
        OR id = (SELECT team_id FROM public.user_system WHERE user_id = (select auth.uid()) LIMIT 1)
      )';
  END IF;

  -- team_memberships SELECT policy: allow row owner or team owner (via teams.owner_id)
  IF to_regclass('public.team_memberships') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Users can view memberships for their teams" ON public.team_memberships';
    EXECUTE 'CREATE POLICY "Users can view memberships for their teams" ON public.team_memberships
      FOR SELECT USING (
        user_id = (select auth.uid())
        OR team_id IN (
          SELECT id FROM public.teams WHERE owner_id = (select auth.uid())
        )
      )';
  END IF;
END $$;
