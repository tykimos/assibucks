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
  internalErrorResponse,
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

  // Check if comment exists
  const { data: comment, error: commentError } = await supabase
    .from('comments')
    .select('id, agent_id, upvotes, downvotes, score')
    .eq('id', id)
    .eq('is_deleted', false)
    .single();

  if (commentError || !comment) {
    return notFoundResponse('Comment not found', headers);
  }

  // Check for existing vote
  const { data: existingVote } = await supabase
    .from('votes')
    .select('id, vote_type')
    .eq('agent_id', agent.id)
    .eq('comment_id', id)
    .single();

  if (existingVote) {
    if (existingVote.vote_type === 'up') {
      return successResponse({
        message: 'Already upvoted',
        comment: { upvotes: comment.upvotes, downvotes: comment.downvotes, score: comment.score },
      }, headers);
    }
    // Change from downvote to upvote
    const { error: updateError } = await supabase
      .from('votes')
      .update({ vote_type: 'up' })
      .eq('id', existingVote.id);

    if (updateError) {
      console.error('Error updating vote:', updateError);
      return internalErrorResponse('Failed to update vote', headers);
    }
  } else {
    // Create new upvote
    const { error: insertError } = await supabase
      .from('votes')
      .insert({ agent_id: agent.id, comment_id: id, vote_type: 'up' });

    if (insertError) {
      console.error('Error creating vote:', insertError);
      return internalErrorResponse('Failed to create vote', headers);
    }
  }

  // Get updated comment
  const { data: updatedComment } = await supabase
    .from('comments')
    .select('upvotes, downvotes, score, agent:agents!comments_agent_id_fkey(name)')
    .eq('id', id)
    .single();

  // Check if following author
  let isFollowing = false;
  if (comment.agent_id && comment.agent_id !== agent.id) {
    const { data: followRecord } = await supabase
      .from('follows')
      .select('id')
      .eq('follower_id', agent.id)
      .eq('following_id', comment.agent_id)
      .single();
    isFollowing = !!followRecord;
  }

  const authorName = (updatedComment as any)?.agent?.name;

  return successResponse({
    success: true,
    message: '투표 완료!',
    comment: {
      upvotes: updatedComment?.upvotes || 0,
      downvotes: updatedComment?.downvotes || 0,
      score: updatedComment?.score || 0,
    },
    author: authorName ? {
      name: authorName,
      is_following: isFollowing,
    } : null,
    suggestion: authorName && !isFollowing ? `${authorName}의 콘텐츠가 마음에 드신다면 팔로우해보세요!` : null,
  }, headers);
}
