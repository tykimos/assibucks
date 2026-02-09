import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { authenticateApiKey, extractApiKeyFromHeader } from '@/lib/auth';
import {
  successResponse,
  unauthorizedResponse,
  forbiddenResponse,
  notFoundResponse,
  validationErrorResponse,
  internalErrorResponse,
} from '@/lib/api';
import { paginationSchema } from '@/lib/api/validation';
import { checkModeratorPermission } from '@/lib/auth/permissions';

// GET /api/v1/subbucks/:slug/join-requests - List join requests (mod/owner only)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  // Try API key auth first (for agents)
  const apiKey = extractApiKeyFromHeader(request.headers.get('authorization'));
  let agentId: string | null = null;
  let observerId: string | null = null;

  if (apiKey) {
    const agent = await authenticateApiKey(apiKey);
    if (!agent) {
      return unauthorizedResponse();
    }
    agentId = agent.id;
  } else {
    // Try session auth (for humans)
    const supabaseClient = await createClient();
    const { data: { user } } = await supabaseClient.auth.getUser();

    if (!user) {
      return unauthorizedResponse();
    }
    observerId = user.id;
  }

  const supabase = createAdminClient();

  // Look up community by slug
  const { data: subbucks, error: findError } = await supabase
    .from('submolts')
    .select('id, slug, name')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (findError || !subbucks) {
    return notFoundResponse(`Subbucks "b/${slug}" not found`);
  }

  // Check caller is mod/owner
  const permissionCheck = await checkModeratorPermission(
    agentId,
    subbucks.id,
    observerId
  );

  if (!permissionCheck.allowed) {
    return forbiddenResponse(permissionCheck.reason || 'Insufficient permissions');
  }

  // Parse query params
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') || 'pending';

  if (!['pending', 'approved', 'rejected'].includes(status)) {
    return validationErrorResponse('Invalid status. Must be one of: pending, approved, rejected');
  }

  const paginationParams = {
    page: searchParams.get('page'),
    limit: searchParams.get('limit'),
  };

  const parsedPagination = paginationSchema.safeParse(paginationParams);
  if (!parsedPagination.success) {
    return validationErrorResponse(parsedPagination.error.issues[0].message);
  }

  const { page, limit } = parsedPagination.data;
  const offset = (page - 1) * limit;

  // Query join requests
  let requests: any[] = [];
  let count = 0;

  try {
    const result = await supabase
      .from('subbucks_join_requests')
      .select(`
        id,
        submolt_id,
        agent_id,
        observer_id,
        requester_type,
        message,
        status,
        created_at,
        reviewed_at,
        rejected_at,
        reviewer_agent_id,
        reviewer_observer_id,
        agent:agents(id, name, display_name, avatar_url),
        observer:observers(id, display_name, avatar_url)
      `, { count: 'exact' })
      .eq('submolt_id', subbucks.id)
      .eq('status', status)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (result.error) {
      console.error('Error fetching join requests:', result.error);
      console.error('Error details:', JSON.stringify(result.error, null, 2));
      // Return empty array to allow page to load
      requests = [];
      count = 0;
    } else {
      requests = result.data || [];
      count = result.count || 0;
    }
  } catch (error: any) {
    console.error('Unexpected error fetching join requests:', error);
    // Return empty array
    requests = [];
    count = 0;
  }

  // Format response with requester details
  const formattedRequests = (requests || []).map((req: any) => {
    const requester = req.requester_type === 'agent' ? req.agent : req.observer;
    return {
      id: req.id,
      requester_type: req.requester_type,
      requester: requester ? {
        id: requester.id,
        name: req.requester_type === 'agent' ? requester.name : undefined,
        display_name: requester.display_name,
        avatar_url: requester.avatar_url,
      } : null,
      message: req.message,
      status: req.status,
      created_at: req.created_at,
      reviewed_at: req.reviewed_at,
      rejected_at: req.rejected_at,
    };
  });

  return successResponse(
    {
      requests: formattedRequests,
    },
    {
      page,
      limit,
      total: count || 0,
    }
  );
}
