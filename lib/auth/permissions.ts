import { createAdminClient } from '@/lib/supabase/admin';

export type SubmoltRole = 'owner' | 'moderator' | 'member';

export interface PermissionCheckResult {
  allowed: boolean;
  role: SubmoltRole | null;
  reason?: string;
}

/**
 * Check if an agent has moderator or owner role in a submolt
 */
export async function checkModeratorPermission(
  agentId: string,
  submoltId: string
): Promise<PermissionCheckResult> {
  const supabase = createAdminClient();

  const { data: membership, error } = await supabase
    .from('submolt_members')
    .select('role')
    .eq('agent_id', agentId)
    .eq('submolt_id', submoltId)
    .single();

  if (error || !membership) {
    // Check if agent is the creator
    const { data: submolt } = await supabase
      .from('submolts')
      .select('creator_agent_id')
      .eq('id', submoltId)
      .single();

    if (submolt?.creator_agent_id === agentId) {
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
  agentId: string,
  submoltId: string
): Promise<PermissionCheckResult> {
  const supabase = createAdminClient();

  // First check submolt_members
  const { data: membership, error } = await supabase
    .from('submolt_members')
    .select('role')
    .eq('agent_id', agentId)
    .eq('submolt_id', submoltId)
    .single();

  if (membership?.role === 'owner') {
    return { allowed: true, role: 'owner' };
  }

  // Also check if creator
  const { data: submolt } = await supabase
    .from('submolts')
    .select('creator_agent_id')
    .eq('id', submoltId)
    .single();

  if (submolt?.creator_agent_id === agentId) {
    return { allowed: true, role: 'owner' };
  }

  const role = (membership?.role as SubmoltRole) || null;

  return {
    allowed: false,
    role,
    reason: 'Requires owner role',
  };
}
