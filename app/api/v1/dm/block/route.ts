import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { authenticateApiKey, extractApiKeyFromHeader } from '@/lib/auth';
import {
  successResponse,
  createdResponse,
  unauthorizedResponse,
  forbiddenResponse,
  notFoundResponse,
  validationErrorResponse,
  conflictResponse,
  internalErrorResponse,
} from '@/lib/api';
import { blockUserSchema, type BlockUserInput } from '@/lib/api/validation';
import type { CallerIdentity } from '@/lib/auth/permissions';

export async function POST(request: NextRequest) {
  try {
    // Dual auth pattern
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

    // Validate body
    const body = await request.json();
    const validation = blockUserSchema.safeParse(body);
    if (!validation.success) {
      return validationErrorResponse(validation.error.issues[0].message);
    }

    const { target_type, target_name, target_id } = validation.data;

    // Validate target provided
    if (!target_name && !target_id) {
      return validationErrorResponse('Either target_id or target_name must be provided');
    }

    // Resolve target by name or ID
    const admin = createAdminClient();
    let resolvedTargetId: string;

    if (target_type === 'agent') {
      if (target_id) {
        const { data: agent } = await admin
          .from('agents')
          .select('id')
          .eq('id', target_id)
          .single();
        if (!agent) return notFoundResponse('Agent not found');
        resolvedTargetId = agent.id;
      } else {
        const { data: agent } = await admin
          .from('agents')
          .select('id')
          .eq('name', target_name!)
          .single();
        if (!agent) return notFoundResponse('Agent not found');
        resolvedTargetId = agent.id;
      }
    } else {
      // target_type === 'human'
      if (target_id) {
        const { data: observer } = await admin
          .from('observers')
          .select('id')
          .eq('id', target_id)
          .single();
        if (!observer) return notFoundResponse('User not found');
        resolvedTargetId = observer.id;
      } else {
        const { data: observer } = await admin
          .from('observers')
          .select('id')
          .eq('display_name', target_name!)
          .single();
        if (!observer) return notFoundResponse('User not found');
        resolvedTargetId = observer.id;
      }
    }

    // Check if already blocked
    const blockerCol = caller.type === 'agent' ? 'blocker_agent_id' : 'blocker_observer_id';
    const blockedCol = target_type === 'agent' ? 'blocked_agent_id' : 'blocked_observer_id';
    const callerId = caller.type === 'agent' ? caller.agentId : caller.observerId;

    const { data: existingBlock } = await admin
      .from('dm_blocks')
      .select('id')
      .eq(blockerCol, callerId!)
      .eq(blockedCol, resolvedTargetId)
      .single();

    if (existingBlock) {
      return conflictResponse('User is already blocked');
    }

    // Insert block
    const { error: insertError } = await admin
      .from('dm_blocks')
      .insert({
        blocker_type: caller.type,
        blocker_agent_id: caller.type === 'agent' ? caller.agentId : null,
        blocker_observer_id: caller.type === 'human' ? caller.observerId : null,
        blocked_type: target_type,
        blocked_agent_id: target_type === 'agent' ? resolvedTargetId : null,
        blocked_observer_id: target_type === 'human' ? resolvedTargetId : null,
      });

    if (insertError) {
      return internalErrorResponse('Failed to block user');
    }

    return createdResponse({ message: 'User blocked' });
  } catch (error) {
    console.error('Block user error:', error);
    return internalErrorResponse();
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Dual auth pattern
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

    // Parse body
    const body = await request.json();
    const validation = blockUserSchema.safeParse(body);
    if (!validation.success) {
      return validationErrorResponse(validation.error.issues[0].message);
    }

    const { target_type, target_name, target_id } = validation.data;

    // Validate target provided
    if (!target_name && !target_id) {
      return validationErrorResponse('Either target_id or target_name must be provided');
    }

    // Resolve target by name or ID
    const admin = createAdminClient();
    let resolvedTargetId: string;

    if (target_type === 'agent') {
      if (target_id) {
        const { data: agent } = await admin
          .from('agents')
          .select('id')
          .eq('id', target_id)
          .single();
        if (!agent) return notFoundResponse('Agent not found');
        resolvedTargetId = agent.id;
      } else {
        const { data: agent } = await admin
          .from('agents')
          .select('id')
          .eq('name', target_name!)
          .single();
        if (!agent) return notFoundResponse('Agent not found');
        resolvedTargetId = agent.id;
      }
    } else {
      // target_type === 'human'
      if (target_id) {
        const { data: observer } = await admin
          .from('observers')
          .select('id')
          .eq('id', target_id)
          .single();
        if (!observer) return notFoundResponse('User not found');
        resolvedTargetId = observer.id;
      } else {
        const { data: observer } = await admin
          .from('observers')
          .select('id')
          .eq('display_name', target_name!)
          .single();
        if (!observer) return notFoundResponse('User not found');
        resolvedTargetId = observer.id;
      }
    }

    // Find and delete the block
    const blockerCol = caller.type === 'agent' ? 'blocker_agent_id' : 'blocker_observer_id';
    const blockedCol = target_type === 'agent' ? 'blocked_agent_id' : 'blocked_observer_id';
    const callerId = caller.type === 'agent' ? caller.agentId : caller.observerId;

    const { data: block } = await admin
      .from('dm_blocks')
      .select('id')
      .eq(blockerCol, callerId!)
      .eq(blockedCol, resolvedTargetId)
      .single();

    if (!block) {
      return notFoundResponse('Block not found');
    }

    const { error: deleteError } = await admin
      .from('dm_blocks')
      .delete()
      .eq('id', block.id);

    if (deleteError) {
      return internalErrorResponse('Failed to unblock user');
    }

    return successResponse({ message: 'User unblocked' });
  } catch (error) {
    console.error('Unblock user error:', error);
    return internalErrorResponse();
  }
}

export async function GET(request: NextRequest) {
  try {
    // Dual auth pattern
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

    // Query blocks where caller is the blocker
    const admin = createAdminClient();
    const blockerCol = caller.type === 'agent' ? 'blocker_agent_id' : 'blocker_observer_id';
    const callerId = caller.type === 'agent' ? caller.agentId : caller.observerId;

    const { data: blocks, error } = await admin
      .from('dm_blocks')
      .select('*')
      .eq(blockerCol, callerId!);

    if (error) {
      return internalErrorResponse('Failed to fetch blocked users');
    }

    // Format the response with blocked user info
    const blockedUsers = (blocks || []).map(block => ({
      id: block.id,
      blocked_type: block.blocked_type,
      blocked_id: block.blocked_type === 'agent' ? block.blocked_agent_id : block.blocked_observer_id,
      created_at: block.created_at,
    }));

    return successResponse({ blocked_users: blockedUsers });
  } catch (error) {
    console.error('List blocked users error:', error);
    return internalErrorResponse();
  }
}
