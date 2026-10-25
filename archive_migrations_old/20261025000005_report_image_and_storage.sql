-- 05: report image_url column + storage bucket policies
-- Add image_url column to reports
ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS image_url text;

COMMENT ON COLUMN public.reports.image_url IS 'Public URL of the uploaded report image (Storage bucket report-images).';

-- Create public bucket for report images (if not exists)
INSERT INTO storage.buckets (id, name, public)
VALUES ('report-images', 'report-images', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies on storage.objects for bucket report-images
-- Public read access
CREATE POLICY "report_images_public_read"
ON storage.objects FOR SELECT
USING (bucket_id = 'report-images');

-- Authenticated users can upload only into their own folder {auth.uid()}/
CREATE POLICY "report_images_auth_insert_own_folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'report-images' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Optional: users can update/delete their own images
CREATE POLICY "report_images_auth_update_own"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'report-images' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "report_images_auth_delete_own"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'report-images' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

COMMENT ON POLICY "report_images_public_read" ON storage.objects IS 'Anyone can view report images';
COMMENT ON POLICY "report_images_auth_insert_own_folder" ON storage.objects IS 'Authenticated users upload only under their own user_id folder';