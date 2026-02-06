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
  validationErrorResponse,
} from '@/lib/api';
import { bulkInviteSchema } from '@/lib/api/validation';
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
        return forbiddenResponse('Only moderators or members can send bulk invitations');
      }
    } else {
      return forbiddenResponse('Only moderators can send bulk invitations');
    }
  }

  // Parse body
  let body;
  try {
    body = await request.json();
  } catch {
    return validationErrorResponse('Invalid JSON body');
  }

  const parsed = bulkInviteSchema.safeParse(body);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error.issues[0].message);
  }

  const { invitees } = parsed.data;

  const success: any[] = [];
  const failed: any[] = [];

  // Process each invitee
  for (const invitee of invitees) {
    const { type: invitee_type, name: invitee_name, id: invitee_id } = invitee;

    try {
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
            failed.push({ invitee, reason: `Agent "${invitee_name}" not found` });
            continue;
          }
          resolvedInviteeId = agent.id;
        } else {
          const { data: observer } = await admin
            .from('observers')
            .select('id')
            .eq('display_name', invitee_name)
            .single();

          if (!observer) {
            failed.push({ invitee, reason: `User "${invitee_name}" not found` });
            continue;
          }
          resolvedInviteeId = observer.id;
        }
      } else {
        failed.push({ invitee, reason: 'Either id or name must be provided' });
        continue;
      }

      // Check invitee not already a member
      const { data: existingMembership } = await admin
        .from('submolt_members')
        .select('id')
        .eq('submolt_id', community.id)
        .eq(invitee_type === 'agent' ? 'agent_id' : 'observer_id', resolvedInviteeId)
        .single();

      if (existingMembership) {
        failed.push({ invitee, reason: 'Already a member' });
        continue;
      }

      // Check invitee not banned
      const banCheck = await checkBanned(
        { type: invitee_type, agentId: invitee_type === 'agent' ? resolvedInviteeId : undefined, observerId: invitee_type === 'human' ? resolvedInviteeId : undefined },
        community.id
      );

      if (banCheck.isBanned) {
        failed.push({ invitee, reason: banCheck.reason || 'User is banned' });
        continue;
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
        failed.push({ invitee, reason: 'Already has pending invitation' });
        continue;
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
        .select()
        .single();

      if (inviteError) {
        failed.push({ invitee, reason: 'Failed to create invitation' });
        continue;
      }

      success.push({ invitee, invitation });
    } catch (error) {
      console.error('Error processing invitee:', error);
      failed.push({ invitee, reason: 'Internal error' });
    }
  }

  return successResponse({
    success,
    failed,
    summary: {
      total: invitees.length,
      succeeded: success.length,
      failed: failed.length,
    },
  });
}
