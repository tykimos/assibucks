import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import {
  successResponse,
  validationErrorResponse,
  notFoundResponse,
  internalErrorResponse,
  forbiddenResponse,
} from '@/lib/api';
import { paginationSchema } from '@/lib/api/validation';
import { checkCommunityAccess } from '@/lib/auth/permissions';

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

  if (!parsed.success) {
    return validationErrorResponse(parsed.error.issues[0].message);
  }

  const { page, limit } = parsed.data;
  const offset = (page - 1) * limit;
  const roleFilter = searchParams.get('role');

  const supabase = createAdminClient();

  // Find subbucks
  const { data: subbucks, error: subbucksError } = await supabase
    .from('submolts')
    .select('id, visibility')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (subbucksError || !subbucks) {
    return notFoundResponse(`Subbucks "b/${slug}" not found`);
  }

  // Check community access for private communities
  if (subbucks.visibility === 'private') {
    // Try to get auth context
    let agentId: string | null = null;
    let observerId: string | null = null;

    try {
      const sessionSupabase = await createClient();
      const { data: { user } } = await sessionSupabase.auth.getUser();
      if (user) {
        observerId = user.id;
      }
    } catch {
      // No session auth, that's ok
    }

    const { allowed, reason } = await checkCommunityAccess(
      subbucks.id,
      agentId,
      observerId,
      'view'
    );

    if (!allowed) {
      return forbiddenResponse(reason || 'This community is private');
    }
  }

  // Build query
  let query = supabase
    .from('submolt_members')
    .select(
      `
      id,
      role,
      joined_at,
      agent:agents(id, name, display_name, avatar_url, post_karma, comment_karma, is_active, created_at),
      observer:observers(id, display_name, avatar_url, created_at)
    `,
      { count: 'exact' }
    )
    .eq('submolt_id', subbucks.id)
    .order('joined_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (roleFilter) {
    query = query.eq('role', roleFilter);
  }

  const { data: members, error, count } = await query;

  if (error) {
    console.error('Error fetching members:', error);
    return internalErrorResponse('Failed to fetch members');
  }

  // Format response with member_type
  const formattedMembers = members?.map((member) => ({
    id: member.id,
    member_type: member.agent ? 'agent' : 'human',
    role: member.role,
    joined_at: member.joined_at,
    profile: member.agent || member.observer,
  })) || [];

  return successResponse(
    { members: formattedMembers },
    {
      page,
      limit,
      total: count || 0,
      has_more: (count || 0) > offset + limit,
    }
  );
}
