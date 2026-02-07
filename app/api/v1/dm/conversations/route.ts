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
import { createConversationSchema, paginationSchema } from '@/lib/api/validation';
import type { CallerIdentity } from '@/lib/auth/permissions';
import { isBlocked } from '@/lib/dm/blocks';

// POST /api/v1/dm/conversations - Create or return existing conversation
export async function POST(request: NextRequest) {
  try {
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

    // Parse and validate body
    const body = await request.json();
    const parsed = createConversationSchema.safeParse(body);
    if (!parsed.success) {
      return validationErrorResponse(parsed.error.issues[0].message);
    }

    const { recipient_type, recipient_name, recipient_id } = parsed.data;

    // Must provide either recipient_name or recipient_id
    if (!recipient_name && !recipient_id) {
      return validationErrorResponse('Either recipient_name or recipient_id is required');
    }

    const supabase = createAdminClient();

    // Resolve recipient
    let resolvedRecipientId: string | null = null;

    if (recipient_id) {
      // Verify recipient exists by ID
      if (recipient_type === 'agent') {
        const { data: agent } = await supabase
          .from('agents')
          .select('id')
          .eq('id', recipient_id)
          .eq('is_active', true)
          .single();
        if (!agent) {
          return notFoundResponse('Agent not found');
        }
        resolvedRecipientId = agent.id;
      } else {
        // recipient_type === 'human'
        const { data: observer } = await supabase
          .from('observers')
          .select('id')
          .eq('id', recipient_id)
          .single();
        if (!observer) {
          return notFoundResponse('User not found');
        }
        resolvedRecipientId = observer.id;
      }
    } else if (recipient_name) {
      // Resolve by name
      if (recipient_type === 'agent') {
        const { data: agent } = await supabase
          .from('agents')
          .select('id')
          .eq('name', recipient_name)
          .eq('is_active', true)
          .single();
        if (!agent) {
          return notFoundResponse(`Agent "${recipient_name}" not found`);
        }
        resolvedRecipientId = agent.id;
      } else {
        // recipient_type === 'human'
        const { data: observer } = await supabase
          .from('observers')
          .select('id')
          .eq('display_name', recipient_name)
          .single();
        if (!observer) {
          return notFoundResponse(`User "${recipient_name}" not found`);
        }
        resolvedRecipientId = observer.id;
      }
    }

    if (!resolvedRecipientId) {
      return internalErrorResponse('Failed to resolve recipient');
    }

    // Check if trying to DM yourself
    if (
      (caller.type === 'agent' && recipient_type === 'agent' && caller.agentId === resolvedRecipientId) ||
      (caller.type === 'human' && recipient_type === 'human' && caller.observerId === resolvedRecipientId)
    ) {
      return validationErrorResponse('Cannot create conversation with yourself');
    }

    // Check block status
    const callerId = caller.type === 'agent' ? caller.agentId! : caller.observerId!;
    const blocked = await isBlocked(callerId, caller.type, resolvedRecipientId, recipient_type);
    if (blocked) {
      return forbiddenResponse('Cannot create conversation due to block status');
    }

    // Check for existing conversation (both orderings)
    const callerAgentId = caller.type === 'agent' ? caller.agentId! : null;
    const callerObserverId = caller.type === 'human' ? caller.observerId! : null;
    const recipientAgentId = recipient_type === 'agent' ? resolvedRecipientId : null;
    const recipientObserverId = recipient_type === 'human' ? resolvedRecipientId : null;

    // Query 1: caller=p1, recipient=p2
    let q1 = supabase.from('dm_conversations').select('*');
    if (caller.type === 'agent') {
      q1 = q1.eq('participant1_agent_id', caller.agentId!).is('participant1_observer_id', null);
    } else {
      q1 = q1.eq('participant1_observer_id', caller.observerId!).is('participant1_agent_id', null);
    }
    if (recipient_type === 'agent') {
      q1 = q1.eq('participant2_agent_id', resolvedRecipientId).is('participant2_observer_id', null);
    } else {
      q1 = q1.eq('participant2_observer_id', resolvedRecipientId).is('participant2_agent_id', null);
    }
    const { data: conv1 } = await q1.maybeSingle();

    if (conv1) {
      // Fetch participant details
      const conversation = await enrichConversationForCaller(supabase, conv1, caller);
      return successResponse({ conversation });
    }

    // Query 2: caller=p2, recipient=p1
    let q2 = supabase.from('dm_conversations').select('*');
    if (recipient_type === 'agent') {
      q2 = q2.eq('participant1_agent_id', resolvedRecipientId).is('participant1_observer_id', null);
    } else {
      q2 = q2.eq('participant1_observer_id', resolvedRecipientId).is('participant1_agent_id', null);
    }
    if (caller.type === 'agent') {
      q2 = q2.eq('participant2_agent_id', caller.agentId!).is('participant2_observer_id', null);
    } else {
      q2 = q2.eq('participant2_observer_id', caller.observerId!).is('participant2_agent_id', null);
    }
    const { data: conv2 } = await q2.maybeSingle();

    if (conv2) {
      // Fetch participant details
      const conversation = await enrichConversationForCaller(supabase, conv2, caller);
      return successResponse({ conversation });
    }

    // No existing conversation, create new one
    // Normalized ordering: compare IDs, put smaller UUID as participant1
    const callerIdForComparison = caller.type === 'agent' ? caller.agentId! : caller.observerId!;
    const recipientIdForComparison = resolvedRecipientId;

    let p1AgentId: string | null = null;
    let p1ObserverId: string | null = null;
    let p1Type: 'agent' | 'human';
    let p2AgentId: string | null = null;
    let p2ObserverId: string | null = null;
    let p2Type: 'agent' | 'human';

    if (callerIdForComparison < recipientIdForComparison) {
      // Caller is participant1
      p1AgentId = callerAgentId;
      p1ObserverId = callerObserverId;
      p1Type = caller.type;
      p2AgentId = recipientAgentId;
      p2ObserverId = recipientObserverId;
      p2Type = recipient_type;
    } else {
      // Recipient is participant1
      p1AgentId = recipientAgentId;
      p1ObserverId = recipientObserverId;
      p1Type = recipient_type;
      p2AgentId = callerAgentId;
      p2ObserverId = callerObserverId;
      p2Type = caller.type;
    }

    // Create conversation
    const { data: newConv, error: createError } = await supabase
      .from('dm_conversations')
      .insert({
        participant1_agent_id: p1AgentId,
        participant1_observer_id: p1ObserverId,
        participant1_type: p1Type,
        participant2_agent_id: p2AgentId,
        participant2_observer_id: p2ObserverId,
        participant2_type: p2Type,
        is_accepted: false,
      })
      .select()
      .single();

    if (createError || !newConv) {
      console.error('Error creating conversation:', createError);
      return internalErrorResponse('Failed to create conversation');
    }

    // Create dm_read_status entries for both participants
    const readStatusEntries = [
      {
        conversation_id: newConv.id,
        agent_id: p1AgentId,
        observer_id: p1ObserverId,
        reader_type: p1Type,
        unread_count: 0,
      },
      {
        conversation_id: newConv.id,
        agent_id: p2AgentId,
        observer_id: p2ObserverId,
        reader_type: p2Type,
        unread_count: 0,
      },
    ];

    const { error: readStatusError } = await supabase
      .from('dm_read_status')
      .insert(readStatusEntries);

    if (readStatusError) {
      console.error('Error creating read status entries:', readStatusError);
      // Not critical, continue
    }

    // Enrich with participant profiles
    const conversation = await enrichConversationForCaller(supabase, newConv, caller);

    return createdResponse({ conversation });
  } catch (error) {
    console.error('Error in POST /api/v1/dm/conversations:', error);
    return internalErrorResponse();
  }
}

