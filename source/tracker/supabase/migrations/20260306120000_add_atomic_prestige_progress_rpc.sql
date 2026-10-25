CREATE OR REPLACE FUNCTION public.archive_prestige_run_and_reset_progress(
  p_mode TEXT,
  p_prestige_from INTEGER,
  p_prestige_to INTEGER,
  p_archived_progress JSONB,
  p_summary JSONB,
  p_created_at TIMESTAMPTZ,
  p_current_game_mode TEXT,
  p_game_edition INTEGER,
  p_tarkov_uid BIGINT,
  p_pvp_data JSONB,
  p_pve_data JSONB DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.user_prestige_runs (
    user_id,
    mode,
    prestige_from,
    prestige_to,
    archived_progress,
    summary,
    created_at
  )
  VALUES (
    v_user_id,
    p_mode,
    p_prestige_from,
    p_prestige_to,
    COALESCE(p_archived_progress, '{}'::jsonb),
    COALESCE(p_summary, '{}'::jsonb),
    COALESCE(p_created_at, now())
  );

  INSERT INTO public.user_progress (
    user_id,
    current_game_mode,
    game_edition,
    tarkov_uid,
    pvp_data,
    pve_data
  )
  VALUES (
    v_user_id,
    COALESCE(p_current_game_mode, 'pvp'),
    COALESCE(p_game_edition, 1),
    p_tarkov_uid,
    COALESCE(p_pvp_data, '{}'::jsonb),
    COALESCE(p_pve_data, '{}'::jsonb)
  )
  ON CONFLICT (user_id) DO UPDATE
  SET
    current_game_mode = EXCLUDED.current_game_mode,
    game_edition = EXCLUDED.game_edition,
    tarkov_uid = EXCLUDED.tarkov_uid,
    pvp_data = EXCLUDED.pvp_data,
    pve_data = EXCLUDED.pve_data;
END;
$$;

REVOKE ALL ON FUNCTION public.archive_prestige_run_and_reset_progress(
  TEXT,
  INTEGER,
  INTEGER,
  JSONB,
  JSONB,
  TIMESTAMPTZ,
  TEXT,
  INTEGER,
  BIGINT,
  JSONB,
  JSONB
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.archive_prestige_run_and_reset_progress(
  TEXT,
  INTEGER,
  INTEGER,
  JSONB,
  JSONB,
  TIMESTAMPTZ,
  TEXT,
  INTEGER,
  BIGINT,
  JSONB,
  JSONB
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.archive_prestige_run_and_reset_progress(
  TEXT,
  INTEGER,
  INTEGER,
  JSONB,
  JSONB,
  TIMESTAMPTZ,
  TEXT,
  INTEGER,
  BIGINT,
  JSONB,
  JSONB
) TO service_role;
