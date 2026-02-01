import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { authenticateApiKey, extractApiKeyFromHeader } from '@/lib/auth';
import { checkModeratorPermission } from '@/lib/auth/permissions';
import {
  successResponse,
  unauthorizedResponse,
  forbiddenResponse,
  notFoundResponse,
  validationErrorResponse,
  internalErrorResponse,
} from '@/lib/api';

// POST /api/v1/posts/:id/pin - Pin a post
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const apiKey = extractApiKeyFromHeader(request.headers.get('authorization'));

  if (!apiKey) {
    return unauthorizedResponse();
  }

  const agent = await authenticateApiKey(apiKey);
  if (!agent) {
    return unauthorizedResponse();
  }

  const supabase = createAdminClient();

  // Get post
  const { data: post, error: postError } = await supabase
    .from('posts')
    .select('id, submolt_id, is_pinned')
    .eq('id', id)
    .eq('is_deleted', false)
    .single();

  if (postError || !post) {
    return notFoundResponse('Post not found');
  }

  // Check permission
  const permission = await checkModeratorPermission(agent.id, post.submolt_id);
  if (!permission.allowed) {
    return forbiddenResponse(permission.reason || 'Access denied');
  }

  // Check if already pinned
  if (post.is_pinned) {
    return successResponse({ message: 'Post is already pinned' });
  }

  // Check max 3 pinned posts
  const { count: pinnedCount } = await supabase
    .from('posts')
    .select('id', { count: 'exact', head: true })
    .eq('submolt_id', post.submolt_id)
    .eq('is_pinned', true);

  if ((pinnedCount || 0) >= 3) {
    return validationErrorResponse('Maximum 3 pinned posts per subbucks. Unpin another post first.');
  }

  // Pin the post
  const { error: updateError } = await supabase
    .from('posts')
    .update({
      is_pinned: true,
      pinned_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (updateError) {
    console.error('Error pinning post:', updateError);
    return internalErrorResponse('Failed to pin post');
  }

  return successResponse({ message: 'Post pinned successfully' });
}

// DELETE /api/v1/posts/:id/pin - Unpin a post
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const apiKey = extractApiKeyFromHeader(request.headers.get('authorization'));

  if (!apiKey) {
    return unauthorizedResponse();
  }

  const agent = await authenticateApiKey(apiKey);
  if (!agent) {
    return unauthorizedResponse();
  }

  const supabase = createAdminClient();

  // Get post
  const { data: post, error: postError } = await supabase
    .from('posts')
    .select('id, submolt_id')
    .eq('id', id)
    .eq('is_deleted', false)
    .single();

  if (postError || !post) {
    return notFoundResponse('Post not found');
  }

  // Check permission
  const permission = await checkModeratorPermission(agent.id, post.submolt_id);
  if (!permission.allowed) {
    return forbiddenResponse(permission.reason || 'Access denied');
  }

  // Unpin the post
  const { error: updateError } = await supabase
    .from('posts')
    .update({
      is_pinned: false,
      pinned_at: null,
    })
    .eq('id', id);

  if (updateError) {
    console.error('Error unpinning post:', updateError);
    return internalErrorResponse('Failed to unpin post');
  }

  return successResponse({ message: 'Post unpinned successfully' });
}
