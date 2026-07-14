-- ============================================================
-- MIGRATION: Digital Office Enhancements
-- 1. Tambah kolom ke digital_office
-- 2. Tabel letter_signatories untuk asignment tanda tangan 2 layer
-- Jalankan di Supabase SQL Editor
-- ============================================================

-- 1. ADD columns to digital_office
ALTER TABLE digital_office
  ADD COLUMN IF NOT EXISTS pengaju_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE digital_office
  ADD COLUMN IF NOT EXISTS tujuan_surat TEXT DEFAULT '';

-- JSONB column for signatory tracking (stores array of signers with status)
ALTER TABLE digital_office
  ADD COLUMN IF NOT EXISTS signatories JSONB DEFAULT '[]'::jsonb;

-- Ensure body_html exists (migration 002 safeguard)
ALTER TABLE digital_office
  ADD COLUMN IF NOT EXISTS body_html TEXT DEFAULT '';

-- Ensure template_id exists (migration 002 safeguard)
ALTER TABLE digital_office
  ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES letter_templates(id) ON DELETE SET NULL;

-- 2. TABLE: letter_signatories - Flexible signatory assignment per template
CREATE TABLE IF NOT EXISTS letter_signatories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES letter_templates(id) ON DELETE CASCADE,
  layer INT NOT NULL CHECK (layer IN (1, 2)),
  position TEXT NOT NULL CHECK (position IN ('left', 'right')),
  user_id UUID NOT NULL,
  custom_title TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_letter_signatories_template ON letter_signatories(template_id);

ALTER TABLE letter_signatories ENABLE ROW LEVEL SECURITY;

CREATE POLICY letter_signatories_isolation ON letter_signatories
  FOR ALL USING (
    template_id IN (
      SELECT id FROM letter_templates WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      )
    )
  );

-- Enable realtime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'letter_signatories'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE letter_signatories;
  END IF;
END $$;

-- 3. Ensure header_url and footer_url exist on letter_templates (migration 002 safeguard)
ALTER TABLE letter_templates
  ADD COLUMN IF NOT EXISTS header_url TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS footer_url TEXT DEFAULT '';
