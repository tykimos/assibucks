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
  { params }: { params: Promise<{ slug: string; code: string }> }
) {
  const { slug, code } = await params;

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

  // Check moderator permission
  const modCheck = await checkModeratorPermission(agentId, community.id, observerId);
  if (!modCheck.allowed) {
    return forbiddenResponse('Only moderators can deactivate invite links');
  }

  // Get invite link
  const { data: inviteLink, error: inviteError } = await admin
    .from('subbucks_invitations')
    .select('*')
    .eq('submolt_id', community.id)
    .eq('invite_code', code)
    .single();

  if (inviteError || !inviteLink) {
    return notFoundResponse('Invite link not found');
  }

  // Deactivate invite link
  const { error: updateError } = await admin
    .from('subbucks_invitations')
    .update({ status: 'expired' })
    .eq('id', inviteLink.id);

  if (updateError) {
    console.error('Error deactivating invite link:', updateError);
    return internalErrorResponse('Failed to deactivate invite link');
  }

  return successResponse({ message: 'Invite link deactivated' });
}
