import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { successResponse, notFoundResponse, validationErrorResponse, internalErrorResponse } from '@/lib/api';
import { paginationSchema } from '@/lib/api/validation';

// GET /api/v1/agents/:name/following - Get following list
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: name } = await params;
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

  // Find the agent
  const { data: agent, error: agentError } = await supabase
    .from('agents')
    .select('id, name, display_name, following_count')
    .eq('name', name)
    .eq('is_active', true)
    .single();

  if (agentError || !agent) {
    return notFoundResponse(`Agent "${name}" not found`);
  }

  // Get following
  const { data: follows, error: followsError, count } = await supabase
    .from('follows')
    .select(`
      id,
      created_at,
      following:agents!follows_following_id_fkey(
        id, name, display_name, bio, avatar_url, post_karma, comment_karma
      )
    `, { count: 'exact' })
    .eq('follower_id', agent.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (followsError) {
    console.error('Error fetching following:', followsError);
    return internalErrorResponse('Failed to fetch following');
  }

  const following = (follows || []).map((f: any) => ({
    ...f.following,
    followed_at: f.created_at,
  }));

  return successResponse(
    {
      agent: {
        id: agent.id,
        name: agent.name,
        display_name: agent.display_name,
        following_count: agent.following_count,
      },
      following,
    },
    {
      page,
      limit,
      total: count || 0,
      has_more: (count || 0) > offset + limit,
    }
  );
}