// GET /api/v1/dm/conversations - List conversations for caller
export async function GET(request: NextRequest) {
  try {
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

    // Parse pagination params
    const { searchParams } = new URL(request.url);
    const paginationParams = {
      page: searchParams.get('page'),
      limit: searchParams.get('limit'),
    };

    const parsedPagination = paginationSchema.safeParse(paginationParams);
    if (!parsedPagination.success) {
      return validationErrorResponse(parsedPagination.error.issues[0].message);
    }

    const { page, limit } = parsedPagination.data;
    const offset = (page - 1) * limit;

    const supabase = createAdminClient();

    // Build query for conversations where caller is a participant
    let query = supabase.from('dm_conversations').select('*', { count: 'exact' });

    if (caller.type === 'agent') {
      query = query.or(`participant1_agent_id.eq.${caller.agentId},participant2_agent_id.eq.${caller.agentId}`);
    } else {
      query = query.or(`participant1_observer_id.eq.${caller.observerId},participant2_observer_id.eq.${caller.observerId}`);
    }

    const { data: conversations, error: convError, count } = await query
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .range(offset, offset + limit - 1);

    if (convError) {
      console.error('Error fetching conversations:', convError);
      return internalErrorResponse('Failed to fetch conversations');
    }

    // Enrich each conversation with participant profiles and unread count
    const enrichedConversations = await Promise.all(
      (conversations || []).map(async (conv: any) => {
        const enriched = await enrichConversationForCaller(supabase, conv, caller);

        // Get unread count for caller
        let readStatusQuery = supabase
          .from('dm_read_status')
          .select('unread_count')
          .eq('conversation_id', conv.id);

        if (caller.type === 'agent') {
          readStatusQuery = readStatusQuery.eq('agent_id', caller.agentId!);
        } else {
          readStatusQuery = readStatusQuery.eq('observer_id', caller.observerId!);
        }

        const { data: readStatus } = await readStatusQuery.single();

        return {
          ...enriched,
          unread_count: readStatus?.unread_count || 0,
        };
      })
    );

    return successResponse(
      {
        conversations: enrichedConversations,
      },
      {
        page,
        limit,
        total: count || 0,
      }
    );
  } catch (error) {
    console.error('Error in GET /api/v1/dm/conversations:', error);
    return internalErrorResponse();
  }
}

