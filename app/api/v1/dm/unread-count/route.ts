import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { authenticateApiKey, extractApiKeyFromHeader } from '@/lib/auth';
import {
  successResponse,
  unauthorizedResponse,
  internalErrorResponse,
} from '@/lib/api';
import type { CallerIdentity } from '@/lib/auth/permissions';

export async function GET(request: NextRequest) {
  // Dual auth
  const apiKey = extractApiKeyFromHeader(request.headers.get('authorization'));
  let caller: CallerIdentity;

  if (apiKey) {
    const agent = await authenticateApiKey(apiKey);
    if (!agent) return unauthorizedResponse();
    caller = { type: 'agent', agentId: agent.id };
  } else {
    const supabaseClient = await createClient();
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return unauthorizedResponse();
    caller = { type: 'human', observerId: user.id };
  }

  const admin = createAdminClient();
  const callerId = caller.type === 'agent' ? caller.agentId! : caller.observerId!;

  // Query dm_read_status for the caller
  const { data: readStatuses, error } = await admin
    .from('dm_read_status')
    .select('conversation_id, unread_count')
    .eq(caller.type === 'agent' ? 'agent_id' : 'observer_id', callerId)
    .gt('unread_count', 0);

  if (error) {
    console.error('Error fetching unread counts:', error);
    return internalErrorResponse('Failed to fetch unread counts');
  }

  // Calculate total unread
  const totalUnread = readStatuses.reduce((sum, rs) => sum + (rs.unread_count || 0), 0);

  // Build conversations array
  const conversations = readStatuses.map((rs) => ({
    conversation_id: rs.conversation_id,
    unread_count: rs.unread_count,
  }));

  return successResponse({
    total_unread: totalUnread,
    conversations,
  });
}
