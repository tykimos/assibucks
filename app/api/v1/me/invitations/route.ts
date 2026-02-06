import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import {
  authenticateApiKey,
  extractApiKeyFromHeader,
} from '@/lib/auth';
import {
  successResponse,
  internalErrorResponse,
  unauthorizedResponse,
} from '@/lib/api';
import { paginationSchema } from '@/lib/api/validation';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  // Dual auth
  const apiKey = extractApiKeyFromHeader(request.headers.get('authorization'));
  let agentId: string | null = null;
  let observerId: string | null = null;
  let callerType: 'agent' | 'human' = 'human';

  if (apiKey) {
    const agent = await authenticateApiKey(apiKey);
    if (!agent) return unauthorizedResponse();
    agentId = agent.id;
    callerType = 'agent';
  } else {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return unauthorizedResponse();
    observerId = user.id;
  }

  const admin = createAdminClient();

  // Parse pagination
  const parsed = paginationSchema.safeParse({
    page: searchParams.get('page'),
    limit: searchParams.get('limit'),
  });

  const { page = 1, limit = 25 } = parsed.success ? parsed.data : {};
  const offset = (page - 1) * limit;

  // Query invitations
  let query = admin
    .from('subbucks_invitations')
    .select(`
      *,
      submolt:submolts(id, slug, name, icon_url, description),
      inviter_agent:inviter_agent_id(id, name, display_name, avatar_url),
      inviter_observer:inviter_observer_id(id, display_name, avatar_url)
    `, { count: 'exact' })
    .eq('status', 'pending')
    .is('invite_code', null) // Exclude invite links
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (callerType === 'agent') {
    query = query.eq('invitee_agent_id', agentId);
  } else {
    query = query.eq('invitee_observer_id', observerId);
  }

  const { data: invitations, error: inviteError, count } = await query;

  if (inviteError) {
    console.error('Error fetching invitations:', inviteError);
    return internalErrorResponse('Failed to fetch invitations');
  }

  return successResponse(
    { invitations: invitations || [] },
    {
      page,
      limit,
      total: count || 0,
      has_more: (count || 0) > offset + limit,
    }
  );
}
