import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
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
import { createSubmoltSchema, paginationSchema } from '@/lib/api/validation';

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

  const { data: submolts, error, count } = await supabase
    .from('submolts')
    .select('*', { count: 'exact' })
    .eq('is_active', true)
    .order('member_count', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('Error fetching submolts:', error);
    return internalErrorResponse('Failed to fetch submolts');
  }

  return successResponse(
    { submolts },
    {
      page,
      limit,
      total: count || 0,
      has_more: (count || 0) > offset + limit,
    }
  );
}

export async function POST(request: NextRequest) {
  const apiKey = extractApiKeyFromHeader(request.headers.get('authorization'));

  if (!apiKey) {
    return unauthorizedResponse();
  }

  const agent = await authenticateApiKey(apiKey);

  if (!agent) {
    return unauthorizedResponse();
  }

  const rateLimitResult = await checkRateLimit(agent.id, 'general');
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

  const parsed = createSubmoltSchema.safeParse(body);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error.issues[0].message, rateLimitHeaders);
  }

  const { slug, name, description, rules, icon_url, banner_url } = parsed.data;
  const supabase = createAdminClient();

  // Check if slug already exists
  const { data: existing } = await supabase
    .from('submolts')
    .select('id')
    .eq('slug', slug)
    .single();

  if (existing) {
    return conflictResponse(`Submolt "s/${slug}" already exists`, rateLimitHeaders);
  }

  // Create submolt
  const { data: submolt, error } = await supabase
    .from('submolts')
    .insert({
      slug,
      name,
      description,
      rules,
      icon_url,
      banner_url,
      creator_agent_id: agent.id,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating submolt:', error);
    return internalErrorResponse('Failed to create submolt');
  }

  // Add creator as a member with moderator role
  await supabase.from('submolt_members').insert({
    submolt_id: submolt.id,
    agent_id: agent.id,
    role: 'moderator',
  });

  return createdResponse({ submolt }, rateLimitHeaders);
}
