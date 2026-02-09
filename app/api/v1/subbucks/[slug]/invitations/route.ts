import { NextRequest } from 'next/server';
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
  conflictResponse,
} from '@/lib/api';
import { createInvitationSchema, paginationSchema } from '@/lib/api/validation';
import { checkModeratorPermission, checkBanned, checkMembership } from '@/lib/auth/permissions';

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
        return forbiddenResponse('Only moderators or members can send invitations');
      }
    } else {
      return forbiddenResponse('Only moderators can send invitations');
    }
  }

  // Parse body
  let body;
  try {
    body = await request.json();
  } catch {
    return validationErrorResponse('Invalid JSON body');
  }

  const parsed = createInvitationSchema.safeParse(body);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error.issues[0].message);
  }

  const { invitee_type, invitee_name, invitee_id } = parsed.data;

  // Resolve invitee
  let resolvedInviteeId: string;

  if (invitee_id) {
    resolvedInviteeId = invitee_id;
  } else if (invitee_name) {
    // Look up by name
    if (invitee_type === 'agent') {
      const { data: agent } = await admin
        .from('agents')
        .select('id')
        .eq('name', invitee_name)
        .eq('is_active', true)
        .single();

      if (!agent) {
        return notFoundResponse(`Agent "${invitee_name}" not found`);
      }
      resolvedInviteeId = agent.id;
    } else {
      // For human, we need to look up by username or email
      const { data: observer } = await admin
        .from('observers')
        .select('id')
        .eq('display_name', invitee_name)
        .single();

      if (!observer) {
        return notFoundResponse(`User "${invitee_name}" not found`);
      }
      resolvedInviteeId = observer.id;
    }
  } else {
    return validationErrorResponse('Either invitee_id or invitee_name must be provided');
  }

  // Check invitee not already a member
  const { data: existingMembership } = await admin
    .from('submolt_members')
    .select('id')
    .eq('submolt_id', community.id)
    .eq(invitee_type === 'agent' ? 'agent_id' : 'observer_id', resolvedInviteeId)
    .single();

  if (existingMembership) {
    return conflictResponse('User is already a member of this community');
  }

  // Check invitee not banned
  const banCheck = await checkBanned(
    { type: invitee_type, agentId: invitee_type === 'agent' ? resolvedInviteeId : undefined, observerId: invitee_type === 'human' ? resolvedInviteeId : undefined },
    community.id
  );

  if (banCheck.isBanned) {
    return forbiddenResponse(banCheck.reason || 'User is banned from this community');
  }

  // Check for existing pending invitation
  const { data: existingInvite } = await admin
    .from('subbucks_invitations')
    .select('id')
    .eq('submolt_id', community.id)
    .eq(invitee_type === 'agent' ? 'invitee_agent_id' : 'invitee_observer_id', resolvedInviteeId)
    .eq('status', 'pending')
    .single();

  if (existingInvite) {
    return conflictResponse('User already has a pending invitation');
  }

  // Create invitation
  const invitationData: any = {
    submolt_id: community.id,
    inviter_type: callerType,
    invitee_type,
  };

  if (callerType === 'agent') {
    invitationData.inviter_agent_id = agentId;
  } else {
    invitationData.inviter_observer_id = observerId;
  }

  if (invitee_type === 'agent') {
    invitationData.invitee_agent_id = resolvedInviteeId;
  } else {
    invitationData.invitee_observer_id = resolvedInviteeId;
  }

  const { data: invitation, error: inviteError } = await admin
    .from('subbucks_invitations')
    .insert(invitationData)
    .select(`
      *,
      submolt:submolts(id, slug, name, icon_url),
      inviter_agent:inviter_agent_id(id, name, display_name, avatar_url),
      inviter_observer:inviter_observer_id(id, display_name, avatar_url),
      invitee_agent:invitee_agent_id(id, name, display_name, avatar_url),
      invitee_observer:invitee_observer_id(id, display_name, avatar_url)
    `)
    .single();

  if (inviteError) {
    console.error('Error creating invitation:', inviteError);
    return internalErrorResponse('Failed to create invitation');
  }

  return createdResponse({ invitation });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const { searchParams } = new URL(request.url);

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
    return forbiddenResponse('Only moderators can view sent invitations');
  }

  // Parse pagination
  const parsed = paginationSchema.safeParse({
    page: searchParams.get('page'),
    limit: searchParams.get('limit'),
  });

  const { page = 1, limit = 25 } = parsed.success ? parsed.data : {};
  const offset = (page - 1) * limit;

  // Parse status filter
  const status = searchParams.get('status') || undefined;

  // Fetch invitations
  let query = admin
    .from('subbucks_invitations')
    .select(`
      *,
      submolt:submolts(id, slug, name, icon_url),
      inviter_agent:inviter_agent_id(id, name, display_name, avatar_url),
      inviter_observer:inviter_observer_id(id, display_name, avatar_url),
      invitee_agent:invitee_agent_id(id, name, display_name, avatar_url),
      invitee_observer:invitee_observer_id(id, display_name, avatar_url)
    `, { count: 'exact' })
    .eq('submolt_id', community.id)
    .is('invite_code', null) // Exclude invite links
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) {
    query = query.eq('status', status);
  }

  try {
    const { data: invitations, error: inviteError, count } = await query;

    if (inviteError) {
      console.error('Error fetching invitations:', inviteError);
      console.error('Error details:', JSON.stringify(inviteError, null, 2));
      // Return empty array to allow page to load
      return successResponse(
        { invitations: [] },
        {
          page,
          limit,
          total: 0,
          has_more: false,
        }
      );
    }

    return successResponse(
      { invitations: invitations || [] },
      {
        page,
        limit,
        total: count || 0,
        has_more: (count || 0) > offset + limit,
      }
    );
  } catch (error: any) {
    console.error('Unexpected error fetching invitations:', error);
    // Return empty array instead of error to allow page to load
    return successResponse(
      { invitations: [] },
      {
        page,
        limit,
        total: 0,
        has_more: false,
      }
    );
  }
}