// Helper function to enrich conversation for caller (returns other_participant instead of participants array)
async function enrichConversationForCaller(supabase: any, conversation: any, caller: CallerIdentity) {
  // Determine which participant is "other"
  let otherType: string;
  let otherAgentId: string | null = null;
  let otherObserverId: string | null = null;

  if (caller.type === 'agent') {
    if (conversation.participant1_agent_id === caller.agentId) {
      otherType = conversation.participant2_type;
      otherAgentId = conversation.participant2_agent_id;
      otherObserverId = conversation.participant2_observer_id;
    } else {
      otherType = conversation.participant1_type;
      otherAgentId = conversation.participant1_agent_id;
      otherObserverId = conversation.participant1_observer_id;
    }
  } else {
    if (conversation.participant1_observer_id === caller.observerId) {
      otherType = conversation.participant2_type;
      otherAgentId = conversation.participant2_agent_id;
      otherObserverId = conversation.participant2_observer_id;
    } else {
      otherType = conversation.participant1_type;
      otherAgentId = conversation.participant1_agent_id;
      otherObserverId = conversation.participant1_observer_id;
    }
  }

  let other_participant: any = { type: otherType };

  if (otherType === 'agent' && otherAgentId) {
    const { data: agent } = await supabase
      .from('agents')
      .select('id, name, display_name, avatar_url')
      .eq('id', otherAgentId)
      .single();
    if (agent) {
      other_participant = { type: 'agent', id: agent.id, name: agent.name, display_name: agent.display_name, avatar_url: agent.avatar_url };
    }
  } else if (otherObserverId) {
    const { data: observer } = await supabase
      .from('observers')
      .select('id, display_name, avatar_url')
      .eq('id', otherObserverId)
      .single();
    if (observer) {
      other_participant = { type: 'human', id: observer.id, display_name: observer.display_name, avatar_url: observer.avatar_url };
    }
  }

  return {
    id: conversation.id,
    other_participant,
    last_message: conversation.last_message_at ? {
      content: conversation.last_message_preview || '',
      created_at: conversation.last_message_at,
    } : undefined,
    status: conversation.is_accepted ? 'accepted' : 'pending',
    created_at: conversation.created_at,
  };
}
