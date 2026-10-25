CREATE TABLE IF NOT EXISTS public.mutation_rate_limits (
  scope TEXT NOT NULL,
  subject TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  reset_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (scope, subject)
);

ALTER TABLE public.mutation_rate_limits ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.mutation_rate_limits FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.mutation_rate_limits TO service_role;

COMMENT ON TABLE public.mutation_rate_limits IS
  'Tracks per-subject mutation rate limit windows for Edge Functions.';

CREATE OR REPLACE FUNCTION public.consume_mutation_rate_limit(
  p_scope TEXT,
  p_subject TEXT,
  p_limit INTEGER,
  p_window_seconds INTEGER
)
RETURNS TABLE (
  allowed BOOLEAN,
  remaining INTEGER,
  reset_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMPTZ := clock_timestamp();
  v_count INTEGER;
  v_reset_at TIMESTAMPTZ;
BEGIN
  IF p_scope IS NULL OR btrim(p_scope) = '' THEN
    RAISE EXCEPTION 'p_scope is required';
  END IF;

  IF p_subject IS NULL OR btrim(p_subject) = '' THEN
    RAISE EXCEPTION 'p_subject is required';
  END IF;

  IF p_limit <= 0 OR p_window_seconds <= 0 THEN
    RAISE EXCEPTION 'p_limit and p_window_seconds must be positive';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_scope), hashtext(p_subject));

  SELECT mrl.count, mrl.reset_at
  INTO v_count, v_reset_at
  FROM public.mutation_rate_limits AS mrl
  WHERE mrl.scope = p_scope
    AND mrl.subject = p_subject;

  IF NOT FOUND OR v_now >= v_reset_at THEN
    v_reset_at := v_now + make_interval(secs => p_window_seconds);

    INSERT INTO public.mutation_rate_limits AS mrl (
      scope,
      subject,
      count,
      reset_at,
      updated_at
    )
    VALUES (
      p_scope,
      p_subject,
      1,
      v_reset_at,
      v_now
    )
    ON CONFLICT (scope, subject) DO UPDATE
    SET count = 1,
        reset_at = EXCLUDED.reset_at,
        updated_at = EXCLUDED.updated_at;

    RETURN QUERY
    SELECT TRUE, GREATEST(p_limit - 1, 0), v_reset_at;
    RETURN;
  END IF;

  IF v_count >= p_limit THEN
    RETURN QUERY
    SELECT FALSE, 0, v_reset_at;
    RETURN;
  END IF;

  UPDATE public.mutation_rate_limits AS mrl
  SET count = mrl.count + 1,
      updated_at = v_now
  WHERE mrl.scope = p_scope
    AND mrl.subject = p_subject
  RETURNING mrl.count, mrl.reset_at
  INTO v_count, v_reset_at;

  RETURN QUERY
  SELECT TRUE, GREATEST(p_limit - v_count, 0), v_reset_at;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_mutation_rate_limit(TEXT, TEXT, INTEGER, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_mutation_rate_limit(TEXT, TEXT, INTEGER, INTEGER)
  TO service_role;

COMMENT ON FUNCTION public.consume_mutation_rate_limit(TEXT, TEXT, INTEGER, INTEGER) IS
  'Consumes a per-subject mutation rate limit bucket and returns allow/remaining/reset metadata.';
