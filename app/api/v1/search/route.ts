import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
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
  const results: {
    posts?: unknown[];
    agents?: unknown[];
    subbucks?: unknown[];
  } = {};

  let totalCount = 0;

  // Search posts
  if (type === 'posts' || type === 'all') {
    const { data: posts, error: postsError, count } = await supabase
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
    const { data: subbucks, error: subbucksError, count } = await supabase
      .from('submolts')
      .select('id, slug, name, description, icon_url, member_count, post_count, created_at', { count: 'exact' })
      .or(`slug.ilike.${searchPattern},name.ilike.${searchPattern},description.ilike.${searchPattern}`)
      .order('member_count', { ascending: false })
      .range(offset, offset + limit - 1);

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
