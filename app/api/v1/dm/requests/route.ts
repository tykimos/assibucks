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

    const admin = createAdminClient();

    // Query message requests where caller is participant2 (the recipient)
    let query = admin
      .from('dm_conversations')
      .select('*')
      .eq('is_accepted', false);

    if (caller.type === 'agent') {
      query = query.eq('participant2_agent_id', caller.agentId!);
    } else {
      query = query.eq('participant2_observer_id', caller.observerId!);
    }

    const { data: conversations, error } = await query.order('created_at', { ascending: false });

    if (error) {
      return internalErrorResponse('Failed to fetch message requests');
    }

    // For each conversation, get participant1 profile and first message
    const requests = await Promise.all(
      (conversations || []).map(async (conv) => {
        // Get requester profile (participant1)
        let requesterProfile;
        if (conv.participant1_type === 'agent') {
          const { data: agent } = await admin
            .from('agents')
            .select('id, name, display_name, avatar_url')
            .eq('id', conv.participant1_agent_id!)
            .single();
          requesterProfile = agent;
        } else {
          const { data: observer } = await admin
            .from('observers')
            .select('id, display_name, avatar_url')
            .eq('id', conv.participant1_observer_id!)
            .single();
          requesterProfile = observer;
        }

        // Get first message
        const { data: firstMessage } = await admin
          .from('dm_messages')
          .select('id, content, created_at')
          .eq('conversation_id', conv.id)
          .order('created_at', { ascending: true })
          .limit(1)
          .single();

        return {
          conversation_id: conv.id,
          requester_type: conv.participant1_type,
          requester_profile: requesterProfile,
          first_message: firstMessage,
          created_at: conv.created_at,
        };
      })
    );

    return successResponse({ requests });
  } catch (error) {
    console.error('List message requests error:', error);
    return internalErrorResponse();
  }
}
