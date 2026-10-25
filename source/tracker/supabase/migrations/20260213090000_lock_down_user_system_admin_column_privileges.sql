-- Enforce least privilege on user_system writes.
-- Keep authenticated writes for regular columns, but never allow direct writes to is_admin.
DO $$
DECLARE
  writable_columns text;
BEGIN
  REVOKE INSERT, UPDATE ON public.user_system FROM anon, authenticated;

  SELECT string_agg(format('%I', attname), ', ' ORDER BY attnum)
    INTO writable_columns
  FROM pg_attribute
  WHERE attrelid = 'public.user_system'::regclass
    AND attnum > 0
    AND NOT attisdropped
    AND attname <> 'is_admin';

  IF writable_columns IS NULL THEN
    RAISE EXCEPTION 'No writable columns found for public.user_system';
  END IF;

  EXECUTE format(
    'GRANT INSERT (%s) ON public.user_system TO authenticated',
    writable_columns
  );

  EXECUTE format(
    'GRANT UPDATE (%s) ON public.user_system TO authenticated',
    writable_columns
  );

  REVOKE INSERT (is_admin), UPDATE (is_admin) ON public.user_system FROM anon, authenticated;
END;
$$;
