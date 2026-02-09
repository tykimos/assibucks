import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import {
  authenticateApiKey,
  extractApiKeyFromHeader,
  checkRateLimit,
  getRateLimitHeaders,
} from '@/lib/auth';
import {
  successResponse,
  createdResponse,
  unauthorizedResponse,
  validationErrorResponse,
  conflictResponse,
  internalErrorResponse,
  rateLimitedResponse,
} from '@/lib/api';
import { createSubbucksSchema, paginationSchema } from '@/lib/api/validation';

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

  // Determine caller for visibility filtering
  const apiKey = extractApiKeyFromHeader(request.headers.get('authorization'));
  let callerAgentId: string | null = null;
  let callerObserverId: string | null = null;

  if (apiKey) {
    const agent = await authenticateApiKey(apiKey);
    if (agent) callerAgentId = agent.id;
  } else {
    const supabaseClient = await createClient();
    const { data: { user } } = await supabaseClient.auth.getUser();
    console.log('[DEBUG] GET /api/v1/subbucks - User from session:', user?.id);
    if (user) callerObserverId = user.id;
  }

  const supabase = createAdminClient();

  // Get private subbucks where caller is a member
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
    console.log('[DEBUG] GET /api/v1/subbucks - Total memberships:', memberships?.length);
    if (memberships && memberships.length > 0) {
      const ids = memberships.map(m => m.submolt_id);
      const { data: privates, error: privError } = await supabase
        .from('submolts')
        .select('id')
        .in('id', ids)
        .eq('visibility', 'private');
      // If visibility column doesn't exist yet, treat as no private communities
      memberPrivateIds = privError ? [] : (privates || []).map((s: any) => s.id);
      console.log('[DEBUG] GET /api/v1/subbucks - Private subbucks IDs:', memberPrivateIds);
    }
  }

  // Query subbucks - try with visibility filter, fall back without if column doesn't exist
  let query = supabase
    .from('submolts')
    .select('*', { count: 'exact' })
    .eq('is_active', true)
    .order('member_count', { ascending: false })
    .range(offset, offset + limit - 1);

  // First try: with visibility filtering (post-migration)
  // Show: public, restricted, null visibility, and private where user is a member
  let filteredQuery = supabase
    .from('submolts')
    .select('*', { count: 'exact' })
    .eq('is_active', true);

  if (memberPrivateIds.length > 0) {
    // Show non-private OR private where user is member
    filteredQuery = filteredQuery.or(`visibility.is.null,visibility.neq.private,id.in.(${memberPrivateIds.join(',')})`);
  } else {
    // Show only non-private
    filteredQuery = filteredQuery.or('visibility.is.null,visibility.neq.private');
  }

  filteredQuery = filteredQuery
    .order('member_count', { ascending: false })
    .range(offset, offset + limit - 1);

  let { data: subbucks, error, count } = await filteredQuery;

  if (error) {
    // Visibility column may not exist yet - fall back to unfiltered query
    const fallback = await query;
    subbucks = fallback.data;
    error = fallback.error;
    count = fallback.count;
  }

  if (error) {
    console.error('Error fetching subbucks:', error);
    return internalErrorResponse('Failed to fetch subbucks');
  }

  return successResponse(
    { subbucks },
    {
      page,
      limit,
      total: count || 0,
      has_more: (count || 0) > offset + limit,
    }
  );
}

export async function POST(request: NextRequest) {
  // Try API key auth first (for AI agents)
  const apiKey = extractApiKeyFromHeader(request.headers.get('authorization'));
  let agent = null;
  let userId = null;
  let rateLimitHeaders: Record<string, string> = {};

  if (apiKey) {
    agent = await authenticateApiKey(apiKey);
    if (!agent) {
      return unauthorizedResponse();
    }

    const rateLimitResult = await checkRateLimit(agent.id, 'general');
    rateLimitHeaders = getRateLimitHeaders(rateLimitResult);

    if (!rateLimitResult.allowed) {
      return rateLimitedResponse(rateLimitResult.resetAt, rateLimitHeaders);
    }
  } else {
    // Try session auth (for logged-in humans)
    const supabaseClient = await createClient();
    const { data: { user } } = await supabaseClient.auth.getUser();

    if (!user) {
      return unauthorizedResponse();
    }
    userId = user.id;
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return validationErrorResponse('Invalid JSON body');
  }

  const parsed = createSubbucksSchema.safeParse(body);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error.issues[0].message, rateLimitHeaders);
  }

  const { slug, name, description, rules, icon_url, banner_url, visibility, allow_member_invites } = parsed.data;
  const supabase = createAdminClient();

  // Check if slug already exists
  const { data: existing } = await supabase
    .from('submolts')
    .select('id')
    .eq('slug', slug)
    .single();

  if (existing) {
    return conflictResponse(`Subbucks "b/${slug}" already exists`, rateLimitHeaders);
  }

  // Create subbucks - with agent_id if agent, or observer_id if human
  const insertData: Record<string, unknown> = {
    slug,
    name,
    description,
    rules,
    icon_url,
    banner_url,
    visibility,
    allow_member_invites,
  };

  if (agent) {
    insertData.creator_agent_id = agent.id;
  } else if (userId) {
    insertData.creator_observer_id = userId;
  }

  const { data: subbucks, error } = await supabase
    .from('submolts')
    .insert(insertData)
    .select()
    .single();

  if (error) {
    console.error('Error creating subbucks:', error);
    return internalErrorResponse('Failed to create subbucks');
  }

  // Add creator as a member with owner role
  const memberData: Record<string, unknown> = {
    submolt_id: subbucks.id,
    role: 'owner',
    member_type: agent ? 'agent' : 'human',
  };

  if (agent) {
    memberData.agent_id = agent.id;
  } else if (userId) {
    memberData.observer_id = userId;
  }

  await supabase.from('submolt_members').insert(memberData);

  return createdResponse({ subbucks }, rateLimitHeaders);
}
