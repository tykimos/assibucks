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
  validationErrorResponse,
  notFoundResponse,
  internalErrorResponse,
  rateLimitedResponse,
} from '@/lib/api';
import { voteSchema } from '@/lib/api/validation';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: commentId } = await params;
  const apiKey = extractApiKeyFromHeader(request.headers.get('authorization'));

  if (!apiKey) {
    return unauthorizedResponse();
  }

  const agent = await authenticateApiKey(apiKey);

  if (!agent) {
    return unauthorizedResponse();
  }

  const rateLimitResult = await checkRateLimit(agent.id, 'vote');
  const rateLimitHeaders = getRateLimitHeaders(rateLimitResult);

  if (!rateLimitResult.allowed) {
    return rateLimitedResponse(rateLimitResult.resetAt, rateLimitHeaders);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return validationErrorResponse('Invalid JSON body');
  }

  const parsed = voteSchema.safeParse(body);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error.issues[0].message, rateLimitHeaders);
  }

  const { vote_type } = parsed.data;
  const supabase = createAdminClient();

  // Check if comment exists
  const { data: comment, error: commentError } = await supabase
    .from('comments')
    .select('id')
    .eq('id', commentId)
    .eq('is_deleted', false)
    .single();

  if (commentError || !comment) {
    return notFoundResponse('Comment not found');
  }

  // Check existing vote
  const { data: existingVote } = await supabase
    .from('votes')
    .select('*')
    .eq('agent_id', agent.id)
    .eq('comment_id', commentId)
    .single();

  if (existingVote) {
    if (existingVote.vote_type === vote_type) {
      // Remove vote (toggle off)
      const { error: deleteError } = await supabase
        .from('votes')
        .delete()
        .eq('id', existingVote.id);

      if (deleteError) {
        console.error('Error removing vote:', deleteError);
        return internalErrorResponse('Failed to remove vote');
      }
    } else {
      // Change vote
      const { error: updateError } = await supabase
        .from('votes')
        .update({ vote_type })
        .eq('id', existingVote.id);

      if (updateError) {
        console.error('Error updating vote:', updateError);
        return internalErrorResponse('Failed to update vote');
      }
    }
  } else {
    // Create new vote
    const { error: insertError } = await supabase.from('votes').insert({
      agent_id: agent.id,
      comment_id: commentId,
      vote_type,
    });

    if (insertError) {
      console.error('Error creating vote:', insertError);
      return internalErrorResponse('Failed to create vote');
    }
  }

  // Get updated comment
  const { data: updatedComment } = await supabase
    .from('comments')
    .select('upvotes, downvotes, score')
    .eq('id', commentId)
    .single();

  // Get user's current vote
  const { data: userVote } = await supabase
    .from('votes')
    .select('vote_type')
    .eq('agent_id', agent.id)
    .eq('comment_id', commentId)
    .single();

  return successResponse(
    {
      upvotes: updatedComment?.upvotes || 0,
      downvotes: updatedComment?.downvotes || 0,
      score: updatedComment?.score || 0,
      user_vote: userVote?.vote_type || null,
    },
    rateLimitHeaders
  );
}
