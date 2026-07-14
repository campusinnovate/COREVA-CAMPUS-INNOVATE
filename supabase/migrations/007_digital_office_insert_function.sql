-- ============================================================
-- MIGRATION: Digital Office Insert Function
-- 1. Stored procedure untuk insert surat dengan validasi
-- 2. Auto-set penerima_id dari signatory pertama
-- 3. Security DEFINER agar bisa insert melewati RLS
-- Jalankan di Supabase SQL Editor
-- ============================================================

-- Hapus function lama jika ada (ganti dengan parameter lengkap)
DROP FUNCTION IF EXISTS public.insert_digital_office_letter(
    p_workspace_id UUID,
    p_konteks_id UUID,
    p_nomor_surat TEXT,
    p_judul_surat TEXT,
    p_pengirim_id UUID,
    p_pengaju_id UUID,
    p_template_id UUID,
    p_file_url TEXT,
    p_tujuan_surat TEXT,
    p_body_html TEXT,
    p_signatories JSONB
);

CREATE OR REPLACE FUNCTION public.insert_digital_office_letter(
    p_workspace_id UUID,
    p_konteks_id UUID,
    p_nomor_surat TEXT,
    p_judul_surat TEXT,
    p_pengirim_id UUID,
    p_pengaju_id UUID,
    p_template_id UUID,
    p_file_url TEXT DEFAULT '',
    p_tujuan_surat TEXT DEFAULT '',
    p_body_html TEXT DEFAULT '',
    p_signatories JSONB DEFAULT '[]'::jsonb
)
RETURNS JSONB
SECURITY DEFINER SET search_path = 'public'
LANGUAGE plpgsql
AS $$
DECLARE
    v_id UUID;
    v_penerima_id UUID;
    v_result JSONB;
BEGIN
    -- Validasi input wajib
    IF p_workspace_id IS NULL THEN
        RAISE EXCEPTION 'workspace_id tidak boleh kosong';
    END IF;
    IF p_konteks_id IS NULL THEN
        RAISE EXCEPTION 'konteks_id tidak boleh kosong';
    END IF;
    IF p_nomor_surat IS NULL OR p_nomor_surat = '' THEN
        RAISE EXCEPTION 'nomor_surat tidak boleh kosong';
    END IF;
    IF p_judul_surat IS NULL OR p_judul_surat = '' THEN
        RAISE EXCEPTION 'judul_surat tidak boleh kosong';
    END IF;
    IF p_pengirim_id IS NULL THEN
        RAISE EXCEPTION 'pengirim_id tidak boleh kosong';
    END IF;
    IF p_template_id IS NULL THEN
        RAISE EXCEPTION 'template_id tidak boleh kosong';
    END IF;

    -- Cek duplikasi nomor surat
    IF EXISTS (SELECT 1 FROM public.digital_office WHERE nomor_surat = p_nomor_surat) THEN
        RAISE EXCEPTION 'Nomor surat % sudah terpakai', p_nomor_surat;
    END IF;

    -- Auto-set penerima_id dari signatory layer-1 pertama jika signatories tidak kosong
    IF p_signatories IS NOT NULL AND jsonb_array_length(p_signatories) > 0 THEN
        v_penerima_id := (p_signatories->0->>'user_id')::UUID;
    END IF;

    INSERT INTO public.digital_office (
        workspace_id,
        konteks_id,
        nomor_surat,
        judul_surat,
        tujuan_surat,
        body_html,
        file_url,
        pengirim_id,
        pengaju_id,
        penerima_id,
        template_id,
        signatories,
        status,
        created_at
    ) VALUES (
        p_workspace_id,
        p_konteks_id,
        p_nomor_surat,
        p_judul_surat,
        p_tujuan_surat,
        p_body_html,
        p_file_url,
        p_pengirim_id,
        p_pengaju_id,
        v_penerima_id,
        p_template_id,
        p_signatories,
        'Menunggu',
        NOW()
    )
    RETURNING id INTO v_id;

    SELECT jsonb_build_object(
        'id', v_id,
        'nomor_surat', p_nomor_surat,
        'status', 'Menunggu',
        'penerima_id', v_penerima_id
    ) INTO v_result;

    RETURN v_result;
END;
$$;

-- Revoke execute from anon/public for security
REVOKE EXECUTE ON FUNCTION public.insert_digital_office_letter(
    UUID, UUID, TEXT, TEXT, UUID, UUID, UUID, TEXT, TEXT, TEXT, JSONB
) FROM anon, public;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.insert_digital_office_letter(
    UUID, UUID, TEXT, TEXT, UUID, UUID, UUID, TEXT, TEXT, TEXT, JSONB
) TO authenticated;

COMMENT ON FUNCTION public.insert_digital_office_letter(
    UUID, UUID, TEXT, TEXT, UUID, UUID, UUID, TEXT, TEXT, TEXT, JSONB
) IS 'Menyimpan surat baru ke digital_office dengan status Menunggu, auto-set penerima_id dari signatory pertama';
