-- ============================================================
-- MIGRATION: Fix all security issues from Supabase lint report
-- Jalankan di Supabase SQL Editor
-- ============================================================

-- ============================================================
-- A. FIX: Function Search Path + SECURITY DEFINER
-- ============================================================

-- 1. get_all_auth_users - very sensitive, revoke from anon, set search_path
REVOKE EXECUTE ON FUNCTION public.get_all_auth_users() FROM anon, public;
ALTER FUNCTION public.get_all_auth_users() SET search_path = 'public';

-- 2. cek_admin_workspace - change to SECURITY INVOKER, set search_path
ALTER FUNCTION public.cek_admin_workspace(cek_ws_id uuid) SECURITY INVOKER SET search_path = 'public';

-- 3. get_my_workspaces - change to SECURITY INVOKER, set search_path
ALTER FUNCTION public.get_my_workspaces() SECURITY INVOKER SET search_path = 'public';

-- 4. is_superadmin - revert to SECURITY DEFINER (needed to read auth.users),
--    but revoke from anon/public and set search_path
ALTER FUNCTION public.is_superadmin() SECURITY DEFINER SET search_path = 'public';
REVOKE EXECUTE ON FUNCTION public.is_superadmin() FROM anon, public;


-- ============================================================
-- B. HELPER FUNCTIONS (break RLS recursion)
-- ============================================================

-- Helper SECURITY DEFINER for policies on user_roles table itself
-- to avoid infinite recursion (policy queries the same table)
CREATE OR REPLACE FUNCTION public._check_user_role(required_role text)
RETURNS boolean
SECURITY DEFINER SET search_path = 'public'
LANGUAGE sql STABLE
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = required_role::text);
$$;

-- Helper SECURITY DEFINER for policies on workspace_members table itself
-- to avoid infinite recursion
CREATE OR REPLACE FUNCTION public._is_workspace_member(ws_id uuid)
RETURNS boolean
SECURITY DEFINER SET search_path = 'public'
LANGUAGE sql STABLE
AS $$
  SELECT EXISTS (SELECT 1 FROM public.workspace_members WHERE workspace_id = ws_id AND user_id = auth.uid());
$$;

-- Helper SECURITY DEFINER for admin check on workspace_members
CREATE OR REPLACE FUNCTION public._is_workspace_admin(ws_id uuid)
RETURNS boolean
SECURITY DEFINER SET search_path = 'public'
LANGUAGE sql STABLE
AS $$
  SELECT EXISTS (SELECT 1 FROM public.workspace_members WHERE workspace_id = ws_id AND user_id = auth.uid() AND role IN ('admin', 'owner'));
$$;


-- ============================================================
-- C. FIX: RLS Policies Always True
-- ============================================================

-- 5. chat_messages: Enable insert for authenticated users
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.chat_messages;
CREATE POLICY "Enable insert for authenticated users" ON public.chat_messages
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- 6. page_views: Public can insert page views
DROP POLICY IF EXISTS "Public can insert page views" ON public.page_views;
CREATE POLICY "Public can insert page views" ON public.page_views
  FOR INSERT
  WITH CHECK (auth.role() = 'anon' OR auth.role() = 'authenticated');

-- 7. registration_requests: Izinkan admin update pengajuan
DROP POLICY IF EXISTS "Izinkan admin update pengajuan" ON public.registration_requests;
CREATE POLICY "Izinkan admin update pengajuan" ON public.registration_requests
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('superadmin', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('superadmin', 'admin')
    )
  );

-- 8. registration_requests: Izinkan publik insert data pendaftaran
DROP POLICY IF EXISTS "Izinkan publik insert data pendaftaran" ON public.registration_requests;
CREATE POLICY "Izinkan publik insert data pendaftaran" ON public.registration_requests
  FOR INSERT
  WITH CHECK (auth.role() = 'anon');

-- 9. user_roles: replace Bypass RLS with proper policies
DROP POLICY IF EXISTS "Bypass RLS user_roles" ON public.user_roles;

-- Users can SELECT their own role (safe, no recursion - simple column check)
DROP POLICY IF EXISTS "Users can view own role" ON public.user_roles;
CREATE POLICY "Users can view own role" ON public.user_roles
  FOR SELECT
  USING (user_id = auth.uid());

-- Superadmins manage all roles (uses helper to avoid infinite recursion)
DROP POLICY IF EXISTS "Superadmins manage all roles" ON public.user_roles;
CREATE POLICY "Superadmins manage all roles" ON public.user_roles
  FOR ALL
  USING (public._check_user_role('superadmin'))
  WITH CHECK (public._check_user_role('superadmin'));

