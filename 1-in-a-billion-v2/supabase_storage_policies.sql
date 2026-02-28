-- ============================================================================
-- STORAGE RLS POLICIES FOR job-artifacts BUCKET
-- ============================================================================
-- Run this in the Supabase Dashboard → SQL Editor
--
-- Problem: The mobile app uses supabase.storage.createSignedUrl() which
-- requires SELECT permission on storage.objects. Without these policies,
-- authenticated users get "Object not found" even though the bucket is public.
--
-- Storage path format: {user_id}/{job_id}/{type}/{filename}
-- Example: b1b72434-.../35e4844b-.../audio_mp3/Llll_Humandesign_audio.mp3
-- ============================================================================

-- 1. Allow authenticated users to READ (SELECT) their own files
--    This enables createSignedUrl() and download() to work
CREATE POLICY "Users can read own job artifacts"
ON storage.objects
FOR SELECT
TO authenticated
USING (
    bucket_id = 'job-artifacts'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 2. Allow authenticated users to INSERT (upload) to their own folder
--    This enables the backend workers to upload artifacts
--    (workers use service_role which bypasses RLS, but this is good practice)
CREATE POLICY "Users can upload to own job artifacts folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'job-artifacts'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 3. Allow service_role full access (backend workers use this)
--    service_role already bypasses RLS, but explicit policy is clearer
CREATE POLICY "Service role has full access to job artifacts"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'job-artifacts')
WITH CHECK (bucket_id = 'job-artifacts');

-- 4. Allow anon users to read public files (since bucket is public)
--    This makes the public URL fallback work even without auth
CREATE POLICY "Public read access for job artifacts"
ON storage.objects
FOR SELECT
TO anon
USING (bucket_id = 'job-artifacts');

-- ============================================================================
-- VERIFY: After running, test with:
--   SELECT policyname, cmd, roles
--   FROM pg_policies
--   WHERE schemaname = 'storage' AND tablename = 'objects'
--     AND policyname LIKE '%job artifact%';
-- ============================================================================
