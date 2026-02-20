-- Post attachments table for multi-file uploads
CREATE TABLE post_attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    file_url TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    file_type TEXT NOT NULL,
    is_image BOOLEAN DEFAULT false,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_post_attachments_post_id ON post_attachments(post_id);

-- Storage bucket for post attachments (public access for reading)
INSERT INTO storage.buckets (id, name, public)
VALUES ('post-attachments', 'post-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload post attachments to their own folder
CREATE POLICY "Users can upload post attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'post-attachments' AND
    (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to delete their own post attachments
CREATE POLICY "Users can delete own post attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'post-attachments' AND
    (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow public read access to all post attachments
CREATE POLICY "Public can view post attachments"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'post-attachments');
