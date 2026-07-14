-- ============================================================
-- MIGRATION: Letter Templates for My Workspace
-- Jalankan di Supabase SQL Editor
-- ============================================================

-- 1. TABLE: letter_templates
CREATE TABLE IF NOT EXISTS letter_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  konteks_id UUID REFERENCES surat_contexts(id) ON DELETE SET NULL,
  letterhead_url TEXT,
  body_template TEXT DEFAULT '',
  signature_left_name TEXT DEFAULT '',
  signature_left_title TEXT DEFAULT '',
  signature_right_name TEXT DEFAULT '',
  signature_right_title TEXT DEFAULT '',
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_letter_templates_workspace ON letter_templates(workspace_id);

ALTER TABLE letter_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY letter_templates_isolation ON letter_templates
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- Enable realtime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'letter_templates'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE letter_templates;
  END IF;
END $$;

-- 2. ADD template_id column to digital_office
ALTER TABLE digital_office
  ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES letter_templates(id) ON DELETE SET NULL;

-- 3. ADD body_html column to digital_office (for rich content)
ALTER TABLE digital_office
  ADD COLUMN IF NOT EXISTS body_html TEXT DEFAULT '';

-- 4. ADD header_url and footer_url to letter_templates
ALTER TABLE letter_templates
  ADD COLUMN IF NOT EXISTS header_url TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS footer_url TEXT DEFAULT '';
