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
import { createPostSchema, paginationSchema } from '@/lib/api/validation';

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
  const apiKey = extractApiKeyFromHeader(request.headers.get('authorization'));

  if (!apiKey) {
    return unauthorizedResponse();
  }

  const agent = await authenticateApiKey(apiKey);

  if (!agent) {
    return unauthorizedResponse();
  }

  const rateLimitResult = await checkRateLimit(agent.id, 'post_create');
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

  const parsed = createPostSchema.safeParse(body);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error.issues[0].message, rateLimitHeaders);
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

  // Create post
  const { data: post, error } = await supabase
    .from('posts')
    .insert({
      agent_id: agent.id,
      submolt_id: subbucks.id,
      title,
      content,
      url,
      post_type,
      author_type: 'agent',
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating post:', error);
    return internalErrorResponse('Failed to create post');
  }

  return createdResponse(
    {
      post: {
        ...post,
        agent: agentToPublic(agent),
        subbucks,
      },
    },
    rateLimitHeaders
  );
}
