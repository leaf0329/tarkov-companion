ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS needed_items_sort_by TEXT,
  ADD COLUMN IF NOT EXISTS needed_items_sort_direction TEXT,
  ADD COLUMN IF NOT EXISTS needed_items_hide_owned BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS needed_items_card_style TEXT;

UPDATE public.user_preferences
SET needed_items_hide_owned = FALSE
WHERE needed_items_hide_owned IS NULL;

ALTER TABLE public.user_preferences
  ALTER COLUMN needed_items_hide_owned SET NOT NULL;

UPDATE public.user_preferences
SET needed_items_sort_by = 'priority'
WHERE needed_items_sort_by IS NOT NULL
  AND needed_items_sort_by NOT IN ('priority', 'name', 'category', 'count');

UPDATE public.user_preferences
SET needed_items_sort_direction = 'asc'
WHERE needed_items_sort_direction IS NOT NULL
  AND needed_items_sort_direction NOT IN ('asc', 'desc');

UPDATE public.user_preferences
SET needed_items_card_style = 'compact'
WHERE needed_items_card_style IS NOT NULL
  AND needed_items_card_style NOT IN ('compact', 'expanded');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_preferences_needed_items_sort_by_check'
      AND conrelid = 'public.user_preferences'::regclass
  ) THEN
    ALTER TABLE public.user_preferences
      ADD CONSTRAINT user_preferences_needed_items_sort_by_check
        CHECK (needed_items_sort_by IS NULL OR needed_items_sort_by IN ('priority', 'name', 'category', 'count'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_preferences_needed_items_sort_direction_check'
      AND conrelid = 'public.user_preferences'::regclass
  ) THEN
    ALTER TABLE public.user_preferences
      ADD CONSTRAINT user_preferences_needed_items_sort_direction_check
        CHECK (needed_items_sort_direction IS NULL OR needed_items_sort_direction IN ('asc', 'desc'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_preferences_needed_items_card_style_check'
      AND conrelid = 'public.user_preferences'::regclass
  ) THEN
    ALTER TABLE public.user_preferences
      ADD CONSTRAINT user_preferences_needed_items_card_style_check
        CHECK (needed_items_card_style IS NULL OR needed_items_card_style IN ('compact', 'expanded'));
  END IF;
END $$;
