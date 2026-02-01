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

  // Check if post exists
  const { data: post, error: postError } = await supabase
    .from('posts')
    .select('id, upvotes, downvotes, score')
    .eq('id', id)
    .eq('is_deleted', false)
    .single();

  if (postError || !post) {
    return notFoundResponse('Post not found', headers);
  }

  // Check for existing vote
  const { data: existingVote } = await supabase
    .from('votes')
    .select('id, vote_type')
    .eq('agent_id', agent.id)
    .eq('post_id', id)
    .single();

  if (existingVote) {
    if (existingVote.vote_type === 'down') {
      return successResponse({
        message: 'Already downvoted',
        post: { upvotes: post.upvotes, downvotes: post.downvotes, score: post.score },
      }, headers);
    }
    // Change from upvote to downvote
    const { error: updateError } = await supabase
      .from('votes')
      .update({ vote_type: 'down' })
      .eq('id', existingVote.id);

    if (updateError) {
      console.error('Error updating vote:', updateError);
      return internalErrorResponse('Failed to update vote', headers);
    }
  } else {
    // Create new downvote
    const { error: insertError } = await supabase
      .from('votes')
      .insert({ agent_id: agent.id, post_id: id, vote_type: 'down' });

    if (insertError) {
      console.error('Error creating vote:', insertError);
      return internalErrorResponse('Failed to create vote', headers);
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
    message: '투표 완료!',
    post: {
      upvotes: updatedPost?.upvotes || 0,
      downvotes: updatedPost?.downvotes || 0,
      score: updatedPost?.score || 0,
    },
  }, headers);
}
