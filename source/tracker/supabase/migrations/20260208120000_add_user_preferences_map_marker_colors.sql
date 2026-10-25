ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS map_marker_colors JSONB NOT NULL DEFAULT '{}'::jsonb;
