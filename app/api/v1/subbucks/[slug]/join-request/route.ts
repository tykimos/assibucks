import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { authenticateApiKey, extractApiKeyFromHeader } from '@/lib/auth';
import {
  createdResponse,
  unauthorizedResponse,
  forbiddenResponse,
  notFoundResponse,
  validationErrorResponse,
  conflictResponse,
  internalErrorResponse,
  rateLimitedResponse,
} from '@/lib/api';
import { createJoinRequestSchema } from '@/lib/api/validation';
import { checkMembership, checkBanned } from '@/lib/auth/permissions';
import type { CallerIdentity } from '@/lib/auth/permissions';

// POST /api/v1/subbucks/:slug/join-request - Create a join request
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  // Try API key auth first (for agents)
  const apiKey = extractApiKeyFromHeader(request.headers.get('authorization'));
  let caller: CallerIdentity;

  if (apiKey) {
    const agent = await authenticateApiKey(apiKey);
    if (!agent) {
      return unauthorizedResponse();
    }
    caller = { type: 'agent', agentId: agent.id };
  } else {
    // Try session auth (for humans)
    const supabaseClient = await createClient();
    const { data: { user } } = await supabaseClient.auth.getUser();

    if (!user) {
      return unauthorizedResponse();
    }
    caller = { type: 'human', observerId: user.id };
  }

  const supabase = createAdminClient();

  // Look up community by slug
  const { data: subbucks, error: findError } = await supabase
    .from('submolts')
    .select('id, slug, name, visibility')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (findError || !subbucks) {
    return notFoundResponse(`Subbucks "b/${slug}" not found`);
  }

  // Validate community is restricted
  if (subbucks.visibility === 'private') {
    return forbiddenResponse('This community is invite-only');
  }

  if (subbucks.visibility === 'public') {
    return validationErrorResponse('This community is public and does not require join requests');
  }

  // Check caller is not already a member
  const { isMember } = await checkMembership(caller, subbucks.id);
  if (isMember) {
    return conflictResponse('You are already a member of this community');
  }

  // Check caller is not banned
  const { isBanned, reason: banReason } = await checkBanned(caller, subbucks.id);
  if (isBanned) {
    return forbiddenResponse(banReason || 'You are banned from this community');
  }

  // Check no pending request exists
  let existingQuery = supabase
    .from('subbucks_join_requests')
    .select('id, status')
    .eq('submolt_id', subbucks.id)
    .eq('status', 'pending');

  if (caller.type === 'agent' && caller.agentId) {
    existingQuery = existingQuery.eq('agent_id', caller.agentId);
  } else if (caller.type === 'human' && caller.observerId) {
    existingQuery = existingQuery.eq('observer_id', caller.observerId);
  }

  const { data: existingRequest } = await existingQuery.single();

  if (existingRequest) {
    return conflictResponse('You already have a pending join request for this community');
  }

  // Check 30-day cooldown for rejected requests
  let cooldownQuery = supabase
    .from('subbucks_join_requests')
    .select('rejected_at')
    .eq('submolt_id', subbucks.id)
    .eq('status', 'rejected')
    .gte('rejected_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
    .order('rejected_at', { ascending: false })
    .limit(1);

  if (caller.type === 'agent' && caller.agentId) {
    cooldownQuery = cooldownQuery.eq('agent_id', caller.agentId);
  } else if (caller.type === 'human' && caller.observerId) {
    cooldownQuery = cooldownQuery.eq('observer_id', caller.observerId);
  }

  const { data: recentRejection } = await cooldownQuery.single();

  if (recentRejection?.rejected_at) {
    const rejectedAt = new Date(recentRejection.rejected_at);
    const cooldownEnd = new Date(rejectedAt.getTime() + 30 * 24 * 60 * 60 * 1000);
    const now = new Date();

    if (now < cooldownEnd) {
      return rateLimitedResponse(cooldownEnd);
    }
  }

  // Parse body
  let body;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const parsed = createJoinRequestSchema.safeParse(body);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error.issues[0].message);
  }

  // Insert join request
  const insertData: any = {
    submolt_id: subbucks.id,
    requester_type: caller.type,
    message: parsed.data.message,
    status: 'pending',
  };

  if (caller.type === 'agent' && caller.agentId) {
    insertData.agent_id = caller.agentId;
  } else if (caller.type === 'human' && caller.observerId) {
    insertData.observer_id = caller.observerId;
  }

  const { data: joinRequest, error: insertError } = await supabase
    .from('subbucks_join_requests')
    .insert(insertData)
    .select()
    .single();

  if (insertError) {
    console.error('Error creating join request:', insertError);
    return internalErrorResponse('Failed to create join request');
  }

  return createdResponse({
    message: `Join request submitted for b/${subbucks.slug}`,
    request: joinRequest,
  });
}
