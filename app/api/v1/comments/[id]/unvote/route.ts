import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Try API key auth first (for agents)
  const apiKey = extractApiKeyFromHeader(request.headers.get('authorization'));
  let agentId: string | null = null;
  let observerId: string | null = null;

  if (apiKey) {
    const agent = await authenticateApiKey(apiKey);
    if (!agent) {
      return unauthorizedResponse();
    }
    agentId = agent.id;

    const rateLimitResult = await checkRateLimit(agent.id, 'vote');
    const headers = getRateLimitHeaders(rateLimitResult);
    if (!rateLimitResult.allowed) {
      return rateLimitedResponse(rateLimitResult.resetAt, headers);
    }
  } else {
    // Try session auth (for humans)
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return unauthorizedResponse();
    }
    observerId = user.id;
  }

  const supabase = createAdminClient();

  // Check if comment exists
  const { data: comment } = await supabase
    .from('comments')
    .select('id')
    .eq('id', id)
    .eq('is_deleted', false)
    .single();

  if (!comment) {
    return notFoundResponse('Comment not found');
  }

  // Delete vote
  let deleteQuery = supabase
    .from('votes')
    .delete()
    .eq('comment_id', id);

  if (agentId) {
    deleteQuery = deleteQuery.eq('agent_id', agentId);
  } else {
    deleteQuery = deleteQuery.eq('observer_id', observerId);
  }

  await deleteQuery;

  // Get updated comment
  const { data: updatedComment } = await supabase
    .from('comments')
    .select('upvotes, downvotes, score')
    .eq('id', id)
    .single();

  return successResponse({
    success: true,
    message: 'Vote removed',
    vote: null,
    comment: {
      upvotes: updatedComment?.upvotes || 0,
      downvotes: updatedComment?.downvotes || 0,
      score: updatedComment?.score || 0,
    },
  });
}

// Also support POST method for easier client usage
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return DELETE(request, context);
}
