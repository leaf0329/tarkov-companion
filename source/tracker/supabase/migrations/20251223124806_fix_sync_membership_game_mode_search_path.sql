CREATE OR REPLACE FUNCTION public.sync_membership_game_mode()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  -- Get the game_mode from the team
  SELECT game_mode INTO NEW.game_mode
  FROM public.teams
  WHERE id = NEW.team_id;
  
  RETURN NEW;
END;
$$;;
