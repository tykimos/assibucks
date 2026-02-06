import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import {
  authenticateApiKey,
  extractApiKeyFromHeader,
} from '@/lib/auth';
import {
  successResponse,
  notFoundResponse,
  internalErrorResponse,
  forbiddenResponse,
  unauthorizedResponse,
  validationErrorResponse,
} from '@/lib/api';
import { paginationSchema, updateSubbucksSchema } from '@/lib/api/validation';
import {
  checkCommunityAccess,
  checkOwnerPermission,
} from '@/lib/auth/permissions';

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

  // Get subbucks
  const { data: subbucks, error: subbucksError } = await supabase
    .from('submolts')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (subbucksError || !subbucks) {
    return notFoundResponse(`Subbucks "b/${slug}" not found`);
  }

  // Determine caller identity
  const apiKey = extractApiKeyFromHeader(request.headers.get('authorization'));
  let callerAgentId: string | null = null;
  let callerObserverId: string | null = null;

  if (apiKey) {
    const agent = await authenticateApiKey(apiKey);
    if (agent) callerAgentId = agent.id;
  } else {
    const supabaseClient = await createClient();
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (user) callerObserverId = user.id;
  }

  // Check community access
  const accessCheck = await checkCommunityAccess(
    subbucks.id,
    callerAgentId,
    callerObserverId,
    'view'
  );

  // If private and not allowed, return limited data
  if (!accessCheck.allowed && accessCheck.visibility === 'private') {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: accessCheck.reason || 'This community is private',
        },
        data: {
          subbucks: {
            slug: subbucks.slug,
            name: subbucks.name,
            description: subbucks.description,
            visibility: subbucks.visibility,
            member_count: subbucks.member_count,
            icon_url: subbucks.icon_url,
          },
        },
      },
      { status: 403 }
    );
  }

  // Get posts
  const { data: posts, error: postsError, count } = await supabase
    .from('posts')
    .select(
      `
      *,
      agent:agents(id, name, display_name, avatar_url, post_karma, comment_karma, is_active, created_at),
      observer:observers(id, display_name, avatar_url, created_at)
    `,
      { count: 'exact' }
    )
    .eq('submolt_id', subbucks.id)
    .eq('is_deleted', false)
    .order('hot_score', { ascending: false })
    .range(offset, offset + limit - 1);

  if (postsError) {
    console.error('Error fetching posts:', postsError);
    return internalErrorResponse('Failed to fetch posts');
  }

  // Get moderators (both agents and observers with owner/moderator role)
  const { data: moderators } = await supabase
    .from('submolt_members')
    .select(
      `
      role,
      agent:agents(id, name, display_name, avatar_url),
      observer:observers(id, display_name, avatar_url)
    `
    )
    .eq('submolt_id', subbucks.id)
    .in('role', ['owner', 'moderator']);

  // Determine if caller can post
  const canPost = accessCheck.visibility === 'public' || accessCheck.isMember;

  return successResponse(
    {
      subbucks: {
        ...subbucks,
        visibility: subbucks.visibility,
        is_member: accessCheck.isMember,
        can_post: canPost,
      },
      posts: posts?.map((post) => ({
        ...post,
        subbucks: {
          id: subbucks.id,
          slug: subbucks.slug,
          name: subbucks.name,
        },
      })) || [],
      moderators: moderators?.map((m) => m.agent || m.observer).filter(Boolean) || [],
    },
    {
      page,
      limit,
      total: count || 0,
      has_more: (count || 0) > offset + limit,
    }
  );
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  // Authenticate caller
  const apiKey = extractApiKeyFromHeader(request.headers.get('authorization'));
  let callerAgentId: string | null = null;
  let callerObserverId: string | null = null;

  if (apiKey) {
    const agent = await authenticateApiKey(apiKey);
    if (!agent) return unauthorizedResponse();
    callerAgentId = agent.id;
  } else {
    const supabaseClient = await createClient();
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return unauthorizedResponse();
    callerObserverId = user.id;
  }

  const supabase = createAdminClient();

  // Get subbucks
  const { data: subbucks, error: subbucksError } = await supabase
    .from('submolts')
    .select('id')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (subbucksError || !subbucks) {
    return notFoundResponse(`Subbucks "b/${slug}" not found`);
  }

  // Check owner permission
  const ownerCheck = await checkOwnerPermission(
    callerAgentId,
    subbucks.id,
    callerObserverId
  );

  if (!ownerCheck.allowed) {
    return forbiddenResponse(ownerCheck.reason || 'Only owners can modify community settings');
  }

  // Parse and validate request body
  let body;
  try {
    body = await request.json();
  } catch {
    return validationErrorResponse('Invalid JSON body');
  }

  const parsed = updateSubbucksSchema.safeParse(body);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error.issues[0].message);
  }

  // Update subbucks
  const { visibility, allow_member_invites } = parsed.data;
  const updateData: Record<string, unknown> = {};

  if (visibility !== undefined) {
    updateData.visibility = visibility;
  }
  if (allow_member_invites !== undefined) {
    updateData.allow_member_invites = allow_member_invites;
  }

  const { data: updatedSubbucks, error } = await supabase
    .from('submolts')
    .update(updateData)
    .eq('id', subbucks.id)
    .select()
    .single();

  if (error) {
    console.error('Error updating subbucks:', error);
    return internalErrorResponse('Failed to update subbucks');
  }

  return successResponse({ subbucks: updatedSubbucks });
}
