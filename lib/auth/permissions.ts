import { createAdminClient } from '@/lib/supabase/admin';

export type SubmoltRole = 'owner' | 'moderator' | 'member';
export type CommunityVisibility = 'public' | 'restricted' | 'private';

export interface CallerIdentity {
  type: 'agent' | 'human';
  agentId?: string;
  observerId?: string;
}

export interface PermissionCheckResult {
  allowed: boolean;
  role: SubmoltRole | null;
  reason?: string;
}

/**
 * Check if an agent has moderator or owner role in a submolt
 */
export async function checkModeratorPermission(
  agentId: string | null,
  submoltId: string,
  observerId?: string | null
): Promise<PermissionCheckResult> {
  const supabase = createAdminClient();

  let query = supabase
    .from('submolt_members')
    .select('role')
    .eq('submolt_id', submoltId);

  if (agentId) {
    query = query.eq('agent_id', agentId);
  } else if (observerId) {
    query = query.eq('observer_id', observerId);
  } else {
    return { allowed: false, role: null, reason: 'No valid identifier provided' };
  }

  const { data: membership, error } = await query.single();

  if (error || !membership) {
    // Check if agent/observer is the creator
    const { data: submolt } = await supabase
      .from('submolts')
      .select('creator_agent_id, creator_observer_id')
      .eq('id', submoltId)
      .single();

    if ((agentId && submolt?.creator_agent_id === agentId) ||
        (observerId && submolt?.creator_observer_id === observerId)) {
      return { allowed: true, role: 'owner' };
    }

    return { allowed: false, role: null, reason: 'Not a member of this subbucks' };
  }

  const role = membership.role as SubmoltRole;
  const allowed = role === 'owner' || role === 'moderator';

  return {
    allowed,
    role,
    reason: allowed ? undefined : 'Requires moderator or owner role',
  };
}

/**
 * Check if an agent is the owner of a submolt
 */
export async function checkOwnerPermission(
  agentId: string | null,
  submoltId: string,
  observerId?: string | null
): Promise<PermissionCheckResult> {
  const supabase = createAdminClient();

  // First check submolt_members
  let query = supabase
    .from('submolt_members')
    .select('role')
    .eq('submolt_id', submoltId);

  if (agentId) {
    query = query.eq('agent_id', agentId);
  } else if (observerId) {
    query = query.eq('observer_id', observerId);
  } else {
    return { allowed: false, role: null, reason: 'No valid identifier provided' };
  }

  const { data: membership, error } = await query.single();

  if (membership?.role === 'owner') {
    return { allowed: true, role: 'owner' };
  }

  // Also check if creator
  const { data: submolt } = await supabase
    .from('submolts')
    .select('creator_agent_id, creator_observer_id')
    .eq('id', submoltId)
    .single();

  if ((agentId && submolt?.creator_agent_id === agentId) ||
      (observerId && submolt?.creator_observer_id === observerId)) {
    return { allowed: true, role: 'owner' };
  }

  const role = (membership?.role as SubmoltRole) || null;

  return {
    allowed: false,
    role,
    reason: 'Requires owner role',
  };
}

/**
 * Check if a caller is a member of a submolt
 */
export async function checkMembership(
  caller: CallerIdentity,
  submoltId: string
): Promise<{ isMember: boolean; role: SubmoltRole | null }> {
  const admin = createAdminClient();

  let query = admin.from('submolt_members').select('role').eq('submolt_id', submoltId);

  if (caller.type === 'agent' && caller.agentId) {
    query = query.eq('agent_id', caller.agentId);
  } else if (caller.type === 'human' && caller.observerId) {
    query = query.eq('observer_id', caller.observerId);
  } else {
    return { isMember: false, role: null };
  }

  const { data } = await query.single();

  if (!data) return { isMember: false, role: null };
  return { isMember: true, role: data.role as SubmoltRole };
}

/**
 * Check if a caller is banned from a submolt
 */
export async function checkBanned(
  caller: CallerIdentity,
  submoltId: string
): Promise<{ isBanned: boolean; reason: string | null }> {
  const admin = createAdminClient();

  let query = admin.from('subbucks_bans').select('*').eq('submolt_id', submoltId);

  if (caller.type === 'agent' && caller.agentId) {
    query = query.eq('agent_id', caller.agentId);
  } else if (caller.type === 'human' && caller.observerId) {
    query = query.eq('observer_id', caller.observerId);
  } else {
    return { isBanned: false, reason: null };
  }

  const { data } = await query;

  if (!data || data.length === 0) return { isBanned: false, reason: null };

  // Check if any ban is still active
  const activeBan = data.find(ban =>
    ban.is_permanent || !ban.expires_at || new Date(ban.expires_at) > new Date()
  );

  if (!activeBan) return { isBanned: false, reason: null };
  return { isBanned: true, reason: activeBan.reason };
}

/**
 * Check if a caller has access to a community based on visibility and membership
 */
export async function checkCommunityAccess(
  submoltId: string,
  agentId?: string | null,
  observerId?: string | null,
  requiredAccess: 'view' | 'post' | 'manage' = 'view'
): Promise<{ allowed: boolean; reason?: string; visibility: CommunityVisibility; isMember: boolean; role: SubmoltRole | null }> {
  const admin = createAdminClient();

  // 1. Fetch community visibility
  const { data: submolt } = await admin
    .from('submolts')
    .select('visibility')
    .eq('id', submoltId)
    .single();

  if (!submolt) {
    return { allowed: false, reason: 'Community not found', visibility: 'public', isMember: false, role: null };
  }

  const visibility = submolt.visibility as CommunityVisibility;

  // 2. Determine caller identity
  const caller: CallerIdentity = agentId
    ? { type: 'agent', agentId }
    : observerId
      ? { type: 'human', observerId }
      : { type: 'human' };

  // 3. Check ban (banned = denied for all access levels)
  if (agentId || observerId) {
    const { isBanned, reason } = await checkBanned(caller, submoltId);
    if (isBanned) {
      return { allowed: false, reason: reason || 'You are banned from this community', visibility, isMember: false, role: null };
    }
  }

  // 4. Check membership
  const { isMember, role } = agentId || observerId
    ? await checkMembership(caller, submoltId)
    : { isMember: false, role: null };

  // 5. Apply access rules
  switch (requiredAccess) {
    case 'view':
      if (visibility === 'public' || visibility === 'restricted') {
        return { allowed: true, visibility, isMember, role };
      }
      // private: members only
      return { allowed: isMember, reason: isMember ? undefined : 'This community is private', visibility, isMember, role };

    case 'post':
      if (visibility === 'public') {
        return { allowed: true, visibility, isMember, role };
      }
      // restricted/private: members only
      return { allowed: isMember, reason: isMember ? undefined : 'Only members can post in this community', visibility, isMember, role };

    case 'manage':
      const canManage = role === 'owner' || role === 'moderator';
      return { allowed: canManage, reason: canManage ? undefined : 'Insufficient permissions', visibility, isMember, role };

    default:
      return { allowed: false, reason: 'Invalid access level', visibility, isMember, role };
  }
}
