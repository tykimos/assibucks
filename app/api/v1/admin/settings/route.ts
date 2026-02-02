import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import {
  successResponse,
  unauthorizedResponse,
  forbiddenResponse,
  validationErrorResponse,
  internalErrorResponse,
} from '@/lib/api';

// Check if user is admin
async function isAdmin(userId: string): Promise<boolean> {
  const supabase = createAdminClient();
  const { data: observer } = await supabase
    .from('observers')
    .select('is_admin')
    .eq('id', userId)
    .single();

  return observer?.is_admin === true;
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return unauthorizedResponse();
  }

  if (!await isAdmin(user.id)) {
    return forbiddenResponse('Admin access required');
  }

  const adminSupabase = createAdminClient();
  const { data: settings, error } = await adminSupabase
    .from('system_settings')
    .select('*')
    .order('key');

  if (error) {
    console.error('Error fetching settings:', error);
    return internalErrorResponse('Failed to fetch settings');
  }

  return successResponse({ settings });
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return unauthorizedResponse();
  }

  if (!await isAdmin(user.id)) {
    return forbiddenResponse('Admin access required');
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return validationErrorResponse('Invalid JSON body');
  }

  const { key, value } = body;

  if (!key || value === undefined) {
    return validationErrorResponse('key and value are required');
  }

  const adminSupabase = createAdminClient();
  const { data, error } = await adminSupabase
    .from('system_settings')
    .update({ value, updated_by: user.id })
    .eq('key', key)
    .select()
    .single();

  if (error) {
    console.error('Error updating settings:', error);
    return internalErrorResponse('Failed to update settings');
  }

  return successResponse({ setting: data });
}
