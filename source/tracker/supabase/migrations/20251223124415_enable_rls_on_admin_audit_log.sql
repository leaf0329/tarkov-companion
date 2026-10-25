-- Enable RLS
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Allow admins to read audit logs
CREATE POLICY "Admins can read audit logs" ON admin_audit_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_system 
      WHERE user_system.user_id = auth.uid() 
      AND user_system.is_admin = true
    )
  );

-- Allow service role to insert (edge functions use service role)
CREATE POLICY "Service role can insert audit logs" ON admin_audit_log
  FOR INSERT
  WITH CHECK (true);

-- No update or delete policies - audit logs are immutable;
