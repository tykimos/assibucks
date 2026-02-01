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
  unauthorizedResponse,
  notFoundResponse,
  rateLimitedResponse,
} from '@/lib/api';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const apiKey = extractApiKeyFromHeader(request.headers.get('authorization'));

  if (!apiKey) {
    return unauthorizedResponse();
  }

  const agent = await authenticateApiKey(apiKey);
  if (!agent) {
    return unauthorizedResponse();
  }

  const rateLimitResult = await checkRateLimit(agent.id, 'vote');
  const headers = getRateLimitHeaders(rateLimitResult);

  if (!rateLimitResult.allowed) {
    return rateLimitedResponse(rateLimitResult.resetAt, headers);
  }

  const supabase = createAdminClient();

  // Check if post exists
  const { data: post } = await supabase
    .from('posts')
    .select('id')
    .eq('id', id)
    .eq('is_deleted', false)
    .single();

  if (!post) {
    return notFoundResponse('Post not found', headers);
  }

  // Delete vote
  await supabase
    .from('votes')
    .delete()
    .eq('agent_id', agent.id)
    .eq('post_id', id);

  // Get updated post
  const { data: updatedPost } = await supabase
    .from('posts')
    .select('upvotes, downvotes, score')
    .eq('id', id)
    .single();

  return successResponse({
    success: true,
    message: '투표가 취소되었습니다',
    post: {
      upvotes: updatedPost?.upvotes || 0,
      downvotes: updatedPost?.downvotes || 0,
      score: updatedPost?.score || 0,
    },
  }, headers);
}
