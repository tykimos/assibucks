import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import {
  authenticateApiKey,
  extractApiKeyFromHeader,
} from '@/lib/auth';
import {
  successResponse,
  createdResponse,
  unauthorizedResponse,
  validationErrorResponse,
  notFoundResponse,
  forbiddenResponse,
  internalErrorResponse,
} from '@/lib/api';
import { createBanSchema, paginationSchema } from '@/lib/api/validation';
import { checkModeratorPermission, type SubmoltRole } from '@/lib/auth/permissions';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  // Auth
  const apiKey = extractApiKeyFromHeader(request.headers.get('authorization'));
  let agentId: string | null = null;
  let observerId: string | null = null;

  if (apiKey) {
    const agent = await authenticateApiKey(apiKey);
    if (!agent) return unauthorizedResponse();
    agentId = agent.id;
  } else {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return unauthorizedResponse();
    observerId = user.id;
  }

  // Parse body
  let body;
  try {
    body = await request.json();
  } catch {
    return validationErrorResponse('Invalid JSON body');
  }

  const parsed = createBanSchema.safeParse(body);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error.issues[0].message);
  }

  const { target_type, target_name, target_id, reason, duration_days } = parsed.data;
  const admin = createAdminClient();

  // Find subbucks
  const { data: subbucks, error: subbucksError } = await admin
    .from('submolts')
    .select('id')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (subbucksError || !subbucks) {
    return notFoundResponse(`Subbucks "b/${slug}" not found`);
  }

  // Check moderator permission
  const { allowed, role: callerRole } = await checkModeratorPermission(
    agentId,
    subbucks.id,
    observerId
  );
  if (!allowed) {
    return forbiddenResponse('You must be a moderator or owner to ban users');
  }

  // Resolve target user
  let resolvedTargetId: string | null = null;

  if (target_id) {
    resolvedTargetId = target_id;
  } else if (target_name) {
    if (target_type === 'agent') {
      const { data: agent } = await admin
        .from('agents')
        .select('id')
        .eq('name', target_name)
        .single();
      if (!agent) {
        return notFoundResponse(`Agent "${target_name}" not found`);
      }
      resolvedTargetId = agent.id;
    } else {
      const { data: observer } = await admin
        .from('observers')
        .select('id')
        .eq('display_name', target_name)
        .single();
      if (!observer) {
        return notFoundResponse(`User "${target_name}" not found`);
      }
      resolvedTargetId = observer.id;
    }
  } else {
    return validationErrorResponse('Either target_id or target_name must be provided');
  }

  // Check if target is owner or higher/equal role
  const { data: targetMember } = await admin
    .from('submolt_members')
    .select('role')
    .eq('submolt_id', subbucks.id)
    .eq(target_type === 'agent' ? 'agent_id' : 'observer_id', resolvedTargetId)
    .single();

  if (targetMember) {
    const targetRole = targetMember.role as SubmoltRole;
    if (targetRole === 'owner') {
      return forbiddenResponse('Cannot ban the owner');
    }
    if (callerRole === 'moderator' && targetRole === 'moderator') {
      return forbiddenResponse('Moderators cannot ban other moderators');
    }
  }

  // Remove from members if present
  await admin
    .from('submolt_members')
    .delete()
    .eq('submolt_id', subbucks.id)
    .eq(target_type === 'agent' ? 'agent_id' : 'observer_id', resolvedTargetId);

  // Create ban
  const isPermanent = duration_days === null;
  const expiresAt = duration_days
    ? new Date(Date.now() + duration_days * 24 * 60 * 60 * 1000).toISOString()
    : null;

  const banData: {
    submolt_id: string;
    banned_type: string;
    agent_id?: string;
    observer_id?: string;
    reason?: string;
    banned_by_agent_id?: string;
    banned_by_observer_id?: string;
    is_permanent: boolean;
    expires_at?: string | null;
  } = {
    submolt_id: subbucks.id,
    banned_type: target_type,
    reason,
    is_permanent: isPermanent,
    expires_at: expiresAt,
  };

  if (target_type === 'agent') {
    banData.agent_id = resolvedTargetId!;
  } else {
    banData.observer_id = resolvedTargetId!;
  }

  if (agentId) {
    banData.banned_by_agent_id = agentId;
  } else {
    banData.banned_by_observer_id = observerId!;
  }

  const { data: ban, error: banError } = await admin
    .from('subbucks_bans')
    .insert(banData)
    .select(
      `
      id,
      banned_type,
      reason,
      is_permanent,
      expires_at,
      created_at,
      agent:agents(id, name, display_name, avatar_url),
      observer:observers(id, display_name, avatar_url)
    `
    )
    .single();

  if (banError) {
    console.error('Error creating ban:', banError);
    return internalErrorResponse('Failed to create ban');
  }

  return createdResponse({
    ban: {
      id: ban.id,
      target_type: ban.banned_type,
      target: ban.agent || ban.observer,
      reason: ban.reason,
      is_permanent: ban.is_permanent,
      expires_at: ban.expires_at,
      created_at: ban.created_at,
    },
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const { searchParams } = new URL(request.url);

  // Auth
  const apiKey = extractApiKeyFromHeader(request.headers.get('authorization'));
  let agentId: string | null = null;
  let observerId: string | null = null;

  if (apiKey) {
    const agent = await authenticateApiKey(apiKey);
    if (!agent) return unauthorizedResponse();
    agentId = agent.id;
  } else {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return unauthorizedResponse();
    observerId = user.id;
  }

  const parsed = paginationSchema.safeParse({
    page: searchParams.get('page'),
    limit: searchParams.get('limit'),
  });

  if (!parsed.success) {
    return validationErrorResponse(parsed.error.issues[0].message);
  }

  const { page, limit } = parsed.data;
  const offset = (page - 1) * limit;

  const admin = createAdminClient();

  // Find subbucks
  const { data: subbucks, error: subbucksError } = await admin
    .from('submolts')
    .select('id')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (subbucksError || !subbucks) {
    return notFoundResponse(`Subbucks "b/${slug}" not found`);
  }

  // Check moderator permission
  const { allowed } = await checkModeratorPermission(agentId, subbucks.id, observerId);
  if (!allowed) {
    return forbiddenResponse('You must be a moderator or owner to view bans');
  }

  // Get bans
  const { data: bans, error, count } = await admin
    .from('subbucks_bans')
    .select(
      `
      id,
      banned_type,
      reason,
      is_permanent,
      expires_at,
      created_at,
      agent:agents(id, name, display_name, avatar_url),
      observer:observers(id, display_name, avatar_url),
      banned_by_agent:banned_by_agent_id(id, name, display_name, avatar_url),
      banned_by_observer:banned_by_observer_id(id, display_name, avatar_url)
    `,
      { count: 'exact' }
    )
    .eq('submolt_id', subbucks.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('Error fetching bans:', error);
    return internalErrorResponse('Failed to fetch bans');
  }

  const formattedBans = bans?.map((ban) => ({
    id: ban.id,
    target_type: ban.banned_type,
    target: ban.agent || ban.observer,
    reason: ban.reason,
    is_permanent: ban.is_permanent,
    expires_at: ban.expires_at,
    created_at: ban.created_at,
    banned_by: ban.banned_by_agent || ban.banned_by_observer,
  })) || [];

  return successResponse(
    { bans: formattedBans },
    {
      page,
      limit,
      total: count || 0,
      has_more: (count || 0) > offset + limit,
    }
  );
}
