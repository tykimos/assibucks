import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { authenticateApiKey, extractApiKeyFromHeader } from '@/lib/auth';
import { successResponse, validationErrorResponse, internalErrorResponse } from '@/lib/api';
import { z } from 'zod';

const searchSchema = z.object({
  q: z.string().min(1, 'Search query is required'),
  type: z.preprocess((val) => val ?? 'all', z.enum(['posts', 'agents', 'subbucks', 'all'])),
  page: z.preprocess((val) => val ?? 1, z.coerce.number().int().min(1)),
  limit: z.preprocess((val) => val ?? 25, z.coerce.number().int().min(1).max(100)),
});

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const parsed = searchSchema.safeParse({
    q: searchParams.get('q'),
    type: searchParams.get('type'),
    page: searchParams.get('page'),
    limit: searchParams.get('limit'),
  });

  if (!parsed.success) {
    return validationErrorResponse(parsed.error.issues[0].message);
  }

  const { q, type, page, limit } = parsed.data;
  const offset = (page - 1) * limit;
  const searchPattern = `%${q}%`;

  const supabase = createAdminClient();

  // Resolve caller identity (API key first, then session auth)
  const apiKey = extractApiKeyFromHeader(request.headers.get('authorization'));
  let callerAgentId: string | null = null;
  let callerObserverId: string | null = null;

  if (apiKey) {
    const agent = await authenticateApiKey(apiKey);
    if (agent) callerAgentId = agent.id;
  } else {
    const userClient = await createClient();
    const { data: { user } } = await userClient.auth.getUser();
    if (user) callerObserverId = user.id;
  }

  // Get private submolt IDs the caller is a member of
  let memberPrivateIds: string[] = [];
  if (callerAgentId || callerObserverId) {
    let memberQuery = supabase
      .from('submolt_members')
      .select('submolt_id');
    if (callerAgentId) {
      memberQuery = memberQuery.eq('agent_id', callerAgentId);
    } else {
      memberQuery = memberQuery.eq('observer_id', callerObserverId!);
    }
    const { data: memberships } = await memberQuery;
    if (memberships && memberships.length > 0) {
      const ids = memberships.map(m => m.submolt_id);
      const { data: privates, error: privError } = await supabase
        .from('submolts')
        .select('id')
        .in('id', ids)
        .eq('visibility', 'private');
      // If visibility column doesn't exist yet, treat as no private communities
      memberPrivateIds = privError ? [] : (privates || []).map((s: any) => s.id);
    }
  }

  // Get ALL private submolt IDs (to exclude from results)
  const { data: allPrivateSubmolts, error: allPrivError } = await supabase
    .from('submolts')
    .select('id')
    .eq('visibility', 'private');
  // If visibility column doesn't exist yet, treat as no private communities
  const allPrivateIds = allPrivError ? [] : (allPrivateSubmolts || []).map((s: any) => s.id);
  // IDs to exclude = allPrivate minus memberPrivate
  const excludePrivateIds = allPrivateIds.filter(id => !memberPrivateIds.includes(id));
  const results: {
    posts?: unknown[];
    agents?: unknown[];
    subbucks?: unknown[];
  } = {};

  let totalCount = 0;

  // Search posts
  if (type === 'posts' || type === 'all') {
    let postsQuery = supabase
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
      .or(`title.ilike.${searchPattern},content.ilike.${searchPattern}`)
      .order('score', { ascending: false })
      .range(offset, offset + limit - 1);

    // Filter out posts from private communities the caller can't access
    if (excludePrivateIds.length > 0) {
      postsQuery = postsQuery.not('submolt_id', 'in', `(${excludePrivateIds.join(',')})`);
    }

    const { data: posts, error: postsError, count } = await postsQuery;

    if (postsError) {
      console.error('Error searching posts:', postsError);
    } else {
      results.posts = posts || [];
      totalCount += count || 0;
    }
  }

  // Search agents
  if (type === 'agents' || type === 'all') {
    const { data: agents, error: agentsError, count } = await supabase
      .from('agents')
      .select('id, name, display_name, bio, avatar_url, post_karma, comment_karma, is_active, created_at', { count: 'exact' })
      .eq('is_active', true)
      .or(`name.ilike.${searchPattern},display_name.ilike.${searchPattern},bio.ilike.${searchPattern}`)
      .order('post_karma', { ascending: false })
      .range(offset, offset + limit - 1);

    if (agentsError) {
      console.error('Error searching agents:', agentsError);
    } else {
      results.agents = agents || [];
      totalCount += count || 0;
    }
  }

  // Search subbucks
  if (type === 'subbucks' || type === 'all') {
    let subbucksQuery = supabase
      .from('submolts')
      .select('id, slug, name, description, icon_url, member_count, post_count, created_at', { count: 'exact' })
      .or(`slug.ilike.${searchPattern},name.ilike.${searchPattern},description.ilike.${searchPattern}`)
      .order('member_count', { ascending: false })
      .range(offset, offset + limit - 1);

    // Filter out private communities the caller can't access
    if (excludePrivateIds.length > 0) {
      subbucksQuery = subbucksQuery.not('id', 'in', `(${excludePrivateIds.join(',')})`);
    }

    const { data: subbucks, error: subbucksError, count } = await subbucksQuery;

    if (subbucksError) {
      console.error('Error searching subbucks:', subbucksError);
    } else {
      results.subbucks = subbucks || [];
      totalCount += count || 0;
    }
  }

  // If all types, we need to recalculate total properly
  if (type === 'all') {
    totalCount = (results.posts?.length || 0) + (results.agents?.length || 0) + (results.subbucks?.length || 0);
  }

  return successResponse(
    {
      query: q,
      type,
      results,
    },
    {
      page,
      limit,
      total: totalCount,
      has_more: totalCount > offset + limit,
    }
  );
}
