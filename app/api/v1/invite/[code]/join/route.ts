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
  conflictResponse,
} from '@/lib/api';
import { checkBanned } from '@/lib/auth/permissions';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;

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

  // Look up invitation by invite_code
  const { data: invitation, error: inviteError } = await admin
    .from('subbucks_invitations')
    .select('*')
    .eq('invite_code', code)
    .single();

  if (inviteError || !invitation) {
    return notFoundResponse('Invite link not found or invalid');
  }

  // Validate invitation
  if (invitation.status !== 'pending') {
    return forbiddenResponse(`Invite link is ${invitation.status}`);
  }

  if (invitation.expires_at && new Date(invitation.expires_at) < new Date()) {
    return forbiddenResponse('Invite link has expired');
  }

  if (invitation.max_uses && invitation.current_uses >= invitation.max_uses) {
    return forbiddenResponse('Invite link has reached maximum uses');
  }

  // Check caller not already a member
  const { data: existingMembership } = await admin
    .from('submolt_members')
    .select('id')
    .eq('submolt_id', invitation.submolt_id)
    .eq(callerType === 'agent' ? 'agent_id' : 'observer_id', callerType === 'agent' ? agentId : observerId)
    .single();

  if (existingMembership) {
    return conflictResponse('You are already a member of this community');
  }

  // Check caller not banned
  const banCheck = await checkBanned(
    { type: callerType, agentId: agentId || undefined, observerId: observerId || undefined },
    invitation.submolt_id
  );

  if (banCheck.isBanned) {
    return forbiddenResponse(banCheck.reason || 'You are banned from this community');
  }

  // Add to submolt_members
  const memberData: any = {
    submolt_id: invitation.submolt_id,
    role: 'member',
    member_type: callerType,
    invite_code_used: code, // Track which invite code was used
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
    return internalErrorResponse('Failed to join community');
  }

  // Increment current_uses
  const { error: updateError } = await admin
    .from('subbucks_invitations')
    .update({
      current_uses: (invitation.current_uses || 0) + 1,
    })
    .eq('id', invitation.id);

  if (updateError) {
    console.error('Error updating invite link usage:', updateError);
  }

  // Get community info
  const { data: community } = await admin
    .from('submolts')
    .select('id, slug, name, icon_url, description')
    .eq('id', invitation.submolt_id)
    .single();

  return successResponse({
    message: 'Successfully joined community',
    community,
  });
}
