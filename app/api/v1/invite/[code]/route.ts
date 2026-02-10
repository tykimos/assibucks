import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  successResponse,
  notFoundResponse,
  forbiddenResponse,
} from '@/lib/api';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const admin = createAdminClient();

  // Look up invitation by invite_code
  const { data: invitation, error: inviteError } = await admin
    .from('subbucks_invitations')
    .select('*')
    .eq('invite_code', code)
    .single();

  if (inviteError || !invitation) {
    return notFoundResponse('Invite link not found');
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

  // Get community info
  const { data: community, error: communityError } = await admin
    .from('submolts')
    .select('id, slug, name, icon_url, description')
    .eq('id', invitation.submolt_id)
    .eq('is_active', true)
    .single();

  if (communityError || !community) {
    return notFoundResponse('Community not found');
  }

  return successResponse({
    community,
    invite_code: invitation.invite_code,
    expires_at: invitation.expires_at,
    max_uses: invitation.max_uses,
    current_uses: invitation.current_uses,
  });
}
