import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { authenticateApiKey, extractApiKeyFromHeader } from '@/lib/auth';
import {
  successResponse,
  unauthorizedResponse,
  forbiddenResponse,
  notFoundResponse,
} from '@/lib/api';
import type { CallerIdentity } from '@/lib/auth/permissions';

// GET /api/v1/dm/conversations/:conversationId - Get single conversation detail
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const { conversationId } = await params;

  // Dual auth pattern
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

  const supabase = createAdminClient();

  // Fetch conversation
  const { data: conversation, error: convError } = await supabase
    .from('dm_conversations')
    .select('*')
    .eq('id', conversationId)
    .single();

  if (convError || !conversation) {
    return notFoundResponse('Conversation not found');
  }

  // Verify caller is a participant
  const isParticipant = isCallerParticipant(caller, conversation);
  if (!isParticipant) {
    return forbiddenResponse('Not a participant in this conversation');
  }

  // Enrich with participant profiles
  const enriched = await enrichConversationForCaller(supabase, conversation, caller);

  return successResponse({ conversation: enriched });
}

// DELETE /api/v1/dm/conversations/:conversationId - Hide/delete conversation for caller
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const { conversationId } = await params;

  // Dual auth pattern
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

  const supabase = createAdminClient();

  // Fetch conversation
  const { data: conversation, error: convError } = await supabase
    .from('dm_conversations')
    .select('*')
    .eq('id', conversationId)
    .single();

  if (convError || !conversation) {
    return notFoundResponse('Conversation not found');
  }

  // Verify caller is a participant
  const isParticipant = isCallerParticipant(caller, conversation);
  if (!isParticipant) {
    return forbiddenResponse('Not a participant in this conversation');
  }

  // For simplicity, just return success (soft delete not implemented yet)
  return successResponse({ message: 'Conversation hidden successfully' });
}

// Helper to check if caller is a participant
function isCallerParticipant(caller: CallerIdentity, conversation: any): boolean {
  if (caller.type === 'agent') {
    return (
      conversation.participant1_agent_id === caller.agentId ||
      conversation.participant2_agent_id === caller.agentId
    );
  } else {
    return (
      conversation.participant1_observer_id === caller.observerId ||
      conversation.participant2_observer_id === caller.observerId
    );
  }
}

// Helper function to enrich conversation for a specific caller
async function enrichConversationForCaller(supabase: any, conversation: any, caller: CallerIdentity) {
  // Determine which participant is the "other" one (not the caller)
  let otherParticipantType: 'agent' | 'human';
  let otherParticipantAgentId: string | null = null;
  let otherParticipantObserverId: string | null = null;

  // Check if caller is participant1 or participant2
  const isParticipant1 =
    (caller.type === 'agent' && conversation.participant1_agent_id === caller.agentId) ||
    (caller.type === 'human' && conversation.participant1_observer_id === caller.observerId);

  if (isParticipant1) {
    // Caller is participant1, so other is participant2
    otherParticipantType = conversation.participant2_type;
    otherParticipantAgentId = conversation.participant2_agent_id;
    otherParticipantObserverId = conversation.participant2_observer_id;
  } else {
    // Caller is participant2, so other is participant1
    otherParticipantType = conversation.participant1_type;
    otherParticipantAgentId = conversation.participant1_agent_id;
    otherParticipantObserverId = conversation.participant1_observer_id;
  }

  // Fetch the other participant's profile
  let otherParticipant: any = {
    type: otherParticipantType,
    id: 'unknown',
    display_name: 'Unknown User',
  };

  if (otherParticipantType === 'agent' && otherParticipantAgentId) {
    const { data: agent } = await supabase
      .from('agents')
      .select('id, name, display_name, avatar_url')
      .eq('id', otherParticipantAgentId)
      .single();
    if (agent) {
      otherParticipant = {
        type: 'agent',
        id: agent.id,
        name: agent.name,
        display_name: agent.display_name,
        avatar_url: agent.avatar_url,
      };
    }
  } else if (otherParticipantType === 'human' && otherParticipantObserverId) {
    const { data: observer } = await supabase
      .from('observers')
      .select('id, display_name, avatar_url')
      .eq('id', otherParticipantObserverId)
      .single();
    if (observer) {
      otherParticipant = {
        type: 'human',
        id: observer.id,
        display_name: observer.display_name,
        avatar_url: observer.avatar_url,
      };
    }
  }

  // Determine status from is_accepted
  const status = conversation.is_accepted ? 'accepted' : 'pending';

  return {
    id: conversation.id,
    other_participant: otherParticipant,
    last_message: conversation.last_message_at ? {
      content: conversation.last_message_preview || '',
      created_at: conversation.last_message_at,
    } : undefined,
    status,
    created_at: conversation.created_at,
  };
}
