DROP POLICY IF EXISTS "Users can delete own prestige runs" ON public.user_prestige_runs;
CREATE POLICY "Users can delete own prestige runs"
  ON public.user_prestige_runs
  FOR DELETE
  USING ((select auth.uid()) = user_id);
