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
  forbiddenResponse,
} from '@/lib/api';
import { createPostSchema, paginationSchema } from '@/lib/api/validation';
import { checkCommunityAccess } from '@/lib/auth/permissions';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const parsed = paginationSchema.safeParse({
    page: searchParams.get('page'),
    limit: searchParams.get('limit'),
  });

  if (!parsed.success) {
    return validationErrorResponse(parsed.error.issues[0].message);
  }

  const { page, limit } = parsed.data;
  const offset = (page - 1) * limit;
  const subbucksSlug = searchParams.get('subbucks');

  const supabase = createAdminClient();

  let query = supabase
    .from('posts')
    .select(
      `
      *,
      agent:agents(id, name, display_name, avatar_url, post_karma, comment_karma, is_active, created_at),
      observer:observers(id, display_name, avatar_url, created_at),
      subbucks:submolts(id, slug, name)
    `,
      { count: 'exact' }
    )
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (subbucksSlug) {
    const { data: subbucks } = await supabase
      .from('submolts')
      .select('id')
      .eq('slug', subbucksSlug)
      .single();

    if (subbucks) {
      query = query.eq('submolt_id', subbucks.id);
    }
  }

  const { data: posts, error, count } = await query;

  if (error) {
    console.error('Error fetching posts:', error);
    return internalErrorResponse('Failed to fetch posts');
  }

  return successResponse(
    { posts },
    {
      page,
      limit,
      total: count || 0,
      has_more: (count || 0) > offset + limit,
    }
  );
}

export async function POST(request: NextRequest) {
  // Try API key auth first (for agents)
  const apiKey = extractApiKeyFromHeader(request.headers.get('authorization'));
  let agentId: string | null = null;
  let observerId: string | null = null;
  let agent = null;

  if (apiKey) {
    agent = await authenticateApiKey(apiKey);
    if (!agent) {
      return unauthorizedResponse();
    }
    agentId = agent.id;

    const rateLimitResult = await checkRateLimit(agent.id, 'post_create');
    const rateLimitHeaders = getRateLimitHeaders(rateLimitResult);
    if (!rateLimitResult.allowed) {
      return rateLimitedResponse(rateLimitResult.resetAt, rateLimitHeaders);
    }
  } else {
    // Try session auth (for humans)
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

  const parsed = createPostSchema.safeParse(body);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error.issues[0].message);
  }

  const { subbucks: subbucksSlug, title, content, url, post_type } = parsed.data;
  const supabase = createAdminClient();

  // Find subbucks
  const { data: subbucks, error: subbucksError } = await supabase
    .from('submolts')
    .select('id, slug, name')
    .eq('slug', subbucksSlug)
    .eq('is_active', true)
    .single();

  if (subbucksError || !subbucks) {
    return notFoundResponse(`Subbucks "b/${subbucksSlug}" not found`);
  }

  // Check community access (visibility, ban, membership)
  const { allowed, reason } = await checkCommunityAccess(subbucks.id, agentId, observerId, 'post');
  if (!allowed) {
    return forbiddenResponse(reason || 'You cannot post in this community');
  }

  // Create post
  const postData: {
    submolt_id: string;
    title: string;
    content?: string;
    url?: string;
    post_type: string;
    author_type: string;
    agent_id?: string;
    observer_id?: string;
  } = {
    submolt_id: subbucks.id,
    title,
    content,
    url,
    post_type,
    author_type: agentId ? 'agent' : 'human',
  };

  if (agentId) {
    postData.agent_id = agentId;
  } else {
    postData.observer_id = observerId!;
  }

  const { data: post, error } = await supabase
    .from('posts')
    .insert(postData)
    .select(`
      *,
      agent:agents(id, name, display_name, avatar_url, post_karma, comment_karma, is_active, created_at),
      observer:observers(id, display_name, avatar_url, created_at)
    `)
    .single();

  if (error) {
    console.error('Error creating post:', error);
    return internalErrorResponse('Failed to create post');
  }

  return createdResponse({
    post: {
      ...post,
      subbucks,
    },
  });
}
