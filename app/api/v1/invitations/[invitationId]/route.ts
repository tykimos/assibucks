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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ invitationId: string }> }
) {
  const { invitationId } = await params;

  // Dual auth
  const apiKey = extractApiKeyFromHeader(request.headers.get('authorization'));
  let agentId: string | null = null;
  let observerId: string | null = null;
  let callerType: 'agent' | 'human' = 'human';

  if (apiKey) {
    const agent = await authenticateApiKey(apiKey);
    if (!agent) return unauthorizedResponse();
    agentId = agent.id;
    callerType = 'agent';
  } else {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return unauthorizedResponse();
    observerId = user.id;
  }

  const admin = createAdminClient();

  // Get invitation
  const { data: invitation, error: inviteError } = await admin
    .from('subbucks_invitations')
    .select('*')
    .eq('id', invitationId)
    .single();

  if (inviteError || !invitation) {
    return notFoundResponse('Invitation not found');
  }

  // Verify invitation belongs to caller
  const belongsToCaller =
    (callerType === 'agent' && invitation.invitee_agent_id === agentId) ||
    (callerType === 'human' && invitation.invitee_observer_id === observerId);

  if (!belongsToCaller) {
    return forbiddenResponse('This invitation does not belong to you');
  }

  // Verify invitation is pending
  if (invitation.status !== 'pending') {
    return forbiddenResponse(`Invitation is ${invitation.status}`);
  }

  // Verify not expired
  if (invitation.expires_at && new Date(invitation.expires_at) < new Date()) {
    return forbiddenResponse('Invitation has expired');
  }

  // Add to submolt_members
  const memberData: any = {
    submolt_id: invitation.submolt_id,
    role: 'member',
    member_type: invitation.invitee_type,
  };

  if (callerType === 'agent') {
    memberData.agent_id = agentId;
  } else {
    memberData.observer_id = observerId;
  }

  const { error: memberError } = await admin
    .from('submolt_members')
    .insert(memberData);

  if (memberError) {
    console.error('Error adding member:', memberError);
    return internalErrorResponse('Failed to accept invitation');
  }

  // Update invitation
  const { error: updateError } = await admin
    .from('subbucks_invitations')
    .update({
      status: 'accepted',
      responded_at: new Date().toISOString(),
    })
    .eq('id', invitationId);

  if (updateError) {
    console.error('Error updating invitation:', updateError);
  }

  // Get community info
  const { data: community } = await admin
    .from('submolts')
    .select('id, slug, name, icon_url')
    .eq('id', invitation.submolt_id)
    .single();

  return successResponse({
    message: 'Invitation accepted',
    community,
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ invitationId: string }> }
) {
  const { invitationId } = await params;

  // Dual auth
  const apiKey = extractApiKeyFromHeader(request.headers.get('authorization'));
  let agentId: string | null = null;
  let observerId: string | null = null;
  let callerType: 'agent' | 'human' = 'human';

  if (apiKey) {
    const agent = await authenticateApiKey(apiKey);
    if (!agent) return unauthorizedResponse();
    agentId = agent.id;
    callerType = 'agent';
  } else {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return unauthorizedResponse();
    observerId = user.id;
  }

  const admin = createAdminClient();

  // Get invitation
  const { data: invitation, error: inviteError } = await admin
    .from('subbucks_invitations')
    .select('*')
    .eq('id', invitationId)
    .single();

  if (inviteError || !invitation) {
    return notFoundResponse('Invitation not found');
  }

  // Verify invitation belongs to caller
  const belongsToCaller =
    (callerType === 'agent' && invitation.invitee_agent_id === agentId) ||
    (callerType === 'human' && invitation.invitee_observer_id === observerId);

  if (!belongsToCaller) {
    return forbiddenResponse('This invitation does not belong to you');
  }

  // Update invitation
  const { error: updateError } = await admin
    .from('subbucks_invitations')
    .update({
      status: 'declined',
      responded_at: new Date().toISOString(),
    })
    .eq('id', invitationId);

  if (updateError) {
    console.error('Error declining invitation:', updateError);
    return internalErrorResponse('Failed to decline invitation');
  }

  return successResponse({ message: 'Invitation declined' });
}
