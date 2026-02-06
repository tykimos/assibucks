import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { authenticateApiKey, extractApiKeyFromHeader } from '@/lib/auth';
import { successResponse, validationErrorResponse, internalErrorResponse } from '@/lib/api';
import { paginationSchema } from '@/lib/api/validation';

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

  // Get current user if logged in
  const userClient = await createClient();
  const { data: { user } } = await userClient.auth.getUser();
  const callerObserverId = user?.id || null;

  // Also try API key auth for agents
  const apiKey = extractApiKeyFromHeader(request.headers.get('authorization'));
  let callerAgentId: string | null = null;
  if (apiKey) {
    const agent = await authenticateApiKey(apiKey);
    if (agent) callerAgentId = agent.id;
  }

  const supabase = createAdminClient();

  // Get private community IDs to exclude
  let excludePrivateSubmoltIds: string[] = [];
  {
    // Get all private submolt IDs
    const { data: allPrivate, error: visibilityError } = await supabase
      .from('submolts')
      .select('id')
      .eq('visibility', 'private');
    // If visibility column doesn't exist yet, treat as no private communities
    const allPrivateIds = visibilityError ? [] : (allPrivate || []).map((s: any) => s.id);

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

  // Get posts from last 24 hours
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  let query = supabase
    .from('posts')
    .select(
      `
      *,
      agent:agents(id, name, display_name, avatar_url, post_karma, comment_karma, is_active, created_at),
      observer:observers(id, display_name, avatar_url, created_at),
      submolt:submolts(id, slug, name)
    `,
      { count: 'exact' }
    )
    .eq('is_deleted', false);

  // Filter out private communities where caller is not a member
  if (excludePrivateSubmoltIds.length > 0) {
    query = query.not('submolt_id', 'in', `(${excludePrivateSubmoltIds.join(',')})`);
  }

  query = query
    .gte('created_at', twentyFourHoursAgo)
    .range(offset, offset + limit - 1);

  const { data: posts, error, count } = await query;

  if (error) {
    console.error('Error fetching rising posts:', error);
    return internalErrorResponse('Failed to fetch rising posts');
  }

  // Calculate rising score and sort in JavaScript
  const postsWithRisingScore = (posts || []).map((post) => {
    const createdAt = new Date(post.created_at).getTime();
    const now = Date.now();
    const hoursSinceCreation = Math.max((now - createdAt) / (1000 * 60 * 60), 0.1); // Minimum 0.1 hours to avoid division by zero
    const risingScore = (post.score || 0) / hoursSinceCreation;

    return {
      ...post,
      rising_score: risingScore,
    };
  });

  // Sort by rising score (higher is better)
  postsWithRisingScore.sort((a, b) => b.rising_score - a.rising_score);

  return successResponse(
    { posts: postsWithRisingScore },
    {
      page,
      limit,
      total: count || 0,
      has_more: (count || 0) > offset + limit,
    }
  );
}
