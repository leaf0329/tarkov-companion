ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS dashboard_notice_dismissed BOOLEAN NOT NULL DEFAULT FALSE;
