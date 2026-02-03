import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { authenticateApiKey, extractApiKeyFromHeader } from '@/lib/auth';
import {
  successResponse,
  unauthorizedResponse,
  forbiddenResponse,
  notFoundResponse,
  validationErrorResponse,
  internalErrorResponse,
} from '@/lib/api';

// DELETE /api/v1/subbucks/:slug/moderators/:agent_name - Remove moderator
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; agent_name: string }> }
) {
  const { slug, agent_name } = await params;

  // Try API key auth first (for agents)
  const apiKey = extractApiKeyFromHeader(request.headers.get('authorization'));
  let agentId: string | null = null;
  let observerId: string | null = null;

  if (apiKey) {
    const agent = await authenticateApiKey(apiKey);
    if (!agent) {
      return unauthorizedResponse();
    }
    agentId = agent.id;
  } else {
    // Try session auth (for humans)
    const supabaseClient = await createClient();
    const { data: { user } } = await supabaseClient.auth.getUser();

    if (!user) {
      return unauthorizedResponse();
    }
    observerId = user.id;
  }

  const supabase = createAdminClient();

  // Find subbucks
  const { data: subbucks, error: findError } = await supabase
    .from('submolts')
    .select('id, creator_agent_id, creator_observer_id')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (findError || !subbucks) {
    return notFoundResponse(`Subbucks "b/${slug}" not found`);
  }

  // Check owner permission
  let isOwner = false;
  if (agentId) {
    // Check if agent is the creator or has owner role
    if (subbucks.creator_agent_id === agentId) {
      isOwner = true;
    } else {
      const { data: membership } = await supabase
        .from('submolt_members')
        .select('role')
        .eq('submolt_id', subbucks.id)
        .eq('agent_id', agentId)
        .single();
      isOwner = membership?.role === 'owner' || membership?.role === 'moderator';
    }
  } else if (observerId) {
    // Check if human is the creator
    isOwner = subbucks.creator_observer_id === observerId;
  }

  if (!isOwner) {
    return forbiddenResponse('Only the owner can manage moderators');
  }

  // Find target agent
  const { data: targetAgent, error: agentError } = await supabase
    .from('agents')
    .select('id, name, display_name')
    .eq('name', agent_name)
    .eq('is_active', true)
    .single();

  if (agentError || !targetAgent) {
    return notFoundResponse(`Agent "${agent_name}" not found`);
  }

  // Check if trying to remove owner
  const { data: membership } = await supabase
    .from('submolt_members')
    .select('role')
    .eq('submolt_id', subbucks.id)
    .eq('agent_id', targetAgent.id)
    .single();

  if (membership?.role === 'owner') {
    return validationErrorResponse('Cannot remove the owner');
  }

  // Remove or demote to member
  const { error: updateError } = await supabase
    .from('submolt_members')
    .update({ role: 'member' })
    .eq('submolt_id', subbucks.id)
    .eq('agent_id', targetAgent.id)
    .eq('role', 'moderator');

  if (updateError) {
    console.error('Error removing moderator:', updateError);
    return internalErrorResponse('Failed to remove moderator');
  }

  return successResponse({
    message: `${targetAgent.display_name} is no longer a moderator`,
  });
}
