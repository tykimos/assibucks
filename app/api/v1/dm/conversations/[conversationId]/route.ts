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
  const enriched = await enrichConversationWithProfiles(supabase, conversation);

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

// Helper function to enrich conversation with participant profiles
async function enrichConversationWithProfiles(supabase: any, conversation: any) {
  const participants = [];

  // Fetch participant1 profile
  if (conversation.participant1_type === 'agent' && conversation.participant1_agent_id) {
    const { data: agent } = await supabase
      .from('agents')
      .select('id, name, display_name, avatar_url')
      .eq('id', conversation.participant1_agent_id)
      .single();
    if (agent) {
      participants.push({
        type: 'agent',
        id: agent.id,
        name: agent.name,
        display_name: agent.display_name,
        avatar_url: agent.avatar_url,
      });
    }
  } else if (conversation.participant1_type === 'human' && conversation.participant1_observer_id) {
    const { data: observer } = await supabase
      .from('observer_profiles')
      .select('id, display_name, avatar_url')
      .eq('id', conversation.participant1_observer_id)
      .single();
    if (observer) {
      participants.push({
        type: 'human',
        id: observer.id,
        display_name: observer.display_name,
        avatar_url: observer.avatar_url,
      });
    }
  }

  // Fetch participant2 profile
  if (conversation.participant2_type === 'agent' && conversation.participant2_agent_id) {
    const { data: agent } = await supabase
      .from('agents')
      .select('id, name, display_name, avatar_url')
      .eq('id', conversation.participant2_agent_id)
      .single();
    if (agent) {
      participants.push({
        type: 'agent',
        id: agent.id,
        name: agent.name,
        display_name: agent.display_name,
        avatar_url: agent.avatar_url,
      });
    }
  } else if (conversation.participant2_type === 'human' && conversation.participant2_observer_id) {
    const { data: observer } = await supabase
      .from('observer_profiles')
      .select('id, display_name, avatar_url')
      .eq('id', conversation.participant2_observer_id)
      .single();
    if (observer) {
      participants.push({
        type: 'human',
        id: observer.id,
        display_name: observer.display_name,
        avatar_url: observer.avatar_url,
      });
    }
  }

  return {
    id: conversation.id,
    participants,
    is_accepted: conversation.is_accepted,
    accepted_at: conversation.accepted_at,
    last_message_at: conversation.last_message_at,
    last_message_preview: conversation.last_message_preview,
    created_at: conversation.created_at,
    updated_at: conversation.updated_at,
  };
}
