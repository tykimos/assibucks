import { NextRequest } from 'next/server';
import { nanoid } from 'nanoid';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import {
  authenticateApiKey,
  extractApiKeyFromHeader,
} from '@/lib/auth';
import {
  successResponse,
  createdResponse,
  notFoundResponse,
  internalErrorResponse,
  forbiddenResponse,
  unauthorizedResponse,
  validationErrorResponse,
} from '@/lib/api';
import { createInviteLinkSchema } from '@/lib/api/validation';
import { checkModeratorPermission, checkMembership } from '@/lib/auth/permissions';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  // Auth
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

  // Get community
  const { data: community, error: communityError } = await admin
    .from('submolts')
    .select('id, slug, name, visibility, allow_member_invites')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (communityError || !community) {
    return notFoundResponse(`Community "b/${slug}" not found`);
  }

  // Check permissions
  const modCheck = await checkModeratorPermission(agentId, community.id, observerId);

  if (!modCheck.allowed) {
    // Check if member invites are allowed and caller is a member
    if (community.allow_member_invites) {
      const membershipCheck = await checkMembership(
        { type: callerType, agentId: agentId || undefined, observerId: observerId || undefined },
        community.id
      );

      if (!membershipCheck.isMember) {
        return forbiddenResponse('Only moderators or members can generate invite links');
      }
    } else {
      return forbiddenResponse('Only moderators can generate invite links');
    }
  }

  // Parse body
  let body;
  try {
    body = await request.json();
  } catch {
    return validationErrorResponse('Invalid JSON body');
  }

  const parsed = createInviteLinkSchema.safeParse(body);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error.issues[0].message);
  }

  const { max_uses, expires_in_days } = parsed.data;

  // Generate invite code
  const inviteCode = nanoid(8);

  // Calculate expiration
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expires_in_days);

  // Create invitation
  const invitationData: any = {
    submolt_id: community.id,
    inviter_type: callerType,
    invitee_type: 'agent', // Placeholder for link-based invitations
    invite_code: inviteCode,
    max_uses,
    expires_at: expiresAt.toISOString(),
  };

  if (callerType === 'agent') {
    invitationData.inviter_agent_id = agentId;
  } else {
    invitationData.inviter_observer_id = observerId;
  }

  const { data: invitation, error: inviteError } = await admin
    .from('subbucks_invitations')
    .insert(invitationData)
    .select(`
      *,
      submolt:submolts(id, slug, name, icon_url),
      inviter_agent:inviter_agent_id(id, name, display_name, avatar_url),
      inviter_observer:inviter_observer_id(id, display_name, avatar_url)
    `)
    .single();

  if (inviteError) {
    console.error('Error creating invite link:', inviteError);
    return internalErrorResponse('Failed to create invite link');
  }

  return createdResponse({ invitation });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

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
    return forbiddenResponse('Only moderators can view invite links');
  }

  // Fetch active invite links
  let inviteLinks: any[] = [];

  try {
    const { data, error: inviteError } = await admin
      .from('subbucks_invitations')
      .select(`
        *,
        submolt:submolts(id, slug, name, icon_url),
        inviter_agent:inviter_agent_id(id, name, display_name, avatar_url),
        inviter_observer:inviter_observer_id(id, display_name, avatar_url)
      `)
      .eq('submolt_id', community.id)
      .not('invite_code', 'is', null)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (inviteError) {
      console.error('Error fetching invite links:', inviteError);
      console.error('Error details:', JSON.stringify(inviteError, null, 2));
      // Return empty array instead of error to allow page to load
      return successResponse({ invite_links: [] });
    }

    inviteLinks = data || [];
  } catch (error: any) {
    console.error('Unexpected error fetching invite links:', error);
    // Return empty array instead of error
    return successResponse({ invite_links: [] });
  }

  // For each invite link, fetch members who joined through it
  // Note: invite_code_used column may not exist yet, so we wrap in try-catch
  const linksWithMembers = await Promise.all(inviteLinks.map(async (link) => {
    try {
      const { data: members, error: membersError } = await admin
        .from('submolt_members')
        .select(`
          id,
          member_type,
          created_at,
          agent:agent_id(name, display_name),
          observer:observer_id(display_name)
        `)
        .eq('submolt_id', community.id)
        .eq('invite_code_used', link.invite_code)
        .order('created_at', { ascending: false });

      // If column doesn't exist or query fails, just return empty joined_members
      if (membersError) {
        console.log(`[INFO] invite_code_used column not yet available for link ${link.invite_code}`);
        return { ...link, joined_members: [] };
      }

      return {
        ...link,
        joined_members: (members || []).map((m: any) => ({
          id: m.id,
          member_type: m.member_type,
          agent_name: m.agent?.name,
          observer_name: m.observer?.display_name,
          joined_at: m.created_at,
        })),
      };
    } catch (error) {
      // If query fails (e.g., column doesn't exist), return link without members
      console.log('[INFO] Skipping member fetch - invite_code_used column not available');
      return { ...link, joined_members: [] };
    }
  }));

  return successResponse({ invite_links: linksWithMembers });
}
