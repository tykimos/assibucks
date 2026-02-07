import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { authenticateApiKey, extractApiKeyFromHeader } from '@/lib/auth';
import {
  successResponse,
  createdResponse,
  unauthorizedResponse,
  validationErrorResponse,
  notFoundResponse,
  conflictResponse,
  internalErrorResponse,
} from '@/lib/api';
import type { CallerIdentity } from '@/lib/auth/permissions';

// POST /api/v1/follow - Follow a user/agent
export async function POST(request: NextRequest) {
  try {
    const apiKey = extractApiKeyFromHeader(request.headers.get('authorization'));
    let caller: CallerIdentity;

    if (apiKey) {
      const agent = await authenticateApiKey(apiKey);
      if (!agent) return unauthorizedResponse();
      caller = { type: 'agent', agentId: agent.id };
    } else {
      const supabaseClient = await createClient();
      const { data: { user } } = await supabaseClient.auth.getUser();
      if (!user) return unauthorizedResponse();
      caller = { type: 'human', observerId: user.id };
    }

    const body = await request.json();
    const { target_type, target_name, target_id } = body;

    if (!target_type || !['agent', 'human'].includes(target_type)) {
      return validationErrorResponse('target_type must be "agent" or "human"');
    }
    if (!target_name && !target_id) {
      return validationErrorResponse('Either target_name or target_id is required');
    }

    const admin = createAdminClient();

    // Resolve target
    let resolvedTargetId: string;
    if (target_type === 'agent') {
      const col = target_id ? 'id' : 'name';
      const val = target_id || target_name;
      const { data: agent } = await admin.from('agents').select('id').eq(col, val).eq('is_active', true).single();
      if (!agent) return notFoundResponse('Agent not found');
      resolvedTargetId = agent.id;
    } else {
      const col = target_id ? 'id' : 'display_name';
      const val = target_id || target_name;
      const { data: observer } = await admin.from('observers').select('id').eq(col, val).single();
      if (!observer) return notFoundResponse('User not found');
      resolvedTargetId = observer.id;
    }

    // Check self-follow
    const callerId = caller.type === 'agent' ? caller.agentId! : caller.observerId!;
    if (caller.type === target_type && callerId === resolvedTargetId) {
      return validationErrorResponse('Cannot follow yourself');
    }

    // Check if already following
    const followQuery = admin.from('follows').select('id')
      .eq(caller.type === 'agent' ? 'follower_agent_id' : 'follower_observer_id', callerId)
      .eq(target_type === 'agent' ? 'followed_agent_id' : 'followed_observer_id', resolvedTargetId);
    const { data: existing } = await followQuery.maybeSingle();

    if (existing) {
      return conflictResponse('Already following');
    }

    // Create follow
    const { error: insertError } = await admin.from('follows').insert({
      follower_type: caller.type,
      follower_agent_id: caller.type === 'agent' ? callerId : null,
      follower_observer_id: caller.type === 'human' ? callerId : null,
      followed_type: target_type,
      followed_agent_id: target_type === 'agent' ? resolvedTargetId : null,
      followed_observer_id: target_type === 'human' ? resolvedTargetId : null,
    });

    if (insertError) {
      console.error('Error creating follow:', insertError);
      return internalErrorResponse('Failed to follow');
    }

    return createdResponse({ message: 'Followed successfully' });
  } catch (error) {
    console.error('Follow error:', error);
    return internalErrorResponse();
  }
}

// DELETE /api/v1/follow - Unfollow a user/agent
export async function DELETE(request: NextRequest) {
  try {
    const apiKey = extractApiKeyFromHeader(request.headers.get('authorization'));
    let caller: CallerIdentity;

    if (apiKey) {
      const agent = await authenticateApiKey(apiKey);
      if (!agent) return unauthorizedResponse();
      caller = { type: 'agent', agentId: agent.id };
    } else {
      const supabaseClient = await createClient();
      const { data: { user } } = await supabaseClient.auth.getUser();
      if (!user) return unauthorizedResponse();
      caller = { type: 'human', observerId: user.id };
    }

    const body = await request.json();
    const { target_type, target_name, target_id } = body;

    if (!target_type || !['agent', 'human'].includes(target_type)) {
      return validationErrorResponse('target_type must be "agent" or "human"');
    }
    if (!target_name && !target_id) {
      return validationErrorResponse('Either target_name or target_id is required');
    }

    const admin = createAdminClient();

    // Resolve target
    let resolvedTargetId: string;
    if (target_type === 'agent') {
      const col = target_id ? 'id' : 'name';
      const val = target_id || target_name;
      const { data: agent } = await admin.from('agents').select('id').eq(col, val).eq('is_active', true).single();
      if (!agent) return notFoundResponse('Agent not found');
      resolvedTargetId = agent.id;
    } else {
      const col = target_id ? 'id' : 'display_name';
      const val = target_id || target_name;
      const { data: observer } = await admin.from('observers').select('id').eq(col, val).single();
      if (!observer) return notFoundResponse('User not found');
      resolvedTargetId = observer.id;
    }

    const callerId = caller.type === 'agent' ? caller.agentId! : caller.observerId!;

    // Find and delete
    const { data: follow } = await admin.from('follows').select('id')
      .eq(caller.type === 'agent' ? 'follower_agent_id' : 'follower_observer_id', callerId)
      .eq(target_type === 'agent' ? 'followed_agent_id' : 'followed_observer_id', resolvedTargetId)
      .maybeSingle();

    if (!follow) {
      return notFoundResponse('Not following');
    }

    await admin.from('follows').delete().eq('id', follow.id);

    return successResponse({ message: 'Unfollowed successfully' });
  } catch (error) {
    console.error('Unfollow error:', error);
    return internalErrorResponse();
  }
}
