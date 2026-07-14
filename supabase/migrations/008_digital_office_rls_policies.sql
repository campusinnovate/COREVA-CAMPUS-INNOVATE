-- ============================================================
-- MIGRATION: Digital Office RLS Policies
-- 1. Enable RLS pada tabel digital_office
-- 2. Policy SELECT: semua anggota workspace bisa membaca
-- 3. Policy INSERT: anggota workspace bisa insert
-- 4. Policy UPDATE: pengirim/signatories bisa update
-- 5. Policy DELETE: pengirim/pengaju bisa hapus
-- Jalankan di Supabase SQL Editor
-- ============================================================

-- 1. ENABLE ROW LEVEL SECURITY
ALTER TABLE public.digital_office ENABLE ROW LEVEL SECURITY;

-- 2. DROP POLICIES LAMA (jika ada)
DROP POLICY IF EXISTS "Users can read own digital_office" ON public.digital_office;
DROP POLICY IF EXISTS "Users can manage own digital_office" ON public.digital_office;
DROP POLICY IF EXISTS "Users can insert digital_office" ON public.digital_office;
DROP POLICY IF EXISTS "workspace_members_select_digital_office" ON public.digital_office;
DROP POLICY IF EXISTS "workspace_members_insert_digital_office" ON public.digital_office;
DROP POLICY IF EXISTS "owner_signatory_update_digital_office" ON public.digital_office;
DROP POLICY IF EXISTS "owner_delete_digital_office" ON public.digital_office;

-- 3. POLICY SELECT: Semua anggota workspace bisa membaca surat
CREATE POLICY "workspace_members_select_digital_office" ON public.digital_office
    FOR SELECT
    USING (
        workspace_id IN (
            SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
        )
    );

-- 4. POLICY INSERT: Anggota workspace bisa membuat surat (fallback jika tidak via function)
CREATE POLICY "workspace_members_insert_digital_office" ON public.digital_office
    FOR INSERT
    WITH CHECK (
        workspace_id IN (
            SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
        )
    );

-- 5. POLICY UPDATE: Pengirim, pengaju, dan signatories yang belum signed bisa update
CREATE POLICY "owner_signatory_update_digital_office" ON public.digital_office
    FOR UPDATE
    USING (
        pengirim_id = auth.uid()
        OR pengaju_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM jsonb_array_elements(COALESCE(signatories, '[]'::jsonb)) AS s
            WHERE s->>'user_id' = auth.uid()::text
        )
    );

-- 6. POLICY DELETE: Hanya pengirim atau pengaju yang bisa hapus
CREATE POLICY "owner_delete_digital_office" ON public.digital_office
    FOR DELETE
    USING (
        pengirim_id = auth.uid() OR pengaju_id = auth.uid()
    );
