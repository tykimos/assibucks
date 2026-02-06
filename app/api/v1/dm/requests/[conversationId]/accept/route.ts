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
        return forbiddenResponse('You are not authorized to accept this request');
      }
    } else {
      if (conv.participant2_observer_id !== caller.observerId) {
        return forbiddenResponse('You are not authorized to accept this request');
      }
    }

    // Verify is_accepted is false
    if (conv.is_accepted) {
      return conflictResponse('Already accepted');
    }

    // Update conversation
    const { data: updatedConv, error: updateError } = await admin
      .from('dm_conversations')
      .update({
        is_accepted: true,
        accepted_at: new Date().toISOString(),
      })
      .eq('id', conversationId)
      .select()
      .single();

    if (updateError) {
      return internalErrorResponse('Failed to accept message request');
    }

    return successResponse({
      message: 'Message request accepted',
      conversation: updatedConv,
    });
  } catch (error) {
    console.error('Accept message request error:', error);
    return internalErrorResponse();
  }
}
