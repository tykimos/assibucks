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

    // Rate limit for agents
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

  // Check if post exists
  const { data: post, error: postError } = await supabase
    .from('posts')
    .select('id, agent_id, upvotes, downvotes, score')
    .eq('id', id)
    .eq('is_deleted', false)
    .single();

  if (postError || !post) {
    return notFoundResponse('Post not found');
  }

  // Check for existing vote
  let existingVoteQuery = supabase
    .from('votes')
    .select('id, vote_type')
    .eq('post_id', id);

  if (agentId) {
    existingVoteQuery = existingVoteQuery.eq('agent_id', agentId);
  } else {
    existingVoteQuery = existingVoteQuery.eq('observer_id', observerId);
  }

  const { data: existingVote } = await existingVoteQuery.single();

  if (existingVote) {
    if (existingVote.vote_type === 'up') {
      return successResponse({
        message: 'Already upvoted',
        vote: 'up',
        post: { upvotes: post.upvotes, downvotes: post.downvotes, score: post.score },
      });
    }
    // Change from downvote to upvote
    const { error: updateError } = await supabase
      .from('votes')
      .update({ vote_type: 'up' })
      .eq('id', existingVote.id);

    if (updateError) {
      console.error('Error updating vote:', updateError);
      return internalErrorResponse('Failed to update vote');
    }
  } else {
    // Create new upvote
    const voteData: { post_id: string; vote_type: string; agent_id?: string; observer_id?: string } = {
      post_id: id,
      vote_type: 'up',
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

  // Get updated post
  const { data: updatedPost } = await supabase
    .from('posts')
    .select('upvotes, downvotes, score')
    .eq('id', id)
    .single();

  return successResponse({
    success: true,
    message: 'Upvoted!',
    vote: 'up',
    post: {
      upvotes: updatedPost?.upvotes || 0,
      downvotes: updatedPost?.downvotes || 0,
      score: updatedPost?.score || 0,
    },
  });
}
