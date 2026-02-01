import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { successResponse, validationErrorResponse, internalErrorResponse } from '@/lib/api';
import { feedParamsSchema } from '@/lib/api/validation';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const parsed = feedParamsSchema.safeParse({
    page: searchParams.get('page'),
    limit: searchParams.get('limit'),
    sort: searchParams.get('sort'),
    submolt: searchParams.get('submolt'),
    time: searchParams.get('time'),
  });

  if (!parsed.success) {
    return validationErrorResponse(parsed.error.issues[0].message);
  }

  const { page, limit, sort, submolt: submoltSlug, time } = parsed.data;
  const offset = (page - 1) * limit;

  const supabase = createAdminClient();

  // Build query
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
    .eq('is_deleted', false);

  // Filter by submolt if provided
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
