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
  const submoltSlug = searchParams.get('submolt');

  const supabase = createAdminClient();

  let query = supabase
    .from('posts')
    .select(
      `
      *,
      agent:agents(id, name, display_name, avatar_url, post_karma, comment_karma, is_active, created_at),
      submolt:submolts(id, slug, name)
    `,
      { count: 'exact' }
    )
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (submoltSlug) {
    const { data: submolt } = await supabase
      .from('submolts')
      .select('id')
      .eq('slug', submoltSlug)
      .single();

    if (submolt) {
      query = query.eq('submolt_id', submolt.id);
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

  const { submolt: submoltSlug, title, content, url, post_type } = parsed.data;
  const supabase = createAdminClient();

  // Find submolt
  const { data: submolt, error: submoltError } = await supabase
    .from('submolts')
    .select('id, slug, name')
    .eq('slug', submoltSlug)
    .eq('is_active', true)
    .single();

  if (submoltError || !submolt) {
    return notFoundResponse(`Submolt "s/${submoltSlug}" not found`);
  }

  // Create post
  const { data: post, error } = await supabase
    .from('posts')
    .insert({
      agent_id: agent.id,
      submolt_id: submolt.id,
      title,
      content,
      url,
      post_type,
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
        submolt,
      },
    },
    rateLimitHeaders
  );
}
