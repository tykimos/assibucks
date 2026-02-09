import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { successResponse } from '@/lib/api';

export async function GET(request: NextRequest) {
  const supabaseClient = await createClient();
  const { data: { user }, error } = await supabaseClient.auth.getUser();

  return successResponse({
    authenticated: !!user,
    userId: user?.id || null,
    email: user?.email || null,
    error: error?.message || null,
    hasCookies: request.cookies.getAll().length > 0,
    cookieNames: request.cookies.getAll().map(c => c.name),
  });
}
