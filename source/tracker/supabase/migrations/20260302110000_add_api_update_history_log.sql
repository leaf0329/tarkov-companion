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

CREATE OR REPLACE FUNCTION public.merge_api_update_history(
  payload jsonb,
  previous_payload jsonb,
  max_entries integer DEFAULT 50
)
RETURNS jsonb
LANGUAGE SQL
IMMUTABLE
AS $$
  WITH candidate_entries AS (
    SELECT value
    FROM jsonb_array_elements(
      CASE
        WHEN jsonb_typeof(payload->'apiUpdateHistory') = 'array'
        THEN payload->'apiUpdateHistory'
        ELSE '[]'::jsonb
      END
    )
    UNION ALL
    SELECT payload->'lastApiUpdate'
    WHERE jsonb_typeof(payload->'lastApiUpdate') = 'object'
    UNION ALL
    SELECT value
    FROM jsonb_array_elements(
      CASE
        WHEN jsonb_typeof(previous_payload->'apiUpdateHistory') = 'array'
        THEN previous_payload->'apiUpdateHistory'
        ELSE '[]'::jsonb
      END
    )
    UNION ALL
    SELECT previous_payload->'lastApiUpdate'
    WHERE jsonb_typeof(previous_payload->'lastApiUpdate') = 'object'
  ),
  normalized_entries AS (
    SELECT
      left(nullif(btrim(value->>'id'), ''), 64) AS id,
      CASE
        WHEN jsonb_typeof(value->'at') = 'number'
        THEN least(2147483647, greatest(0, trunc((value->>'at')::numeric)))::bigint
        ELSE NULL
      END AS at,
      CASE
        WHEN jsonb_typeof(value->'tasks') = 'array'
        THEN value->'tasks'
        ELSE NULL
      END AS tasks
    FROM candidate_entries
    WHERE jsonb_typeof(value) = 'object'
      AND value->>'source' = 'api'
  ),
  deduped_entries AS (
    SELECT DISTINCT ON (id)
      id,
      at,
      tasks
    FROM normalized_entries
    WHERE id IS NOT NULL
      AND at IS NOT NULL
    ORDER BY id, at DESC
  ),
  ordered_entries AS (
    SELECT
      jsonb_strip_nulls(
        jsonb_build_object(
          'id', id,
          'at', at,
          'source', 'api',
          'tasks', tasks
        )
      ) AS entry,
      at
    FROM deduped_entries
    ORDER BY at DESC
    LIMIT greatest(1, least(500, max_entries))
  )
  SELECT COALESCE(jsonb_agg(entry ORDER BY at DESC), '[]'::jsonb)
  FROM ordered_entries;
$$;

CREATE OR REPLACE FUNCTION public.populate_user_progress_api_update_history()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  previous_pvp jsonb := '{}'::jsonb;
  previous_pve jsonb := '{}'::jsonb;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    previous_pvp := COALESCE(OLD.pvp_data, '{}'::jsonb);
    previous_pve := COALESCE(OLD.pve_data, '{}'::jsonb);
  END IF;

  NEW.pvp_data := jsonb_set(
    COALESCE(NEW.pvp_data, '{}'::jsonb),
    ARRAY['apiUpdateHistory'],
    public.merge_api_update_history(COALESCE(NEW.pvp_data, '{}'::jsonb), previous_pvp, 50),
    true
  );

  NEW.pve_data := jsonb_set(
    COALESCE(NEW.pve_data, '{}'::jsonb),
    ARRAY['apiUpdateHistory'],
    public.merge_api_update_history(COALESCE(NEW.pve_data, '{}'::jsonb), previous_pve, 50),
    true
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS a_append_api_update_history ON public.user_progress;
CREATE TRIGGER a_append_api_update_history
BEFORE INSERT OR UPDATE OF pvp_data, pve_data
ON public.user_progress
FOR EACH ROW
EXECUTE FUNCTION public.populate_user_progress_api_update_history();

DO $$
DECLARE
  merged jsonb;
  sanitized jsonb;
BEGIN
  merged := public.merge_api_update_history(
    jsonb_build_object(
      'lastApiUpdate',
      jsonb_build_object('id', 'newer', 'at', 200, 'source', 'api')
    ),
    jsonb_build_object(
      'apiUpdateHistory',
      jsonb_build_array(
        jsonb_build_object('id', 'older', 'at', 100, 'source', 'api'),
        jsonb_build_object('id', 'newer', 'at', 150, 'source', 'api')
      )
    ),
    50
  );

  IF jsonb_typeof(merged) <> 'array' OR jsonb_array_length(merged) <> 2 THEN
    RAISE EXCEPTION
      'merge_api_update_history regression: expected deduped two-item array';
  END IF;

  IF (merged->0->>'id') <> 'newer' OR (merged->0->>'at')::bigint <> 200 THEN
    RAISE EXCEPTION
      'merge_api_update_history regression: expected newer entry first';
  END IF;

  sanitized := public.sanitize_user_progress_mode_data(
    jsonb_build_object(
      'apiUpdateHistory',
      merged,
      'lastApiUpdate',
      jsonb_build_object('id', 'newer', 'at', 200, 'source', 'api'),
      'unexpected',
      true
    )
  );

  IF jsonb_typeof(sanitized->'apiUpdateHistory') <> 'array' THEN
    RAISE EXCEPTION
      'sanitize_user_progress_mode_data regression: apiUpdateHistory not preserved as array';
  END IF;

  IF sanitized ? 'unexpected' THEN
    RAISE EXCEPTION
      'sanitize_user_progress_mode_data regression: unknown payload keys were not stripped';
  END IF;
END;
$$;
