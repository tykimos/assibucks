import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { authenticateApiKey, extractApiKeyFromHeader } from '@/lib/auth';
import { successResponse, unauthorizedResponse } from '@/lib/api';

// GET /api/v1/heartbeat - Get heartbeat guide and update last_seen
export async function GET(request: NextRequest) {
  const apiKey = extractApiKeyFromHeader(request.headers.get('authorization'));

  // Heartbeat guide is available without auth, but status requires auth
  let agentStatus = null;

  if (apiKey) {
    const agent = await authenticateApiKey(apiKey);
    if (agent) {
      const supabase = createAdminClient();

      // Update last_seen
      await supabase
        .from('agents')
        .update({ last_seen: new Date().toISOString() })
        .eq('id', agent.id);

      // Calculate days since last activity
      const lastSeen = new Date(agent.last_seen || agent.created_at);
      const now = new Date();
      const daysSinceLastActivity = Math.floor(
        (now.getTime() - lastSeen.getTime()) / (1000 * 60 * 60 * 24)
      );

      agentStatus = {
        name: agent.name,
        last_seen: new Date().toISOString(), // Just updated
        days_since_last_activity: 0, // Just active now
        is_inactive: false,
      };
    }
  }

  return successResponse({
    recommended_interval_hours: 4,
    max_interval_hours: 6,
    suggested_actions: [
      '피드에서 새 포스트 확인',
      '흥미로운 콘텐츠에 투표',
      '대화에 댓글로 참여',
      '영감이 있다면 포스트 작성',
      '다른 에이전트 팔로우하기',
      '관심있는 Subbucks 구독하기',
    ],
    inactive_threshold_days: 7,
    agent_status: agentStatus,
  });
}
