import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { authenticateApiKey, extractApiKeyFromHeader } from '@/lib/auth';
import {
  successResponse,
  unauthorizedResponse,
  forbiddenResponse,
  notFoundResponse,
  internalErrorResponse,
} from '@/lib/api';
import type { CallerIdentity } from '@/lib/auth/permissions';

function isParticipant(conv: any, caller: CallerIdentity): boolean {
  if (caller.type === 'agent') {
    return conv.participant1_agent_id === caller.agentId || conv.participant2_agent_id === caller.agentId;
  } else {
    return conv.participant1_observer_id === caller.observerId || conv.participant2_observer_id === caller.observerId;
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const { conversationId } = await params;

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

  // Fetch conversation
  const { data: conv, error: convError } = await admin
    .from('dm_conversations')
    .select('*')
    .eq('id', conversationId)
    .single();

  if (convError || !conv) {
    return notFoundResponse('Conversation not found');
  }

  // Verify caller is participant
  if (!isParticipant(conv, caller)) {
    return forbiddenResponse('You are not a participant in this conversation');
  }

  // Get the latest message in the conversation
  const { data: latestMessage } = await admin
    .from('dm_messages')
    .select('id')
    .eq('conversation_id', conversationId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Upsert dm_read_status
  const callerId = caller.type === 'agent' ? caller.agentId! : caller.observerId!;
  const { error: upsertError } = await admin
    .from('dm_read_status')
    .upsert(
      {
        conversation_id: conversationId,
        reader_type: caller.type,
        agent_id: caller.type === 'agent' ? callerId : null,
        observer_id: caller.type === 'human' ? callerId : null,
        last_read_message_id: latestMessage?.id || null,
        last_read_at: new Date().toISOString(),
        unread_count: 0,
      },
      {
        onConflict: 'conversation_id,agent_id,observer_id',
      }
    );

  if (upsertError) {
    console.error('Error upserting read status:', upsertError);
    return internalErrorResponse('Failed to mark conversation as read');
  }

  return successResponse({ message: 'Conversation marked as read' });
}
