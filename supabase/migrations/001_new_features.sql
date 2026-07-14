-- ============================================================
-- MIGRATION: Fitur Baru v1
-- File Manager, Onboarding, Enhanced Calendar RSVP
-- Jalankan di Supabase SQL Editor
-- ============================================================

-- 1. TABLE: workspace_files (untuk File Manager)
CREATE TABLE IF NOT EXISTS workspace_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES workspace_files(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('file', 'folder')),
  file_url TEXT,
  file_size BIGINT DEFAULT 0,
  mime_type TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workspace_files_workspace ON workspace_files(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_files_parent ON workspace_files(parent_id);

-- Enable Row Level Security
ALTER TABLE workspace_files ENABLE ROW LEVEL SECURITY;

-- Policy: users can only see their own workspace files
CREATE POLICY workspace_files_isolation ON workspace_files
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- Enable realtime for workspace_files
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'workspace_files'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE workspace_files;
  END IF;
END $$;


-- 2. TABLE: event_responses (untuk RSVP Calendar)
CREATE TABLE IF NOT EXISTS event_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL,
  event_type TEXT NOT NULL DEFAULT 'schedule',
  user_id UUID NOT NULL,
  response TEXT NOT NULL CHECK (response IN ('hadir', 'tidak_hadir', 'tentatif')),
  responded_at TIMESTAMPTZ DEFAULT now(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_event_responses_event ON event_responses(event_id);
CREATE INDEX IF NOT EXISTS idx_event_responses_user ON event_responses(user_id);
CREATE INDEX IF NOT EXISTS idx_event_responses_workspace ON event_responses(workspace_id);

-- Unique: satu respon per user per event
CREATE UNIQUE INDEX IF NOT EXISTS idx_event_responses_unique
  ON event_responses(event_id, user_id, event_type);

ALTER TABLE event_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY event_responses_isolation ON event_responses
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'event_responses'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE event_responses;
  END IF;
END $$;


-- 3. ADD COLUMNS ke custom_schedules
ALTER TABLE custom_schedules
  ADD COLUMN IF NOT EXISTS assigned_to JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS lokasi TEXT DEFAULT '';


-- 4. ADD COLUMNS ke workspace_agenda (untuk sync)
ALTER TABLE workspace_agenda
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS source_event_id TEXT DEFAULT '';


-- 5. FIX: Pastikan custom_schedules punya workspace_id dan realtime
ALTER TABLE custom_schedules ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'custom_schedules'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE custom_schedules;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'workspace_agenda'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE workspace_agenda;
  END IF;
END $$;

-- 6. CREATE Supabase Storage Bucket
-- Buka Supabase Dashboard > Storage > Create bucket
-- Nama bucket: workspace_files
-- Public: YES
-- Atau jalankan via API:
--   supabase storage create workspace_files --public
