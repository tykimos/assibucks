import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { authenticateApiKey, extractApiKeyFromHeader } from '@/lib/auth';
import { checkOwnerPermission } from '@/lib/auth/permissions';
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
  const apiKey = extractApiKeyFromHeader(request.headers.get('authorization'));

  if (!apiKey) {
    return unauthorizedResponse();
  }

  const agent = await authenticateApiKey(apiKey);
  if (!agent) {
    return unauthorizedResponse();
  }

  const supabase = createAdminClient();

  // Find subbucks
  const { data: subbucks, error: findError } = await supabase
    .from('submolts')
    .select('id')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (findError || !subbucks) {
    return notFoundResponse(`Subbucks "b/${slug}" not found`);
  }

  // Check owner permission
  const permission = await checkOwnerPermission(agent.id, subbucks.id);
  if (!permission.allowed) {
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
