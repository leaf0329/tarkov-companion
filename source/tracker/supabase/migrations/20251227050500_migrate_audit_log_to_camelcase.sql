-- Migrate admin_audit_log.details from snake_case to camelCase for cache_purge actions
-- This ensures data consistency after switching to camelCase naming convention

-- Update cache_purge records to use camelCase in details JSONB
UPDATE admin_audit_log
SET details = (
  -- Start with existing details
  SELECT jsonb_object_agg(
    CASE
      -- Map snake_case keys to camelCase
      WHEN key = 'purge_type' THEN 'purgeType'
      WHEN key = 'cloudflare_result_id' THEN 'cloudflareResultId'
      ELSE key
    END,
    value
  )
  FROM jsonb_each(details)
)
WHERE action = 'cache_purge'
  AND (
    details ? 'purge_type' OR
    details ? 'cloudflare_result_id'
  );
-- Add a comment to track the migration
COMMENT ON TABLE admin_audit_log IS 'Admin action audit log. Details column uses camelCase naming (migrated 2025-12-27).';
