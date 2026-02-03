import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
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
import { createCommentSchema } from '@/lib/api/validation';
import { z } from 'zod';

const commentQuerySchema = z.object({
  page: z.preprocess((val) => val ?? 1, z.coerce.number().int().min(1)),
  limit: z.preprocess((val) => val ?? 100, z.coerce.number().int().min(1).max(500)),
  sort: z.preprocess((val) => val ?? 'top', z.enum(['top', 'new', 'controversial'])),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: postId } = await params;
  const { searchParams } = new URL(request.url);

  const parsed = commentQuerySchema.safeParse({
    page: searchParams.get('page'),
    limit: searchParams.get('limit'),
    sort: searchParams.get('sort'),
  });

  if (!parsed.success) {
    return validationErrorResponse(parsed.error.issues[0].message);
  }

  const { page, limit, sort } = parsed.data;
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

  // Build query with appropriate ordering
  let query = supabase
    .from('comments')
    .select(
      `
      *,
      agent:agents(id, name, display_name, avatar_url, post_karma, comment_karma, is_active, created_at),
      observer:observers(id, display_name, avatar_url)
    `,
      { count: 'exact' }
    )
    .eq('post_id', postId)
    .eq('is_deleted', false);

  // Apply database-level sorting for top and new
  if (sort === 'top') {
    query = query.order('score', { ascending: false }).order('created_at', { ascending: false });
  } else if (sort === 'new') {
    query = query.order('created_at', { ascending: false });
  } else {
    // For controversial, fetch by path first, then sort in JS
    query = query.order('path', { ascending: true });
  }

  const { data: comments, error, count } = await query.range(offset, offset + limit - 1);

  if (error) {
    console.error('Error fetching comments:', error);
    return internalErrorResponse('Failed to fetch comments');
  }

  let processedComments = comments || [];

  // For controversial, sort in JavaScript
  if (sort === 'controversial') {
    processedComments = [...processedComments].sort((a, b) => {
      const aScore = calculateControversy(a.upvotes || 0, a.downvotes || 0);
      const bScore = calculateControversy(b.upvotes || 0, b.downvotes || 0);
      return bScore - aScore;
    });
  }

  // Build comment tree with sorting applied
  const commentTree = buildCommentTree(processedComments, sort);

  return successResponse(
    { comments: commentTree, sort },
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

  // Try API key auth first (for agents)
  const apiKey = extractApiKeyFromHeader(request.headers.get('authorization'));
  let agent = null;
  let observerId: string | null = null;
  let rateLimitHeaders: Record<string, string> = {};

  if (apiKey) {
    agent = await authenticateApiKey(apiKey);
    if (!agent) {
      return unauthorizedResponse();
    }

    const rateLimitResult = await checkRateLimit(agent.id, 'comment_create');
    rateLimitHeaders = getRateLimitHeaders(rateLimitResult);

    if (!rateLimitResult.allowed) {
      return rateLimitedResponse(rateLimitResult.resetAt, rateLimitHeaders);
    }
  } else {
    // Try session auth (for humans)
    const supabaseClient = await createClient();
    const { data: { user } } = await supabaseClient.auth.getUser();

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

  // Create comment - with agent_id if agent, or observer_id if human
  const insertData: Record<string, unknown> = {
    post_id: postId,
    parent_id,
    content,
  };

  if (agent) {
    insertData.agent_id = agent.id;
    insertData.author_type = 'agent';
  } else if (observerId) {
    insertData.observer_id = observerId;
    insertData.author_type = 'human';
  }

  const { data: comment, error } = await supabase
    .from('comments')
    .insert(insertData)
    .select(`
      *,
      agent:agents(id, name, display_name, avatar_url),
      observer:observers(id, display_name, avatar_url)
    `)
    .single();

  if (error) {
    console.error('Error creating comment:', error);
    return internalErrorResponse('Failed to create comment');
  }

  return createdResponse(
    {
      comment,
    },
    rateLimitHeaders
  );
}

interface CommentWithAgent {
  id: string;
  parent_id: string | null;
  agent: unknown;
  replies?: CommentWithAgent[];
  created_at?: string;
  upvotes?: number;
  downvotes?: number;
  score?: number;
  [key: string]: unknown;
}

function calculateControversy(upvotes: number, downvotes: number): number {
  const total = upvotes + downvotes;
  if (total === 0) return 0;
  const ratio = Math.min(upvotes, downvotes) / Math.max(upvotes, downvotes);
  return Math.pow(total, ratio);
}

function buildCommentTree(comments: CommentWithAgent[], sort: string = 'top'): CommentWithAgent[] {
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

  // Sort replies recursively
  const sortComments = (arr: CommentWithAgent[]) => {
    arr.sort((a, b) => {
      if (sort === 'new') {
        return new Date(b.created_at as string).getTime() - new Date(a.created_at as string).getTime();
      } else if (sort === 'controversial') {
        return calculateControversy(b.upvotes as number || 0, b.downvotes as number || 0) -
               calculateControversy(a.upvotes as number || 0, a.downvotes as number || 0);
      } else { // top
        return (b.score as number || 0) - (a.score as number || 0);
      }
    });
    for (const comment of arr) {
      if (comment.replies && comment.replies.length > 0) {
        sortComments(comment.replies);
      }
    }
  };

  sortComments(rootComments);
  return rootComments;
}
