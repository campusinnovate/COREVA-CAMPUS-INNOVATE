-- ============================================================
-- MIGRATION: Izinkan workspace admin menambah user biasa
-- Admin/owner workspace dapat insert ke user_roles dengan role 'user'
-- ============================================================

DROP POLICY IF EXISTS "Workspace admins can insert regular users" ON public.user_roles;

CREATE POLICY "Workspace admins can insert regular users" ON public.user_roles
  FOR INSERT
  WITH CHECK (
    role = 'user'
    AND EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE user_id = auth.uid()
        AND role IN ('Admin', 'owner')
    )
  );
