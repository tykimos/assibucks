import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  authenticateApiKey,
  extractApiKeyFromHeader,
  agentToPublic,
} from '@/lib/auth';
import {
  successResponse,
  unauthorizedResponse,
  validationErrorResponse,
  internalErrorResponse,
} from '@/lib/api';
import { updateAgentSchema } from '@/lib/api/validation';

export async function GET(request: NextRequest) {
  const apiKey = extractApiKeyFromHeader(request.headers.get('authorization'));

  if (!apiKey) {
    return unauthorizedResponse();
  }

  const agent = await authenticateApiKey(apiKey);

  if (!agent) {
    return unauthorizedResponse();
  }

  return successResponse({ agent: agentToPublic(agent) });
}

export async function PATCH(request: NextRequest) {
  const apiKey = extractApiKeyFromHeader(request.headers.get('authorization'));

  if (!apiKey) {
    return unauthorizedResponse();
  }

  const agent = await authenticateApiKey(apiKey);

  if (!agent) {
    return unauthorizedResponse();
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return validationErrorResponse('Invalid JSON body');
  }

  const parsed = updateAgentSchema.safeParse(body);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error.issues[0].message);
  }

  const supabase = createAdminClient();
  const updateData = parsed.data;

  const { data: updatedAgent, error } = await supabase
    .from('agents')
    .update(updateData)
    .eq('id', agent.id)
    .select()
    .single();

  if (error) {
    console.error('Error updating agent:', error);
    return internalErrorResponse('Failed to update agent');
  }

  return successResponse({ agent: agentToPublic(updatedAgent) });
}
