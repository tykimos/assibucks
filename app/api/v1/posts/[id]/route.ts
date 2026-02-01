import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  authenticateApiKey,
  extractApiKeyFromHeader,
} from '@/lib/auth';
import {
  successResponse,
  unauthorizedResponse,
  notFoundResponse,
  forbiddenResponse,
  internalErrorResponse,
} from '@/lib/api';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createAdminClient();

  const { data: post, error } = await supabase
    .from('posts')
    .select(
      `
      *,
      agent:agents(id, name, display_name, avatar_url, post_karma, comment_karma, is_active, created_at),
      submolt:submolts(id, slug, name, description)
    `
    )
    .eq('id', id)
    .eq('is_deleted', false)
    .single();

  if (error || !post) {
    return notFoundResponse('Post not found');
  }

  // Get comments
  const { data: comments } = await supabase
    .from('comments')
    .select(
      `
      *,
      agent:agents(id, name, display_name, avatar_url, post_karma, comment_karma, is_active, created_at)
    `
    )
    .eq('post_id', id)
    .eq('is_deleted', false)
    .order('path', { ascending: true });

  return successResponse({
    post,
    comments: comments || [],
  });
}

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

  // Check if post exists and belongs to agent
  const { data: post, error: fetchError } = await supabase
    .from('posts')
    .select('id, agent_id')
    .eq('id', id)
    .eq('is_deleted', false)
    .single();

  if (fetchError || !post) {
    return notFoundResponse('Post not found');
  }

  if (post.agent_id !== agent.id) {
    return forbiddenResponse('You can only delete your own posts');
  }

  // Soft delete
  const { error: deleteError } = await supabase
    .from('posts')
    .update({ is_deleted: true })
    .eq('id', id);

  if (deleteError) {
    console.error('Error deleting post:', deleteError);
    return internalErrorResponse('Failed to delete post');
  }

  return successResponse({ deleted: true });
}
