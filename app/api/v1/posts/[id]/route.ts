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
  notFoundResponse,
  forbiddenResponse,
  internalErrorResponse,
  validationErrorResponse,
} from '@/lib/api';
import { updatePostSchema } from '@/lib/api/validation';

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
      observer:observers(id, display_name, avatar_url, created_at),
      submolt:submolts(id, slug, name, description),
      attachments:post_attachments(id, file_url, file_name, file_size, file_type, is_image, display_order)
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Auth
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
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return unauthorizedResponse();
    }
    observerId = user.id;
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return validationErrorResponse('Invalid JSON body');
  }

  const parsed = updatePostSchema.safeParse(body);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error.issues[0].message);
  }

  const supabase = createAdminClient();

  // Check post exists and ownership
  const { data: post, error: fetchError } = await supabase
    .from('posts')
    .select('id, agent_id, observer_id')
    .eq('id', id)
    .eq('is_deleted', false)
    .single();

  if (fetchError || !post) {
    return notFoundResponse('Post not found');
  }

  if (agentId && post.agent_id !== agentId) {
    return forbiddenResponse('You can only edit your own posts');
  }
  if (observerId && post.observer_id !== observerId) {
    return forbiddenResponse('You can only edit your own posts');
  }

  // Update post fields
  const updateData: Record<string, string | null> = {};
  if (parsed.data.title !== undefined) {
    updateData.title = parsed.data.title;
  }
  if (parsed.data.content !== undefined) {
    updateData.content = parsed.data.content;
  }

  if (Object.keys(updateData).length > 0) {
    const { error: updateError } = await supabase
      .from('posts')
      .update(updateData)
      .eq('id', id);

    if (updateError) {
      console.error('Error updating post:', updateError);
      return internalErrorResponse('Failed to update post');
    }
  }

  // Handle attachments: replace all if provided
  if (parsed.data.attachments !== undefined) {
    // Delete existing attachments
    await supabase
      .from('post_attachments')
      .delete()
      .eq('post_id', id);

    // Insert new attachments
    if (parsed.data.attachments.length > 0) {
      const attachmentRows = parsed.data.attachments.map((att, index) => ({
        post_id: id,
        file_url: att.file_url,
        file_name: att.file_name,
        file_size: att.file_size,
        file_type: att.file_type,
        is_image: att.is_image,
        display_order: att.display_order ?? index,
      }));

      const { error: attError } = await supabase
        .from('post_attachments')
        .insert(attachmentRows);

      if (attError) {
        console.error('Error updating attachments:', attError);
      }
    }
  }

  // Fetch updated post
  const { data: updatedPost, error: refetchError } = await supabase
    .from('posts')
    .select(`
      *,
      agent:agents(id, name, display_name, avatar_url, post_karma, comment_karma, is_active, created_at),
      observer:observers(id, display_name, avatar_url, created_at),
      submolt:submolts(id, slug, name, description),
      attachments:post_attachments(id, file_url, file_name, file_size, file_type, is_image, display_order)
    `)
    .eq('id', id)
    .single();

  if (refetchError || !updatedPost) {
    return internalErrorResponse('Failed to fetch updated post');
  }

  return successResponse({ post: updatedPost });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

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
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return unauthorizedResponse();
    }
    observerId = user.id;
  }

  const supabase = createAdminClient();

  // Check if post exists and belongs to user
  const { data: post, error: fetchError } = await supabase
    .from('posts')
    .select('id, agent_id, observer_id')
    .eq('id', id)
    .eq('is_deleted', false)
    .single();

  if (fetchError || !post) {
    return notFoundResponse('Post not found');
  }

  // Check ownership
  if (agentId && post.agent_id !== agentId) {
    return forbiddenResponse('You can only delete your own posts');
  }
  if (observerId && post.observer_id !== observerId) {
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
