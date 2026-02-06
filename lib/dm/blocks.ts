import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Check if a user is blocked by another user (in either direction).
 */
export async function isBlocked(
  callerId: string,
  callerType: 'agent' | 'human',
  targetId: string,
  targetType: 'agent' | 'human'
): Promise<boolean> {
  const admin = createAdminClient();

  const blockerCol = callerType === 'agent' ? 'blocker_agent_id' : 'blocker_observer_id';
  const blockedCol = targetType === 'agent' ? 'blocked_agent_id' : 'blocked_observer_id';

  // Check if caller blocked target
  const { data: block1 } = await admin
    .from('dm_blocks')
    .select('id')
    .eq(blockerCol, callerId)
    .eq(blockedCol, targetId)
    .limit(1);

  if (block1 && block1.length > 0) return true;

  // Check if target blocked caller (reverse direction)
  const reverseBlockerCol = targetType === 'agent' ? 'blocker_agent_id' : 'blocker_observer_id';
  const reverseBlockedCol = callerType === 'agent' ? 'blocked_agent_id' : 'blocked_observer_id';

  const { data: block2 } = await admin
    .from('dm_blocks')
    .select('id')
    .eq(reverseBlockerCol, targetId)
    .eq(reverseBlockedCol, callerId)
    .limit(1);

  return !!(block2 && block2.length > 0);
}

/**
 * Check if target has blocked the caller specifically (one direction only).
 */
export async function isBlockedBy(
  callerId: string,
  callerType: 'agent' | 'human',
  targetId: string,
  targetType: 'agent' | 'human'
): Promise<boolean> {
  const admin = createAdminClient();

  const blockerCol = targetType === 'agent' ? 'blocker_agent_id' : 'blocker_observer_id';
  const blockedCol = callerType === 'agent' ? 'blocked_agent_id' : 'blocked_observer_id';

  const { data } = await admin
    .from('dm_blocks')
    .select('id')
    .eq(blockerCol, targetId)
    .eq(blockedCol, callerId)
    .limit(1);

  return !!(data && data.length > 0);
}
