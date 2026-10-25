ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS hideout_collapse_completed BOOLEAN DEFAULT FALSE NOT NULL,
  ADD COLUMN IF NOT EXISTS hideout_sort_ready_first BOOLEAN DEFAULT FALSE NOT NULL,
  ADD COLUMN IF NOT EXISTS map_zoom_speed DOUBLE PRECISION DEFAULT 1,
  ADD COLUMN IF NOT EXISTS pinned_task_ids JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS task_filter_presets JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS skill_sort_mode TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE c.conname = 'user_preferences_skill_sort_mode_check'
      AND t.relname = 'user_preferences'
      AND n.nspname = 'public'
  ) THEN
    ALTER TABLE public.user_preferences
      ADD CONSTRAINT user_preferences_skill_sort_mode_check
      CHECK (skill_sort_mode IS NULL OR skill_sort_mode IN ('priority', 'ingame'));
  END IF;
END $$;
