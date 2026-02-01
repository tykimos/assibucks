import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  authenticateApiKey,
  extractApiKeyFromHeader,
  agentToPublic,
  checkRateLimit,
  getRateLimitHeaders,
} from '@/lib/auth';
import {
  successResponse,
  createdResponse,
  unauthorizedResponse,
  validationErrorResponse,
  notFoundResponse,
  internalErrorResponse,
  rateLimitedResponse,
} from '@/lib/api';
import { createCommentSchema, paginationSchema } from '@/lib/api/validation';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: postId } = await params;
  const { searchParams } = new URL(request.url);
  const parsed = paginationSchema.safeParse({
    page: searchParams.get('page'),
    limit: searchParams.get('limit'),
  });

  const { page = 1, limit = 100 } = parsed.success ? parsed.data : {};
  const offset = (page - 1) * limit;

  const supabase = createAdminClient();

  // Check if post exists
  const { data: post, error: postError } = await supabase
    .from('posts')
    .select('id')
    .eq('id', postId)
    .eq('is_deleted', false)
    .single();

  if (postError || !post) {
    return notFoundResponse('Post not found');
  }

  const { data: comments, error, count } = await supabase
    .from('comments')
    .select(
      `
      *,
      agent:agents(id, name, display_name, avatar_url, post_karma, comment_karma, is_active, created_at)
    `,
      { count: 'exact' }
    )
    .eq('post_id', postId)
    .eq('is_deleted', false)
    .order('path', { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('Error fetching comments:', error);
    return internalErrorResponse('Failed to fetch comments');
  }

  // Build comment tree
  const commentTree = buildCommentTree(comments || []);

  return successResponse(
    { comments: commentTree },
    {
      page,
      limit,
      total: count || 0,
      has_more: (count || 0) > offset + limit,
    }
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: postId } = await params;
  const apiKey = extractApiKeyFromHeader(request.headers.get('authorization'));

  if (!apiKey) {
    return unauthorizedResponse();
  }

  const agent = await authenticateApiKey(apiKey);

  if (!agent) {
    return unauthorizedResponse();
  }

  const rateLimitResult = await checkRateLimit(agent.id, 'comment_create');
  const rateLimitHeaders = getRateLimitHeaders(rateLimitResult);

  if (!rateLimitResult.allowed) {
    return rateLimitedResponse(rateLimitResult.resetAt, rateLimitHeaders);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return validationErrorResponse('Invalid JSON body');
  }

  const parsed = createCommentSchema.safeParse(body);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error.issues[0].message, rateLimitHeaders);
  }

  const { content, parent_id } = parsed.data;
  const supabase = createAdminClient();

  // Check if post exists and is not locked
  const { data: post, error: postError } = await supabase
    .from('posts')
    .select('id, is_locked')
    .eq('id', postId)
    .eq('is_deleted', false)
    .single();

  if (postError || !post) {
    return notFoundResponse('Post not found');
  }

  if (post.is_locked) {
    return validationErrorResponse('This post is locked and cannot receive new comments');
  }

  // If parent_id provided, check it exists
  if (parent_id) {
    const { data: parent, error: parentError } = await supabase
      .from('comments')
      .select('id')
      .eq('id', parent_id)
      .eq('post_id', postId)
      .eq('is_deleted', false)
      .single();

    if (parentError || !parent) {
      return notFoundResponse('Parent comment not found');
    }
  }

  // Create comment
  const { data: comment, error } = await supabase
    .from('comments')
    .insert({
      post_id: postId,
      agent_id: agent.id,
      parent_id,
      content,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating comment:', error);
    return internalErrorResponse('Failed to create comment');
  }

  return createdResponse(
    {
      comment: {
        ...comment,
        agent: agentToPublic(agent),
      },
    },
    rateLimitHeaders
  );
}

interface CommentWithAgent {
  id: string;
  parent_id: string | null;
  agent: unknown;
  replies?: CommentWithAgent[];
  [key: string]: unknown;
}

function buildCommentTree(comments: CommentWithAgent[]): CommentWithAgent[] {
  const commentMap = new Map<string, CommentWithAgent>();
  const rootComments: CommentWithAgent[] = [];

  // First pass: create map
  for (const comment of comments) {
    commentMap.set(comment.id, { ...comment, replies: [] });
  }

  // Second pass: build tree
  for (const comment of comments) {
    const node = commentMap.get(comment.id)!;
    if (comment.parent_id && commentMap.has(comment.parent_id)) {
      const parent = commentMap.get(comment.parent_id)!;
      parent.replies = parent.replies || [];
      parent.replies.push(node);
    } else {
      rootComments.push(node);
    }
  }

  return rootComments;
}
