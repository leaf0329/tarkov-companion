CREATE TABLE IF NOT EXISTS public.user_prestige_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mode TEXT NOT NULL,
  prestige_from INTEGER NOT NULL,
  prestige_to INTEGER NOT NULL,
  archived_progress JSONB NOT NULL DEFAULT '{}'::jsonb,
  summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT user_prestige_runs_mode_check CHECK (mode = ANY (ARRAY['pvp'::text, 'pve'::text])),
  CONSTRAINT user_prestige_runs_prestige_from_check CHECK (prestige_from >= 0 AND prestige_from <= 6),
  CONSTRAINT user_prestige_runs_prestige_to_check CHECK (prestige_to >= 1 AND prestige_to <= 6),
  CONSTRAINT user_prestige_runs_order_check CHECK (prestige_to > prestige_from)
);

ALTER TABLE public.user_prestige_runs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_user_prestige_runs_user_mode_created
  ON public.user_prestige_runs(user_id, mode, created_at DESC);

DROP POLICY IF EXISTS "Users can view own prestige runs" ON public.user_prestige_runs;
CREATE POLICY "Users can view own prestige runs"
  ON public.user_prestige_runs
  FOR SELECT
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own prestige runs" ON public.user_prestige_runs;
CREATE POLICY "Users can insert own prestige runs"
  ON public.user_prestige_runs
  FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

CREATE OR REPLACE FUNCTION public.sanitize_user_progress_mode_data(payload jsonb)
RETURNS jsonb
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT jsonb_strip_nulls(
    jsonb_build_object(
      'displayName',
      CASE
        WHEN jsonb_typeof(payload->'displayName') = 'string'
          AND nullif(btrim(payload->>'displayName'), '') IS NOT NULL
        THEN to_jsonb(left(btrim(payload->>'displayName'), 64))
        ELSE NULL
      END,
      'hideoutModules',
      CASE
        WHEN jsonb_typeof(payload->'hideoutModules') = 'object'
        THEN payload->'hideoutModules'
        ELSE '{}'::jsonb
      END,
      'hideoutParts',
      CASE
        WHEN jsonb_typeof(payload->'hideoutParts') = 'object'
        THEN payload->'hideoutParts'
        ELSE '{}'::jsonb
      END,
      'lastApiUpdate',
      CASE
        WHEN jsonb_typeof(payload->'lastApiUpdate') = 'object'
        THEN payload->'lastApiUpdate'
        ELSE NULL
      END,
      'apiUpdateHistory',
      CASE
        WHEN jsonb_typeof(payload->'apiUpdateHistory') = 'array'
        THEN (
          SELECT COALESCE(jsonb_agg(entry.value), '[]'::jsonb)
          FROM (
            SELECT value
            FROM jsonb_array_elements(payload->'apiUpdateHistory')
            LIMIT 50
          ) AS entry
        )
        ELSE '[]'::jsonb
      END,
      'level',
      CASE
        WHEN jsonb_typeof(payload->'level') = 'number'
        THEN to_jsonb(
          greatest(
            1,
            least(
              2147483647,
              greatest(-2147483648, trunc((payload->>'level')::numeric))
            )::int
          )
        )
        ELSE NULL
      END,
      'pmcFaction',
      CASE
        WHEN payload->>'pmcFaction' IN ('BEAR', 'USEC')
        THEN to_jsonb(payload->>'pmcFaction')
        ELSE NULL
      END,
      'prestigeLevel',
      CASE
        WHEN jsonb_typeof(payload->'prestigeLevel') = 'number'
        THEN to_jsonb(
          least(
            6,
            greatest(
              0,
              least(
                2147483647,
                greatest(-2147483648, trunc((payload->>'prestigeLevel')::numeric))
              )::int
            )
          )
        )
        ELSE NULL
      END,
      'progressEpoch',
      CASE
        WHEN jsonb_typeof(payload->'progressEpoch') = 'number'
        THEN to_jsonb(
          greatest(
            0,
            least(
              2147483647,
              greatest(-2147483648, trunc((payload->>'progressEpoch')::numeric))
            )::int
          )
        )
        ELSE to_jsonb(0)
      END,
      'skillOffsets',
      CASE
        WHEN jsonb_typeof(payload->'skillOffsets') = 'object'
        THEN payload->'skillOffsets'
        ELSE '{}'::jsonb
      END,
      'skills',
      CASE
        WHEN jsonb_typeof(payload->'skills') = 'object'
        THEN payload->'skills'
        ELSE '{}'::jsonb
      END,
      'storyChapters',
      CASE
        WHEN jsonb_typeof(payload->'storyChapters') = 'object'
        THEN payload->'storyChapters'
        ELSE '{}'::jsonb
      END,
      'tarkovDevProfile',
      CASE
        WHEN jsonb_typeof(payload->'tarkovDevProfile') = 'object'
        THEN payload->'tarkovDevProfile'
        ELSE NULL
      END,
      'taskCompletions',
      CASE
        WHEN jsonb_typeof(payload->'taskCompletions') = 'object'
        THEN payload->'taskCompletions'
        ELSE '{}'::jsonb
      END,
      'taskObjectives',
      CASE
        WHEN jsonb_typeof(payload->'taskObjectives') = 'object'
        THEN payload->'taskObjectives'
        ELSE '{}'::jsonb
      END,
      'traders',
      CASE
        WHEN jsonb_typeof(payload->'traders') = 'object'
        THEN payload->'traders'
        ELSE '{}'::jsonb
      END,
      'xpOffset',
      CASE
        WHEN jsonb_typeof(payload->'xpOffset') = 'number'
        THEN to_jsonb(
          least(
            2147483647,
            greatest(-2147483648, trunc((payload->>'xpOffset')::numeric))
          )::int
        )
        ELSE NULL
      END
    )
  );
$$;
