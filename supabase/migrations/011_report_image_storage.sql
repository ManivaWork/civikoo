-- 011: Report images & Storage
-- ============================================================================

-- Storage bucket for report images
-- Note: This creates the bucket via SQL. In Supabase, run this in Dashboard > Storage > New bucket
-- Or use the Supabase CLI: supabase storage create report-images
-- The bucket must be created manually or via Supabase CLI

-- Table to track report images
CREATE TABLE IF NOT EXISTS public.report_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  storage_path text NOT NULL, -- e.g., "report-images/{report_id}/{uuid}.webp"
  mime_type text NOT NULL DEFAULT 'image/webp',
  size_bytes int NOT NULL,
  width int,
  height int,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS report_images_report_idx ON public.report_images (report_id);
CREATE INDEX IF NOT EXISTS report_images_user_idx ON public.report_images (user_id);

-- RLS
ALTER TABLE public.report_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "report_images_select_visible" ON public.report_images;
CREATE POLICY "report_images_select_visible" ON public.report_images
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.reports r
      WHERE r.id = report_images.report_id
        AND r.hidden = false
    )
  );

DROP POLICY IF EXISTS "report_images_insert_own_report" ON public.report_images;
CREATE POLICY "report_images_insert_own_report" ON public.report_images
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.reports r
      WHERE r.id = report_images.report_id
        AND r.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "report_images_delete_own" ON public.report_images;
CREATE POLICY "report_images_delete_own" ON public.report_images
  FOR DELETE USING (auth.uid() = user_id);

-- RPC: Register image after upload
CREATE OR REPLACE FUNCTION public.register_report_image(
  p_report_id uuid,
  p_storage_path text,
  p_mime_type text DEFAULT 'image/webp',
  p_size_bytes int,
  p_width int DEFAULT NULL,
  p_height int DEFAULT NULL,
  p_is_primary boolean DEFAULT false
)
RETURNS TABLE (success boolean, message text, image_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_report public.reports;
  v_count int;
BEGIN
  -- Verify report exists and belongs to user
  SELECT * INTO v_report FROM public.reports WHERE id = p_report_id;
  IF v_report IS NULL THEN
    RETURN QUERY SELECT false, 'Reporte não encontrado', NULL::uuid;
  END IF;

  IF v_report.user_id <> v_user_id THEN
    RETURN QUERY SELECT false, 'Não pode adicionar imagem a reporte de outro usuário', NULL::uuid;
  END IF;

  -- If setting as primary, unset others
  IF p_is_primary THEN
    UPDATE public.report_images
    SET is_primary = false
    WHERE report_id = p_report_id;
  END IF;

  -- Check image count limit (max 5 per report)
  SELECT count(*) INTO v_count FROM public.report_images WHERE report_id = p_report_id;
  IF v_count >= 5 THEN
    RETURN QUERY SELECT false, 'Limite de 5 imagens por reporte', NULL::uuid;
  END IF;

  -- Insert
  INSERT INTO public.report_images (report_id, user_id, storage_path, mime_type, size_bytes, width, height, is_primary)
  VALUES (p_report_id, v_user_id, p_storage_path, p_mime_type, p_size_bytes, p_width, p_height, p_is_primary)
  RETURNING id INTO v_count;

  RETURN QUERY SELECT true, 'Imagem registrada', v_count::uuid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_report_image TO authenticated;

-- RPC: Delete image
CREATE OR REPLACE FUNCTION public.delete_report_image(p_image_id uuid)
RETURNS TABLE (success boolean, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_image public.report_images;
BEGIN
  SELECT * INTO v_image FROM public.report_images WHERE id = p_image_id;
  IF v_image IS NULL THEN
    RETURN QUERY SELECT false, 'Imagem não encontrada';
  END IF;

  IF v_image.user_id <> v_user_id THEN
    RETURN QUERY SELECT false, 'Não pode excluir imagem de outro usuário';
  END IF;

  -- Delete from storage (would need storage extension or edge function)
  -- For now just delete record
  DELETE FROM public.report_images WHERE id = p_image_id;

  RETURN QUERY SELECT true, 'Imagem excluída';
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_report_image TO authenticated;

-- RPC: Get signed URL for upload (client-side direct upload)
CREATE OR REPLACE FUNCTION public.get_upload_signed_url(
  p_report_id uuid,
  p_filename text,
  p_content_type text
)
RETURNS TABLE (success boolean, message text, signed_url text, storage_path text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_report public.reports;
  v_extension text;
  v_uuid uuid := gen_random_uuid();
  v_path text;
BEGIN
  -- Verify report
  SELECT * INTO v_report FROM public.reports WHERE id = p_report_id;
  IF v_report IS NULL THEN
    RETURN QUERY SELECT false, 'Reporte não encontrado', '', '';
  END IF;

  IF v_report.user_id <> v_user_id THEN
    RETURN QUERY SELECT false, 'Não autorizado', '', '';
  END IF;

  -- Extract extension
  v_extension := lower(split_part(p_filename, '.', -1));
  IF v_extension NOT IN ('webp', 'jpg', 'jpeg', 'png', 'heic') THEN
    RETURN QUERY SELECT false, 'Formato não suportado (use webp, jpg, png)', '', '';
  END IF;

  v_path := format('report-images/%s/%s.%s', p_report_id, v_uuid, v_extension);

  -- Generate signed URL (requires storage extension or edge function)
  -- This is a placeholder - actual implementation uses supabase.storage.from('report-images').createSignedUploadUrl()
  RETURN QUERY SELECT true, 'OK', ''::text, v_path;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_upload_signed_url TO authenticated;

-- RPC: Get image URLs for a report
CREATE OR REPLACE FUNCTION public.get_report_images(p_report_id uuid)
RETURNS TABLE (
  id uuid,
  storage_path text,
  mime_type text,
  size_bytes int,
  width int,
  height int,
  is_primary boolean,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  RETURN QUERY
  SELECT ri.id, ri.storage_path, ri.mime_type, ri.size_bytes, ri.width, ri.height, ri.is_primary, ri.created_at
  FROM public.report_images ri
  WHERE ri.report_id = p_report_id
  ORDER BY ri.is_primary DESC, ri.created_at ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_report_images TO anon, authenticated;

COMMENT ON TABLE public.report_images IS 'Imagens associadas a reportes (metadados). Arquivos ficam no bucket Storage.';
COMMENT ON FUNCTION public.register_report_image IS 'Registra metadados da imagem após upload.';
COMMENT ON FUNCTION public.delete_report_image IS 'Remove registro de imagem (Storage deve ser limpo separadamente).';
COMMENT ON FUNCTION public.get_upload_signed_url IS 'Gera URL assinada para upload direto do cliente para Storage.';
COMMENT ON FUNCTION public.get_report_images IS 'Lista imagens de um reporte.';