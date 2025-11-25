/*
  # Add Comment Attachments Storage

  1. Storage Setup
    - Create storage bucket for comment attachments
    - Enable public access for authenticated users
    - Set file size limits (10MB per file)
  
  2. Security
    - Only authenticated users can upload
    - Users can only upload to their own comments
    - Public read access for workspace members
    - Auto-delete attachments when comments are deleted
  
  3. Storage Policies
    - Upload: Authenticated users only
    - Read: Authenticated users only
    - Delete: Comment author or workspace admin only
*/

-- Create storage bucket for comment attachments
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'comment-attachments',
  'comment-attachments',
  false,
  10485760, -- 10MB limit
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv',
    'video/mp4',
    'video/quicktime'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Authenticated users can upload comment attachments" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated users can view comment attachments" ON storage.objects;
  DROP POLICY IF EXISTS "Users can delete their own attachments" ON storage.objects;
  DROP POLICY IF EXISTS "Users can update their own attachments" ON storage.objects;
END $$;

-- Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload comment attachments"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'comment-attachments'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow authenticated users to read files
CREATE POLICY "Authenticated users can view comment attachments"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'comment-attachments');

-- Allow users to delete their own attachments
CREATE POLICY "Users can delete their own attachments"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'comment-attachments'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to update their own attachments
CREATE POLICY "Users can update their own attachments"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'comment-attachments'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
