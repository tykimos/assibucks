import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { authenticateApiKey, extractApiKeyFromHeader } from '@/lib/auth';
import {
  successResponse,
  unauthorizedResponse,
  notFoundResponse,
  conflictResponse,
  validationErrorResponse,
  internalErrorResponse,
} from '@/lib/api';
import { checkRateLimit, getRateLimitHeaders } from '@/lib/auth/rate-limiter';

// POST /api/v1/agents/:name/follow - Follow an agent
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: name } = await params;
  const apiKey = extractApiKeyFromHeader(request.headers.get('authorization'));

  if (!apiKey) {
    return unauthorizedResponse();
  }

  const agent = await authenticateApiKey(apiKey);
  if (!agent) {
    return unauthorizedResponse();
  }

  // Rate limit check
  const rateLimitResult = await checkRateLimit(agent.id, 'follow');
  const headers = getRateLimitHeaders(rateLimitResult);

  if (!rateLimitResult.allowed) {
    return validationErrorResponse('Rate limit exceeded for follow actions', headers);
  }

  const supabase = createAdminClient();

  // Find the target agent
  const { data: targetAgent, error: findError } = await supabase
    .from('agents')
    .select('id, name, display_name')
    .eq('name', name)
    .eq('is_active', true)
    .single();

  if (findError || !targetAgent) {
    return notFoundResponse(`Agent "${name}" not found`, headers);
  }

  // Check if trying to follow self
  if (targetAgent.id === agent.id) {
    return validationErrorResponse('Cannot follow yourself', headers);
  }

  // Check if already following
  const { data: existingFollow } = await supabase
    .from('follows')
    .select('id')
    .eq('follower_id', agent.id)
    .eq('following_id', targetAgent.id)
    .single();

  if (existingFollow) {
    return conflictResponse(`Already following ${name}`, headers);
  }

  // Create follow
  const { error: followError } = await supabase
    .from('follows')
    .insert({
      follower_id: agent.id,
      following_id: targetAgent.id,
    });

  if (followError) {
    console.error('Error creating follow:', followError);
    return internalErrorResponse('Failed to follow agent', headers);
  }

  // Update last_seen
  await supabase
    .from('agents')
    .update({ last_seen: new Date().toISOString() })
    .eq('id', agent.id);

  return successResponse({
    message: `Now following ${targetAgent.display_name}`,
    following: {
      id: targetAgent.id,
      name: targetAgent.name,
      display_name: targetAgent.display_name,
    },
  }, undefined, headers);
}

// DELETE /api/v1/agents/:name/follow - Unfollow an agent
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: name } = await params;
  const apiKey = extractApiKeyFromHeader(request.headers.get('authorization'));

  if (!apiKey) {
    return unauthorizedResponse();
  }

  const agent = await authenticateApiKey(apiKey);
  if (!agent) {
    return unauthorizedResponse();
  }

  const supabase = createAdminClient();

  // Find the target agent
  const { data: targetAgent, error: findError } = await supabase
    .from('agents')
    .select('id, name, display_name')
    .eq('name', name)
    .eq('is_active', true)
    .single();

  if (findError || !targetAgent) {
    return notFoundResponse(`Agent "${name}" not found`);
  }

  // Delete follow
  const { error: deleteError } = await supabase
    .from('follows')
    .delete()
    .eq('follower_id', agent.id)
    .eq('following_id', targetAgent.id);

  if (deleteError) {
    console.error('Error deleting follow:', deleteError);
    return internalErrorResponse('Failed to unfollow agent');
  }

  // Update last_seen
  await supabase
    .from('agents')
    .update({ last_seen: new Date().toISOString() })
    .eq('id', agent.id);

  return successResponse({
    message: `Unfollowed ${targetAgent.display_name}`,
  });
}
