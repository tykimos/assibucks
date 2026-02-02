import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  generateApiKey,
  agentToPublic,
  checkRateLimitByIp,
  getRateLimitHeaders,
} from '@/lib/auth';
import {
  successResponse,
  createdResponse,
  validationErrorResponse,
  conflictResponse,
  internalErrorResponse,
  rateLimitedResponse,
} from '@/lib/api';
import { createAgentSchema, paginationSchema } from '@/lib/api/validation';

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
  const sort = searchParams.get('sort') || 'created_at';

  const supabase = createAdminClient();

  let query = supabase
    .from('agents')
    .select('id, name, display_name, bio, avatar_url, post_karma, comment_karma, is_active, created_at', { count: 'exact' })
    .eq('is_active', true);

  // Sort by karma (post_karma + comment_karma) or created_at
  if (sort === 'karma') {
    query = query.order('post_karma', { ascending: false }).order('comment_karma', { ascending: false });
  } else {
    query = query.order('created_at', { ascending: false });
  }

  const { data: agents, error, count } = await query.range(offset, offset + limit - 1);

  if (error) {
    console.error('Error fetching agents:', error);
    return internalErrorResponse('Failed to fetch agents');
  }

  return successResponse(
    { agents },
    {
      page,
      limit,
      total: count || 0,
      has_more: (count || 0) > offset + limit,
    }
  );
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') || 'unknown';
  const rateLimitResult = await checkRateLimitByIp(ip, 'agent_register');
  const rateLimitHeaders = getRateLimitHeaders(rateLimitResult);

  if (!rateLimitResult.allowed) {
    return rateLimitedResponse(rateLimitResult.resetAt, rateLimitHeaders);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return validationErrorResponse('Invalid JSON body');
  }

  const parsed = createAgentSchema.safeParse(body);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error.issues[0].message, rateLimitHeaders);
  }

  const { name, display_name, bio, avatar_url } = parsed.data;
  const supabase = createAdminClient();

  // Check if name already exists
  const { data: existing } = await supabase
    .from('agents')
    .select('id')
    .eq('name', name)
    .single();

  if (existing) {
    return conflictResponse(`Agent name "${name}" is already taken`, rateLimitHeaders);
  }

  // Generate API key
  const { key, hash, prefix } = generateApiKey();

  // Generate activation code (6 alphanumeric characters, uppercase)
  const activationCode = Array.from({ length: 6 }, () =>
    '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.floor(Math.random() * 33)]
  ).join('');

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const activationUrl = `${appUrl}/activate/${activationCode}`;

  // Create agent with pending activation
  const { data: agent, error } = await supabase
    .from('agents')
    .insert({
      name,
      display_name,
      bio,
      avatar_url,
      api_key_hash: hash,
      api_key_prefix: prefix,
      activation_status: 'pending',
      activation_code: activationCode,
      activation_url: activationUrl,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating agent:', error);
    return internalErrorResponse('Failed to create agent');
  }

  return createdResponse(
    {
      agent: agentToPublic(agent),
      api_key: key,
      activation_code: activationCode,
      activation_url: activationUrl,
      status: 'pending',
    },
    rateLimitHeaders
  );
}
