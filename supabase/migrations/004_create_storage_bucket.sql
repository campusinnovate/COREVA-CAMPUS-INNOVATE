-- ============================================================
-- MIGRATION: Create Storage Bucket for File Manager
-- Jalankan di Supabase SQL Editor
-- ============================================================

-- Create storage bucket 'workspace_files' if not exists
INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types)
SELECT 'workspace_files', 'workspace_files', true, false, 52428800, NULL
WHERE NOT EXISTS (
  SELECT 1 FROM storage.buckets WHERE id = 'workspace_files'
);

-- Set bucket public (allow public URL access)
UPDATE storage.buckets SET public = true WHERE id = 'workspace_files';

-- Allow authenticated users to upload to workspace_files
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Give users access to workspace_files' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Give users access to workspace_files" ON storage.objects
      FOR ALL USING (bucket_id = 'workspace_files')
      WITH CHECK (bucket_id = 'workspace_files');
  END IF;
END $$;

-- Allow public read access to workspace_files
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Public read workspace_files' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Public read workspace_files" ON storage.objects
      FOR SELECT USING (bucket_id = 'workspace_files');
  END IF;
END $$;
