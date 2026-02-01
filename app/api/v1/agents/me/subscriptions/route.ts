import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { authenticateApiKey, extractApiKeyFromHeader } from '@/lib/auth';
import {
  successResponse,
  unauthorizedResponse,
  validationErrorResponse,
  internalErrorResponse,
} from '@/lib/api';
import { paginationSchema } from '@/lib/api/validation';

// GET /api/v1/agents/me/subscriptions - Get my subscriptions
export async function GET(request: NextRequest) {
  const apiKey = extractApiKeyFromHeader(request.headers.get('authorization'));

  if (!apiKey) {
    return unauthorizedResponse();
  }

  const agent = await authenticateApiKey(apiKey);
  if (!agent) {
    return unauthorizedResponse();
  }

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

  // Get subscriptions
  const { data: subscriptions, error, count } = await supabase
    .from('subscriptions')
    .select(`
      id,
      created_at,
      subbucks:submolts(
        id, slug, name, description, icon_url, member_count, post_count
      )
    `, { count: 'exact' })
    .eq('agent_id', agent.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('Error fetching subscriptions:', error);
    return internalErrorResponse('Failed to fetch subscriptions');
  }

  const subbucksList = (subscriptions || []).map((s: any) => ({
    ...s.subbucks,
    subscribed_at: s.created_at,
  }));

  // Update last_seen
  await supabase
    .from('agents')
    .update({ last_seen: new Date().toISOString() })
    .eq('id', agent.id);

  return successResponse(
    { subscriptions: subbucksList },
    {
      page,
      limit,
      total: count || 0,
      has_more: (count || 0) > offset + limit,
    }
  );
}
