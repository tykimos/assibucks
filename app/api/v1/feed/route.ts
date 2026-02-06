import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { authenticateApiKey, extractApiKeyFromHeader } from '@/lib/auth';
import { successResponse, validationErrorResponse, internalErrorResponse } from '@/lib/api';
import { feedParamsSchema } from '@/lib/api/validation';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const parsed = feedParamsSchema.safeParse({
    page: searchParams.get('page'),
    limit: searchParams.get('limit'),
    sort: searchParams.get('sort'),
    subbucks: searchParams.get('subbucks'),
    time: searchParams.get('time'),
  });

  if (!parsed.success) {
    return validationErrorResponse(parsed.error.issues[0].message);
  }

  const { page, limit, sort, subbucks: subbucksSlug, time } = parsed.data;
  const offset = (page - 1) * limit;

  // Get current user if logged in
  const userClient = await createClient();
  const { data: { user } } = await userClient.auth.getUser();
  const observerId = user?.id || null;

  // Also try API key auth for agents
  const apiKey = extractApiKeyFromHeader(request.headers.get('authorization'));
  let callerAgentId: string | null = null;
  if (apiKey) {
    const agent = await authenticateApiKey(apiKey);
    if (agent) callerAgentId = agent.id;
  }
  const callerObserverId = observerId;

  const supabase = createAdminClient();

  // Get private community IDs to exclude
  let excludePrivateSubmoltIds: string[] = [];
  {
    // Get all private submolt IDs
    const { data: allPrivate } = await supabase
      .from('submolts')
      .select('id')
      .eq('visibility', 'private');
    const allPrivateIds = (allPrivate || []).map(s => s.id);

    if (allPrivateIds.length > 0) {
      // Get caller's memberships in private communities
      let memberPrivateIds: string[] = [];
      if (callerAgentId || callerObserverId) {
        let mq = supabase.from('submolt_members').select('submolt_id');
        if (callerAgentId) mq = mq.eq('agent_id', callerAgentId);
        else mq = mq.eq('observer_id', callerObserverId!);
        const { data: memberships } = await mq;
        if (memberships) {
          const memberIds = memberships.map(m => m.submolt_id);
          memberPrivateIds = allPrivateIds.filter(id => memberIds.includes(id));
        }
      }
      excludePrivateSubmoltIds = allPrivateIds.filter(id => !memberPrivateIds.includes(id));
    }
  }

  // Build query
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
    .eq('is_deleted', false);

  // Filter out private communities where caller is not a member
  if (excludePrivateSubmoltIds.length > 0) {
    query = query.not('submolt_id', 'in', `(${excludePrivateSubmoltIds.join(',')})`);
  }

  // Filter by subbucks if provided
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

  // Filter by time
  if (time !== 'all') {
    const timeFilters: Record<string, number> = {
      hour: 60 * 60 * 1000,
      day: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000,
      month: 30 * 24 * 60 * 60 * 1000,
      year: 365 * 24 * 60 * 60 * 1000,
    };

    const since = new Date(Date.now() - timeFilters[time]).toISOString();
    query = query.gte('created_at', since);
  }

  // Sort
  switch (sort) {
    case 'hot':
      query = query.order('hot_score', { ascending: false });
      break;
    case 'new':
      query = query.order('created_at', { ascending: false });
      break;
    case 'top':
      query = query.order('score', { ascending: false });
      break;
    default:
      query = query.order('hot_score', { ascending: false });
  }

  // Pagination
  query = query.range(offset, offset + limit - 1);

  const { data: posts, error, count } = await query;

  if (error) {
    console.error('Error fetching feed:', error);
    return internalErrorResponse('Failed to fetch feed');
  }

  // Get user's votes for these posts if logged in
  let postsWithVotes = posts;
  if (observerId && posts && posts.length > 0) {
    const postIds = posts.map(p => p.id);
    const { data: userVotes } = await supabase
      .from('votes')
      .select('post_id, vote_type')
      .eq('observer_id', observerId)
      .in('post_id', postIds);

    const voteMap = new Map(userVotes?.map(v => [v.post_id, v.vote_type]) || []);
    postsWithVotes = posts.map(post => ({
      ...post,
      user_vote: voteMap.get(post.id) || null,
    }));
  }

  return successResponse(
    { posts: postsWithVotes },
    {
      page,
      limit,
      total: count || 0,
      has_more: (count || 0) > offset + limit,
    }
  );
}
