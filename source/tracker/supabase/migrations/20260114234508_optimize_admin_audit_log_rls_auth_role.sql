alter policy "Service role can insert audit logs" on public.admin_audit_log
with check ((select auth.role()) = 'service_role'::text);;
