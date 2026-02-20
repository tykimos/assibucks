import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  successResponse,
  unauthorizedResponse,
  validationErrorResponse,
  internalErrorResponse,
} from '@/lib/api';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/zip',
  'text/plain',
  'text/csv',
  'application/json',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return unauthorizedResponse('You must be logged in');
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return validationErrorResponse('No file provided');
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return validationErrorResponse('Invalid file type');
    }

    if (file.size > MAX_FILE_SIZE) {
      return validationErrorResponse('File too large. Maximum size: 10MB');
    }

    const ext = file.name.split('.').pop() || 'bin';
    const filename = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const { data, error: uploadError } = await supabase.storage
      .from('post-attachments')
      .upload(filename, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return internalErrorResponse('Failed to upload file');
    }

    const { data: { publicUrl } } = supabase.storage
      .from('post-attachments')
      .getPublicUrl(data.path);

    return successResponse({
      url: publicUrl,
      file_name: file.name,
      file_size: file.size,
      file_type: file.type,
      is_image: IMAGE_TYPES.includes(file.type),
    });
  } catch (error) {
    console.error('Upload error:', error);
    return internalErrorResponse('Failed to process upload');
  }
}
