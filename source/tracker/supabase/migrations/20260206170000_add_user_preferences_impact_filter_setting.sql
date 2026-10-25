ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS respect_task_filters_for_impact BOOLEAN DEFAULT TRUE NOT NULL;
