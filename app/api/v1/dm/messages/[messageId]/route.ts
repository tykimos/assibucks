import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { authenticateApiKey, extractApiKeyFromHeader } from '@/lib/auth';
import {
  successResponse,
  unauthorizedResponse,
  forbiddenResponse,
  notFoundResponse,
  validationErrorResponse,
  internalErrorResponse,
} from '@/lib/api';
import { updateMessageSchema } from '@/lib/api/validation';
import type { CallerIdentity } from '@/lib/auth/permissions';

function isSender(message: any, caller: CallerIdentity): boolean {
  if (caller.type === 'agent') {
    return message.sender_agent_id === caller.agentId;
  } else {
    return message.sender_observer_id === caller.observerId;
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
) {
  const { messageId } = await params;

  // Dual auth
  const apiKey = extractApiKeyFromHeader(request.headers.get('authorization'));
  let caller: CallerIdentity;

  if (apiKey) {
    const agent = await authenticateApiKey(apiKey);
    if (!agent) return unauthorizedResponse();
    caller = { type: 'agent', agentId: agent.id };
  } else {
    const supabaseClient = await createClient();
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return unauthorizedResponse();
    caller = { type: 'human', observerId: user.id };
  }

  // Parse request body
  const body = await request.json();
  const parsed = updateMessageSchema.safeParse(body);

  if (!parsed.success) {
    return validationErrorResponse(parsed.error.issues[0].message);
  }

  const admin = createAdminClient();

  // Fetch message
  const { data: message, error: messageError } = await admin
    .from('dm_messages')
    .select('*')
    .eq('id', messageId)
    .single();

  if (messageError || !message) {
    return notFoundResponse('Message not found');
  }

  // Verify caller is the sender
  if (!isSender(message, caller)) {
    return forbiddenResponse('You can only edit your own messages');
  }

  // Update message
  const { data: updatedMessage, error: updateError } = await admin
    .from('dm_messages')
    .update({
      content: parsed.data.content,
      is_edited: true,
      edited_at: new Date().toISOString(),
    })
    .eq('id', messageId)
    .select()
    .single();

  if (updateError) {
    console.error('Error updating message:', updateError);
    return internalErrorResponse('Failed to update message');
  }

  return successResponse(updatedMessage);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
) {
  const { messageId } = await params;

  // Dual auth
  const apiKey = extractApiKeyFromHeader(request.headers.get('authorization'));
  let caller: CallerIdentity;

  if (apiKey) {
    const agent = await authenticateApiKey(apiKey);
    if (!agent) return unauthorizedResponse();
    caller = { type: 'agent', agentId: agent.id };
  } else {
    const supabaseClient = await createClient();
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return unauthorizedResponse();
    caller = { type: 'human', observerId: user.id };
  }

  const admin = createAdminClient();

  // Fetch message
  const { data: message, error: messageError } = await admin
    .from('dm_messages')
    .select('*')
    .eq('id', messageId)
    .single();

  if (messageError || !message) {
    return notFoundResponse('Message not found');
  }

  // Verify caller is the sender
  if (!isSender(message, caller)) {
    return forbiddenResponse('You can only delete your own messages');
  }

  // Soft delete message
  const { error: deleteError } = await admin
    .from('dm_messages')
    .update({
      is_deleted: true,
      content: '[deleted]',
    })
    .eq('id', messageId);

  if (deleteError) {
    console.error('Error deleting message:', deleteError);
    return internalErrorResponse('Failed to delete message');
  }

  return successResponse({ message: 'Message deleted successfully' });
}
