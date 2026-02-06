import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import {
  authenticateApiKey,
  extractApiKeyFromHeader,
} from '@/lib/auth';
import {
  successResponse,
  unauthorizedResponse,
  validationErrorResponse,
  notFoundResponse,
  forbiddenResponse,
  internalErrorResponse,
} from '@/lib/api';
import { updateMemberRoleSchema } from '@/lib/api/validation';
import { checkOwnerPermission, checkModeratorPermission, type SubmoltRole } from '@/lib/auth/permissions';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; memberId: string }> }
) {
  const { slug, memberId } = await params;

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

  // Parse body
  let body;
  try {
    body = await request.json();
  } catch {
    return validationErrorResponse('Invalid JSON body');
  }

  const parsed = updateMemberRoleSchema.safeParse(body);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error.issues[0].message);
  }

  const { role } = parsed.data;
  const admin = createAdminClient();

  // Find subbucks
  const { data: subbucks, error: subbucksError } = await admin
    .from('submolts')
    .select('id')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (subbucksError || !subbucks) {
    return notFoundResponse(`Subbucks "b/${slug}" not found`);
  }

  // Check owner permission
  const { allowed } = await checkOwnerPermission(agentId, subbucks.id, observerId);
  if (!allowed) {
    return forbiddenResponse('Only the owner can change member roles');
  }

  // Get the member to update
  const { data: member, error: memberError } = await admin
    .from('submolt_members')
    .select('id, role, agent_id, observer_id')
    .eq('id', memberId)
    .eq('submolt_id', subbucks.id)
    .single();

  if (memberError || !member) {
    return notFoundResponse('Member not found');
  }

  // Cannot change owner's role
  if (member.role === 'owner') {
    return forbiddenResponse('Cannot change the owner\'s role');
  }

  // Update role
  const { data: updatedMember, error: updateError } = await admin
    .from('submolt_members')
    .update({ role })
    .eq('id', memberId)
    .select(
      `
      id,
      role,
      joined_at,
      agent:agents(id, name, display_name, avatar_url, post_karma, comment_karma, is_active, created_at),
      observer:observers(id, display_name, avatar_url, created_at)
    `
    )
    .single();

  if (updateError) {
    console.error('Error updating member role:', updateError);
    return internalErrorResponse('Failed to update member role');
  }

  return successResponse({
    member: {
      id: updatedMember.id,
      member_type: updatedMember.agent ? 'agent' : 'human',
      role: updatedMember.role,
      joined_at: updatedMember.joined_at,
      profile: updatedMember.agent || updatedMember.observer,
    },
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; memberId: string }> }
) {
  const { slug, memberId } = await params;

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

  // Find subbucks
  const { data: subbucks, error: subbucksError } = await admin
    .from('submolts')
    .select('id')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (subbucksError || !subbucks) {
    return notFoundResponse(`Subbucks "b/${slug}" not found`);
  }

  // Check moderator permission
  const { allowed, role: callerRole } = await checkModeratorPermission(
    agentId,
    subbucks.id,
    observerId
  );
  if (!allowed) {
    return forbiddenResponse('You must be a moderator or owner to remove members');
  }

  // Get the member to remove
  const { data: member, error: memberError } = await admin
    .from('submolt_members')
    .select('id, role, agent_id, observer_id')
    .eq('id', memberId)
    .eq('submolt_id', subbucks.id)
    .single();

  if (memberError || !member) {
    return notFoundResponse('Member not found');
  }

  // Cannot kick owner
  if (member.role === 'owner') {
    return forbiddenResponse('Cannot remove the owner');
  }

  // Role hierarchy check: moderator cannot kick another moderator
  const targetRole = member.role as SubmoltRole;
  if (callerRole === 'moderator' && targetRole === 'moderator') {
    return forbiddenResponse('Moderators cannot remove other moderators');
  }

  // Delete member
  const { error: deleteError } = await admin
    .from('submolt_members')
    .delete()
    .eq('id', memberId);

  if (deleteError) {
    console.error('Error removing member:', deleteError);
    return internalErrorResponse('Failed to remove member');
  }

  return successResponse({ message: 'Member removed successfully' });
}
