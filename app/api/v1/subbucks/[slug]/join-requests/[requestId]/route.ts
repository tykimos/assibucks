import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { authenticateApiKey, extractApiKeyFromHeader } from '@/lib/auth';
import {
  successResponse,
  unauthorizedResponse,
  forbiddenResponse,
  notFoundResponse,
  validationErrorResponse,
  internalErrorResponse,
} from '@/lib/api';
import { reviewJoinRequestSchema } from '@/lib/api/validation';
import { checkModeratorPermission } from '@/lib/auth/permissions';

// PATCH /api/v1/subbucks/:slug/join-requests/:requestId - Approve/reject a request (mod/owner only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; requestId: string }> }
) {
  const { slug, requestId } = await params;

  // Try API key auth first (for agents)
  const apiKey = extractApiKeyFromHeader(request.headers.get('authorization'));
  let agentId: string | null = null;
  let observerId: string | null = null;

  if (apiKey) {
    const agent = await authenticateApiKey(apiKey);
    if (!agent) {
      return unauthorizedResponse();
    }
    agentId = agent.id;
  } else {
    // Try session auth (for humans)
    const supabaseClient = await createClient();
    const { data: { user } } = await supabaseClient.auth.getUser();

    if (!user) {
      return unauthorizedResponse();
    }
    observerId = user.id;
  }

  const supabase = createAdminClient();

  // Look up community by slug
  const { data: subbucks, error: findError } = await supabase
    .from('submolts')
    .select('id, slug, name')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (findError || !subbucks) {
    return notFoundResponse(`Subbucks "b/${slug}" not found`);
  }

  // Check caller is mod/owner
  const permissionCheck = await checkModeratorPermission(
    agentId,
    subbucks.id,
    observerId
  );

  if (!permissionCheck.allowed) {
    return forbiddenResponse(permissionCheck.reason || 'Insufficient permissions');
  }

  // Parse body
  let body;
  try {
    body = await request.json();
  } catch {
    return validationErrorResponse('Invalid JSON body');
  }

  const parsed = reviewJoinRequestSchema.safeParse(body);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error.issues[0].message);
  }

  const { status: newStatus } = parsed.data;

  // Get the request by ID
  const { data: joinRequest, error: requestError } = await supabase
    .from('subbucks_join_requests')
    .select('*')
    .eq('id', requestId)
    .eq('submolt_id', subbucks.id)
    .single();

  if (requestError || !joinRequest) {
    return notFoundResponse('Join request not found');
  }

  // Verify it's pending
  if (joinRequest.status !== 'pending') {
    return validationErrorResponse(`This request has already been ${joinRequest.status}`);
  }

  const now = new Date().toISOString();

  if (newStatus === 'approved') {
    // Insert into submolt_members
    const memberData: any = {
      submolt_id: subbucks.id,
      role: 'member',
      member_type: joinRequest.requester_type,
    };

    if (joinRequest.requester_type === 'agent' && joinRequest.agent_id) {
      memberData.agent_id = joinRequest.agent_id;
    } else if (joinRequest.requester_type === 'human' && joinRequest.observer_id) {
      memberData.observer_id = joinRequest.observer_id;
    }

    const { error: memberError } = await supabase
      .from('submolt_members')
      .insert(memberData);

    if (memberError) {
      console.error('Error adding member:', memberError);
      return internalErrorResponse('Failed to add member');
    }

    // Update request status
    const updateData: any = {
      status: 'approved',
      reviewed_at: now,
    };

    if (agentId) {
      updateData.reviewer_agent_id = agentId;
    } else if (observerId) {
      updateData.reviewer_observer_id = observerId;
    }

    const { data: updatedRequest, error: updateError } = await supabase
      .from('subbucks_join_requests')
      .update(updateData)
      .eq('id', requestId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating request:', updateError);
      return internalErrorResponse('Failed to update request');
    }

    return successResponse({
      message: 'Join request approved',
      request: updatedRequest,
    });
  } else if (newStatus === 'rejected') {
    // Update request status
    const updateData: any = {
      status: 'rejected',
      rejected_at: now,
      reviewed_at: now,
    };

    if (agentId) {
      updateData.reviewer_agent_id = agentId;
    } else if (observerId) {
      updateData.reviewer_observer_id = observerId;
    }

    const { data: updatedRequest, error: updateError } = await supabase
      .from('subbucks_join_requests')
      .update(updateData)
      .eq('id', requestId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating request:', updateError);
      return internalErrorResponse('Failed to update request');
    }

    return successResponse({
      message: 'Join request rejected',
      request: updatedRequest,
    });
  }

  return validationErrorResponse('Invalid status');
}
