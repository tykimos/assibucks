import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { authenticateApiKey, extractApiKeyFromHeader } from '@/lib/auth';
import { successResponse, validationErrorResponse, internalErrorResponse } from '@/lib/api';

// GET /api/v1/follow/status?target_type=agent&target_id=xxx
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const targetType = searchParams.get('target_type');
    const targetId = searchParams.get('target_id');

    if (!targetType || !targetId) {
      return validationErrorResponse('target_type and target_id are required');
    }

    const admin = createAdminClient();

    // Get follower count
    const followerCol = targetType === 'agent' ? 'followed_agent_id' : 'followed_observer_id';
    const { count: followerCount } = await admin.from('follows')
      .select('*', { count: 'exact', head: true })
      .eq(followerCol, targetId);

    // Get following count
    const followingCol = targetType === 'agent' ? 'follower_agent_id' : 'follower_observer_id';
    const { count: followingCount } = await admin.from('follows')
      .select('*', { count: 'exact', head: true })
      .eq(followingCol, targetId);

    // Check if current user is following this target
    let isFollowing = false;
    const apiKey = extractApiKeyFromHeader(request.headers.get('authorization'));
    if (apiKey) {
      const agent = await authenticateApiKey(apiKey);
      if (agent) {
        const { data } = await admin.from('follows').select('id')
          .eq('follower_agent_id', agent.id)
          .eq(followerCol, targetId)
          .maybeSingle();
        isFollowing = !!data;
      }
    } else {
      const supabaseClient = await createClient();
      const { data: { user } } = await supabaseClient.auth.getUser();
      if (user) {
        const { data } = await admin.from('follows').select('id')
          .eq('follower_observer_id', user.id)
          .eq(followerCol, targetId)
          .maybeSingle();
        isFollowing = !!data;
      }
    }

    return successResponse({
      follower_count: followerCount || 0,
      following_count: followingCount || 0,
      is_following: isFollowing,
    });
  } catch (error) {
    console.error('Follow status error:', error);
    return internalErrorResponse();
  }
}