-- 10. workspace_members: Fix policies (use helpers to avoid recursion)
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.workspace_members;

-- Users can view their own membership + members of workspaces they belong to
DROP POLICY IF EXISTS "Users can view workspace members" ON public.workspace_members;
CREATE POLICY "Users can view workspace members" ON public.workspace_members
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR
    public._is_workspace_member(workspace_id)
    OR
    public._check_user_role('superadmin')
  );

-- Insert with proper checks (user can add self, admin can add others)
CREATE POLICY "Enable insert for authenticated users" ON public.workspace_members
  FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated'
    AND (
      (user_id = auth.uid())
      OR
      public._is_workspace_admin(workspace_id)
    )
  );

-- Workspace admins/owners can update/delete members
DROP POLICY IF EXISTS "Admins can manage workspace members" ON public.workspace_members;
CREATE POLICY "Admins can manage workspace members" ON public.workspace_members
  FOR ALL
  USING (public._is_workspace_admin(workspace_id) OR public._check_user_role('superadmin'))
  WITH CHECK (public._is_workspace_admin(workspace_id) OR public._check_user_role('superadmin'));

-- 11. workspaces: Bypass RLS workspaces
DROP POLICY IF EXISTS "Bypass RLS workspaces" ON public.workspaces;
DROP POLICY IF EXISTS "Admin manage workspaces" ON public.workspaces;
CREATE POLICY "Admin manage workspaces" ON public.workspaces
  FOR ALL
  USING (
    public._check_user_role('superadmin')
    OR
    EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE workspace_id = id AND user_id = auth.uid() AND role IN ('admin', 'owner')
    )
  )
  WITH CHECK (
    public._check_user_role('superadmin')
    OR
    EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE workspace_id = id AND user_id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

-- Regular members can SELECT workspaces they belong to
DROP POLICY IF EXISTS "Members view workspaces" ON public.workspaces;
CREATE POLICY "Members view workspaces" ON public.workspaces
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE workspace_id = id AND user_id = auth.uid()
    )
  );


-- ============================================================
-- D. FIX: Storage Bucket Policies (Public Bucket Allows Listing)
-- ============================================================

-- 12. Fix workspace_files bucket policies
DROP POLICY IF EXISTS "Public read workspace_files" ON storage.objects;
DROP POLICY IF EXISTS "Give users access to workspace_files" ON storage.objects;

CREATE POLICY "Give users access to workspace_files" ON storage.objects
  FOR ALL
  USING (
    bucket_id = 'workspace_files'
    AND auth.role() = 'authenticated'
  )
  WITH CHECK (
    bucket_id = 'workspace_files'
    AND auth.role() = 'authenticated'
  );

-- 13. Create digital_office bucket if not exists, with proper policies
INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types)
SELECT 'digital_office', 'digital_office', true, false, 52428800, NULL
WHERE NOT EXISTS (
  SELECT 1 FROM storage.buckets WHERE id = 'digital_office'
);

DROP POLICY IF EXISTS "Give public access to digital_office bucket" ON storage.objects;
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can manage digital_office files" ON storage.objects;

CREATE POLICY "Authenticated users can manage digital_office files" ON storage.objects
  FOR ALL
  USING (
    bucket_id = 'digital_office'
    AND auth.role() = 'authenticated'
  )
  WITH CHECK (
    bucket_id = 'digital_office'
    AND auth.role() = 'authenticated'
  );


-- ============================================================
-- E. ADD INDEXES (optimize RLS policy queries)
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_wm_user_workspace ON public.workspace_members(user_id, workspace_id);
CREATE INDEX IF NOT EXISTS idx_wm_workspace_role ON public.workspace_members(workspace_id, role);
CREATE INDEX IF NOT EXISTS idx_ur_user_role ON public.user_roles(user_id, role);
CREATE INDEX IF NOT EXISTS idx_ur_role ON public.user_roles(role);
CREATE INDEX IF NOT EXISTS idx_wm_workspace_user ON public.workspace_members(workspace_id, user_id);


-- ============================================================
-- F. LEAKED PASSWORD PROTECTION
--    Enable manually via Dashboard:
--    Authentication → Settings → Leaked password protection → ENABLE
-- ============================================================


-- ============================================================
-- G. VERIFICATION QUERIES (jalankan setelah migrasi untuk cek)
-- ============================================================

-- Cek fungsi:
-- SELECT proname, prosecdef, prosrc FROM pg_proc WHERE proname IN ('get_all_auth_users','cek_admin_workspace','get_my_workspaces','is_superadmin','_check_user_role','_is_workspace_member','_is_workspace_admin');

-- Cek policies:
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check FROM pg_policies ORDER BY tablename, policyname;