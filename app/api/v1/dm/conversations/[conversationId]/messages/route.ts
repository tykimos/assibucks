import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { authenticateApiKey, extractApiKeyFromHeader } from '@/lib/auth';
import {
  successResponse,
  createdResponse,
  unauthorizedResponse,
  forbiddenResponse,
  notFoundResponse,
  validationErrorResponse,
  internalErrorResponse,
} from '@/lib/api';
import { sendMessageSchema, cursorPaginationSchema } from '@/lib/api/validation';
import type { CallerIdentity } from '@/lib/auth/permissions';
import { isBlocked } from '@/lib/dm/blocks';

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

  // Parse request body
  const body = await request.json();
  const parsed = sendMessageSchema.safeParse(body);

  if (!parsed.success) {
    return validationErrorResponse(parsed.error.issues[0].message);
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

  // Get other participant details
  let otherType: 'agent' | 'human';
  let otherId: string;
  if (caller.type === 'agent' && conv.participant1_agent_id === caller.agentId) {
    otherType = conv.participant2_type;
    otherId = conv.participant2_agent_id || conv.participant2_observer_id;
  } else if (caller.type === 'agent' && conv.participant2_agent_id === caller.agentId) {
    otherType = conv.participant1_type;
    otherId = conv.participant1_agent_id || conv.participant1_observer_id;
  } else if (caller.type === 'human' && conv.participant1_observer_id === caller.observerId) {
    otherType = conv.participant2_type;
    otherId = conv.participant2_agent_id || conv.participant2_observer_id;
  } else {
    otherType = conv.participant1_type;
    otherId = conv.participant1_agent_id || conv.participant1_observer_id;
  }

  // Check if blocked
  const callerId = caller.type === 'agent' ? caller.agentId! : caller.observerId!;
  const blocked = await isBlocked(callerId, caller.type, otherId, otherType);
  if (blocked) {
    return forbiddenResponse('You cannot send messages to this user');
  }

  // Insert message
  const { data: message, error: messageError } = await admin
    .from('dm_messages')
    .insert({
      conversation_id: conversationId,
      sender_type: caller.type,
      sender_agent_id: caller.type === 'agent' ? caller.agentId : null,
      sender_observer_id: caller.type === 'human' ? caller.observerId : null,
      content: parsed.data.content,
    })
    .select()
    .single();

  if (messageError) {
    console.error('Error creating message:', messageError);
    return internalErrorResponse('Failed to send message');
  }

  // Note: Database trigger 'trigger_update_dm_conversation_last_message' automatically:
  // 1. Updates dm_conversations (last_message_at, last_message_preview)
  // 2. Updates dm_read_status (increments unread_count for other participant)
  // So we don't need to manually update these here.

  // Enrich message with sender_name for response
  let senderName = 'Unknown';
  if (caller.type === 'agent') {
    const { data: agent } = await admin.from('agents').select('name').eq('id', caller.agentId!).single();
    if (agent) senderName = agent.name;
  } else {
    const { data: observer } = await admin.from('observers').select('display_name').eq('id', caller.observerId!).single();
    if (observer) senderName = observer.display_name;
  }

  const enrichedMessage = {
    id: message.id,
    conversation_id: message.conversation_id,
    sender_type: message.sender_type,
    sender_name: senderName,
    sender_id: message.sender_agent_id || message.sender_observer_id,
    content: message.content,
    is_edited: message.is_edited,
    created_at: message.created_at,
  };

  return createdResponse({ message: enrichedMessage });
}

export async function GET(
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

  // Parse query params
  const { searchParams } = new URL(request.url);
  const beforeParam = searchParams.get('before');
  const limitParam = searchParams.get('limit');

  const parsed = cursorPaginationSchema.safeParse({
    before: beforeParam || undefined,
    limit: limitParam ? parseInt(limitParam, 10) : 50,
  });

  if (!parsed.success) {
    return validationErrorResponse(parsed.error.issues[0].message);
  }

  const { before, limit } = parsed.data;

  // Build query
  let query = admin
    .from('dm_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false });

  // Apply cursor-based pagination
  if (before) {
    // Get the created_at of the before message
    const { data: beforeMessage } = await admin
      .from('dm_messages')
      .select('created_at')
      .eq('id', before)
      .single();

    if (beforeMessage) {
      query = query.lt('created_at', beforeMessage.created_at);
    }
  }

  // Fetch limit + 1 to determine has_more
  query = query.limit(limit + 1);

  const { data: messages, error: messagesError } = await query;

  if (messagesError) {
    console.error('Error fetching messages:', messagesError);
    return internalErrorResponse('Failed to fetch messages');
  }

  const hasMore = messages.length > limit;
  const resultMessages = hasMore ? messages.slice(0, limit) : messages;

  // Enrich messages with sender_name
  const agentIds = Array.from(new Set(resultMessages.filter((m: any) => m.sender_type === 'agent' && m.sender_agent_id).map((m: any) => m.sender_agent_id)));
  const observerIds = Array.from(new Set(resultMessages.filter((m: any) => m.sender_type === 'human' && m.sender_observer_id).map((m: any) => m.sender_observer_id)));

  const nameMap: Record<string, string> = {};

  if (agentIds.length > 0) {
    const { data: agents } = await admin.from('agents').select('id, name').in('id', agentIds);
    (agents || []).forEach((a: any) => { nameMap[a.id] = a.name; });
  }

  if (observerIds.length > 0) {
    const { data: observers } = await admin.from('observers').select('id, display_name').in('id', observerIds);
    (observers || []).forEach((o: any) => { nameMap[o.id] = o.display_name; });
  }

  const enrichedMessages = resultMessages.map((msg: any) => ({
    id: msg.id,
    conversation_id: msg.conversation_id,
    sender_type: msg.sender_type,
    sender_name: nameMap[msg.sender_agent_id || msg.sender_observer_id] || 'Unknown',
    sender_id: msg.sender_agent_id || msg.sender_observer_id,
    content: msg.content,
    is_edited: msg.is_edited,
    created_at: msg.created_at,
  }));

  return successResponse(
    { messages: enrichedMessages },
    { has_more: hasMore }
  );
}
