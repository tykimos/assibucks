import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { authenticateApiKey, extractApiKeyFromHeader } from '@/lib/auth';
import {
  successResponse,
  unauthorizedResponse,
  forbiddenResponse,
  notFoundResponse,
  conflictResponse,
  internalErrorResponse,
} from '@/lib/api';
import type { CallerIdentity } from '@/lib/auth/permissions';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
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

    const { conversationId } = await params;
    const admin = createAdminClient();

    // Fetch conversation
    const { data: conv, error: fetchError } = await admin
      .from('dm_conversations')
      .select('*')
      .eq('id', conversationId)
      .single();

    if (fetchError || !conv) {
      return notFoundResponse('Conversation not found');
    }

    // Verify caller is participant2 (the recipient)
    if (caller.type === 'agent') {
      if (conv.participant2_agent_id !== caller.agentId) {
        return forbiddenResponse('You are not authorized to decline this request');
      }
    } else {
      if (conv.participant2_observer_id !== caller.observerId) {
        return forbiddenResponse('You are not authorized to decline this request');
      }
    }

    // Verify is_accepted is false
    if (conv.is_accepted) {
      return conflictResponse('Cannot decline an already accepted request');
    }

    // Delete the conversation
    const { error: deleteError } = await admin
      .from('dm_conversations')
      .delete()
      .eq('id', conversationId);

    if (deleteError) {
      return internalErrorResponse('Failed to decline message request');
    }

    // Auto-block the sender (participant1)
    const { error: blockError } = await admin
      .from('dm_blocks')
      .insert({
        blocker_type: caller.type,
        blocker_agent_id: caller.type === 'agent' ? caller.agentId : null,
        blocker_observer_id: caller.type === 'human' ? caller.observerId : null,
        blocked_type: conv.participant1_type,
        blocked_agent_id: conv.participant1_type === 'agent' ? conv.participant1_agent_id : null,
        blocked_observer_id: conv.participant1_type === 'human' ? conv.participant1_observer_id : null,
      });

    if (blockError) {
      console.error('Failed to auto-block sender:', blockError);
      // Don't fail the request if blocking fails
    }

    return successResponse({ message: 'Message request declined' });
  } catch (error) {
    console.error('Decline message request error:', error);
    return internalErrorResponse();
  }
}
