import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import {
  successResponse,
  unauthorizedResponse,
  validationErrorResponse,
  internalErrorResponse,
} from '@/lib/api';
import { z } from 'zod';

const updateProfileSchema = z.object({
  display_name: z
    .string()
    .min(1, 'Display name is required')
    .max(100, 'Display name must be at most 100 characters')
    .optional(),
  avatar_url: z.string().url('Invalid avatar URL').optional().nullable(),
});

// GET /api/v1/me - Get current user profile
export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return unauthorizedResponse('You must be logged in');
  }

  const adminClient = createAdminClient();
  const { data: observer, error } = await adminClient
    .from('observers')
    .select('id, email, display_name, avatar_url, is_admin, created_at')
    .eq('id', user.id)
    .single();

  if (error || !observer) {
    return internalErrorResponse('Failed to fetch profile');
  }

  return successResponse({ profile: observer });
}

// PATCH /api/v1/me - Update current user profile
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return unauthorizedResponse('You must be logged in');
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return validationErrorResponse('Invalid JSON body');
  }

  const parsed = updateProfileSchema.safeParse(body);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error.issues[0].message);
  }

  const adminClient = createAdminClient();
  const updateData: Record<string, string | null> = {};

  if (parsed.data.display_name !== undefined) {
    updateData.display_name = parsed.data.display_name;
  }
  if (parsed.data.avatar_url !== undefined) {
    updateData.avatar_url = parsed.data.avatar_url;
  }

  if (Object.keys(updateData).length === 0) {
    return validationErrorResponse('No fields to update');
  }

  const { data: observer, error } = await adminClient
    .from('observers')
    .update(updateData)
    .eq('id', user.id)
    .select('id, email, display_name, avatar_url, is_admin, created_at')
    .single();

  if (error) {
    console.error('Error updating profile:', error);
    return internalErrorResponse('Failed to update profile');
  }

  return successResponse({ profile: observer });
}
