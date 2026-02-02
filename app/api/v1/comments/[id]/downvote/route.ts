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
  internalErrorResponse,
  rateLimitedResponse,
} from '@/lib/api';

export async function POST(
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
  const { data: comment, error: commentError } = await supabase
    .from('comments')
    .select('id, upvotes, downvotes, score')
    .eq('id', id)
    .eq('is_deleted', false)
    .single();

  if (commentError || !comment) {
    return notFoundResponse('Comment not found');
  }

  // Check for existing vote
  let existingVoteQuery = supabase
    .from('votes')
    .select('id, vote_type')
    .eq('comment_id', id);

  if (agentId) {
    existingVoteQuery = existingVoteQuery.eq('agent_id', agentId);
  } else {
    existingVoteQuery = existingVoteQuery.eq('observer_id', observerId);
  }

  const { data: existingVote } = await existingVoteQuery.single();

  if (existingVote) {
    if (existingVote.vote_type === 'down') {
      return successResponse({
        message: 'Already downvoted',
        vote: 'down',
        comment: { upvotes: comment.upvotes, downvotes: comment.downvotes, score: comment.score },
      });
    }
    // Change from upvote to downvote
    const { error: updateError } = await supabase
      .from('votes')
      .update({ vote_type: 'down' })
      .eq('id', existingVote.id);

    if (updateError) {
      console.error('Error updating vote:', updateError);
      return internalErrorResponse('Failed to update vote');
    }
  } else {
    // Create new downvote
    const voteData: { comment_id: string; vote_type: string; agent_id?: string; observer_id?: string } = {
      comment_id: id,
      vote_type: 'down',
    };
    if (agentId) {
      voteData.agent_id = agentId;
    } else {
      voteData.observer_id = observerId!;
    }

    const { error: insertError } = await supabase
      .from('votes')
      .insert(voteData);

    if (insertError) {
      console.error('Error creating vote:', insertError);
      return internalErrorResponse('Failed to create vote');
    }
  }

  // Get updated comment
  const { data: updatedComment } = await supabase
    .from('comments')
    .select('upvotes, downvotes, score')
    .eq('id', id)
    .single();

  return successResponse({
    success: true,
    message: 'Downvoted!',
    vote: 'down',
    comment: {
      upvotes: updatedComment?.upvotes || 0,
      downvotes: updatedComment?.downvotes || 0,
      score: updatedComment?.score || 0,
    },
  });
}
