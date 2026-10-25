-- Create a view that returns only summary data for team members
-- This dramatically reduces egress by avoiding full JSONB transfers

CREATE OR REPLACE VIEW team_member_summary AS
SELECT 
  user_id,
  current_game_mode,
  -- PVP summary
  pvp_data->>'displayName' as pvp_display_name,
  (pvp_data->>'level')::int as pvp_level,
  (
    SELECT COUNT(*)::int 
    FROM jsonb_each(COALESCE(pvp_data->'taskCompletions', '{}'::jsonb)) as tc
    WHERE (tc.value->>'complete')::boolean = true
  ) as pvp_tasks_completed,
  -- PVE summary  
  pve_data->>'displayName' as pve_display_name,
  (pve_data->>'level')::int as pve_level,
  (
    SELECT COUNT(*)::int 
    FROM jsonb_each(COALESCE(pve_data->'taskCompletions', '{}'::jsonb)) as tc
    WHERE (tc.value->>'complete')::boolean = true
  ) as pve_tasks_completed
FROM user_progress;

-- Grant access to the view
GRANT SELECT ON team_member_summary TO authenticated;
GRANT SELECT ON team_member_summary TO anon;;
