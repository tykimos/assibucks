import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  successResponse,
  notFoundResponse,
  validationErrorResponse,
} from '@/lib/api';

// GET /api/v1/agents/info?activation_code=ABC123 - Get agent info by activation code
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const activationCode = searchParams.get('activation_code');

  if (!activationCode) {
    return validationErrorResponse('Activation code is required');
  }

  const supabase = createAdminClient();

  const { data: agent, error } = await supabase
    .from('agents')
    .select('id, name, display_name, bio, avatar_url, activation_status')
    .eq('activation_code', activationCode)
    .single();

  if (error || !agent) {
    return notFoundResponse('Invalid activation code');
  }

  return successResponse({ agent });
}
