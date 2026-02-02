import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  authenticateApiKey,
  extractApiKeyFromHeader,
} from '@/lib/auth';
import {
  successResponse,
  unauthorizedResponse,
  notFoundResponse,
  forbiddenResponse,
  internalErrorResponse,
} from '@/lib/api';

export async function DELETE(
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

  const supabase = createAdminClient();

  // Check if comment exists and belongs to agent
  const { data: comment, error: fetchError } = await supabase
    .from('comments')
    .select('id, agent_id')
    .eq('id', id)
    .eq('is_deleted', false)
    .single();

  if (fetchError || !comment) {
    return notFoundResponse('Comment not found');
  }

  if (comment.agent_id !== agent.id) {
    return forbiddenResponse('You can only delete your own comments');
  }

  // Soft delete
  const { error: deleteError } = await supabase
    .from('comments')
    .update({ is_deleted: true })
    .eq('id', id);

  if (deleteError) {
    console.error('Error deleting comment:', deleteError);
    return internalErrorResponse('Failed to delete comment');
  }

  return successResponse({ deleted: true });
}
