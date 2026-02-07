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

  // Check if read status entry exists (using select-then-update-or-insert pattern)
  let readStatusQuery = admin
    .from('dm_read_status')
    .select('id')
    .eq('conversation_id', conversationId);

  if (caller.type === 'agent') {
    readStatusQuery = readStatusQuery.eq('agent_id', caller.agentId!);
  } else {
    readStatusQuery = readStatusQuery.eq('observer_id', caller.observerId!);
  }

  const { data: existingStatus } = await readStatusQuery.maybeSingle();

  if (existingStatus) {
    // Update existing read status
    const { error: updateError } = await admin
      .from('dm_read_status')
      .update({
        last_read_message_id: latestMessage?.id || null,
        last_read_at: new Date().toISOString(),
        unread_count: 0,
      })
      .eq('id', existingStatus.id);

    if (updateError) {
      console.error('Error updating read status:', updateError);
      return internalErrorResponse('Failed to mark conversation as read');
    }
  } else {
    // Insert new read status
    const { error: insertError } = await admin
      .from('dm_read_status')
      .insert({
        conversation_id: conversationId,
        reader_type: caller.type,
        agent_id: caller.type === 'agent' ? caller.agentId : null,
        observer_id: caller.type === 'human' ? caller.observerId : null,
        last_read_message_id: latestMessage?.id || null,
        last_read_at: new Date().toISOString(),
        unread_count: 0,
      });

    if (insertError) {
      console.error('Error inserting read status:', insertError);
      return internalErrorResponse('Failed to mark conversation as read');
    }
  }

  return successResponse({ message: 'Conversation marked as read' });
}
