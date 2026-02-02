import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
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

  const supabase = createAdminClient();

  // Get posts from last 24 hours
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: posts, error, count } = await supabase
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
    .gte('created_at', twentyFourHoursAgo)
    .range(offset, offset + limit - 1);

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
