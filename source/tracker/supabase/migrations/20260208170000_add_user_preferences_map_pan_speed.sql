ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS map_pan_speed DOUBLE PRECISION DEFAULT 1;

UPDATE public.user_preferences
SET map_pan_speed = 1
WHERE map_pan_speed IS NULL;

ALTER TABLE public.user_preferences
  ALTER COLUMN map_pan_speed SET DEFAULT 1,
  ALTER COLUMN map_pan_speed SET NOT NULL;
