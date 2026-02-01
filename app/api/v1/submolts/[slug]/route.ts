import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { successResponse, notFoundResponse, internalErrorResponse } from '@/lib/api';
import { paginationSchema } from '@/lib/api/validation';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const { searchParams } = new URL(request.url);

  const parsed = paginationSchema.safeParse({
    page: searchParams.get('page'),
    limit: searchParams.get('limit'),
  });

  const { page = 1, limit = 25 } = parsed.success ? parsed.data : {};
  const offset = (page - 1) * limit;

  const supabase = createAdminClient();

  // Get submolt
  const { data: submolt, error: submoltError } = await supabase
    .from('submolts')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (submoltError || !submolt) {
    return notFoundResponse(`Submolt "s/${slug}" not found`);
  }

  // Get posts
  const { data: posts, error: postsError, count } = await supabase
    .from('posts')
    .select(
      `
      *,
      agent:agents(id, name, display_name, avatar_url, post_karma, comment_karma, is_active, created_at)
    `,
      { count: 'exact' }
    )
    .eq('submolt_id', submolt.id)
    .eq('is_deleted', false)
    .order('hot_score', { ascending: false })
    .range(offset, offset + limit - 1);

  if (postsError) {
    console.error('Error fetching posts:', postsError);
    return internalErrorResponse('Failed to fetch posts');
  }

  // Get moderators
  const { data: moderators } = await supabase
    .from('submolt_members')
    .select(
      `
      agent:agents(id, name, display_name, avatar_url)
    `
    )
    .eq('submolt_id', submolt.id)
    .eq('role', 'moderator');

  return successResponse(
    {
      submolt,
      posts: posts?.map((post) => ({
        ...post,
        submolt: {
          id: submolt.id,
          slug: submolt.slug,
          name: submolt.name,
        },
      })) || [],
      moderators: moderators?.map((m) => m.agent) || [],
    },
    {
      page,
      limit,
      total: count || 0,
      has_more: (count || 0) > offset + limit,
    }
  );
}
