-- Prevent clients from self-assigning admin privileges.
-- Only service_role or direct SQL (no JWT role) may set or change is_admin.

UPDATE public.user_system
SET is_admin = false
WHERE is_admin IS NULL;
ALTER TABLE public.user_system
  ALTER COLUMN is_admin SET DEFAULT false,
  ALTER COLUMN is_admin SET NOT NULL;
REVOKE INSERT (is_admin) ON public.user_system FROM anon, authenticated;
REVOKE UPDATE (is_admin) ON public.user_system FROM anon, authenticated;
CREATE OR REPLACE FUNCTION public.prevent_user_system_admin_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  jwt_role text := current_setting('request.jwt.claim.role', true);
BEGIN
  -- Allow service_role or direct SQL (no JWT role present).
  IF jwt_role IS NULL OR jwt_role = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.is_admin IS TRUE THEN
      RAISE EXCEPTION 'is_admin can only be set by service role';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.is_admin IS DISTINCT FROM OLD.is_admin THEN
      RAISE EXCEPTION 'is_admin can only be changed by service role';
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS user_system_protect_is_admin ON public.user_system;
CREATE TRIGGER user_system_protect_is_admin
  BEFORE INSERT OR UPDATE ON public.user_system
  FOR EACH ROW EXECUTE FUNCTION public.prevent_user_system_admin_mutation();
