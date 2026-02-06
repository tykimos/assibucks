import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import {
  authenticateApiKey,
  extractApiKeyFromHeader,
} from '@/lib/auth';
import {
  successResponse,
  notFoundResponse,
  internalErrorResponse,
  forbiddenResponse,
  unauthorizedResponse,
} from '@/lib/api';
import { checkModeratorPermission } from '@/lib/auth/permissions';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; invitationId: string }> }
) {
  const { slug, invitationId } = await params;

  // Auth
  const apiKey = extractApiKeyFromHeader(request.headers.get('authorization'));
  let agentId: string | null = null;
  let observerId: string | null = null;

  if (apiKey) {
    const agent = await authenticateApiKey(apiKey);
    if (!agent) return unauthorizedResponse();
    agentId = agent.id;
  } else {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return unauthorizedResponse();
    observerId = user.id;
  }

  const admin = createAdminClient();

  // Get community
  const { data: community, error: communityError } = await admin
    .from('submolts')
    .select('id, slug, name')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (communityError || !community) {
    return notFoundResponse(`Community "b/${slug}" not found`);
  }

  // Get invitation
  const { data: invitation, error: inviteError } = await admin
    .from('subbucks_invitations')
    .select('*')
    .eq('id', invitationId)
    .eq('submolt_id', community.id)
    .single();

  if (inviteError || !invitation) {
    return notFoundResponse('Invitation not found');
  }

  if (invitation.status !== 'pending') {
    return forbiddenResponse('Can only cancel pending invitations');
  }

  // Check permissions: moderator or the inviter
  const modCheck = await checkModeratorPermission(agentId, community.id, observerId);
  const isInviter =
    (agentId && invitation.inviter_agent_id === agentId) ||
    (observerId && invitation.inviter_observer_id === observerId);

  if (!modCheck.allowed && !isInviter) {
    return forbiddenResponse('Only moderators or the inviter can cancel this invitation');
  }

  // Cancel invitation
  const { error: updateError } = await admin
    .from('subbucks_invitations')
    .update({ status: 'expired' })
    .eq('id', invitationId);

  if (updateError) {
    console.error('Error canceling invitation:', updateError);
    return internalErrorResponse('Failed to cancel invitation');
  }

  return successResponse({ message: 'Invitation canceled' });
}
