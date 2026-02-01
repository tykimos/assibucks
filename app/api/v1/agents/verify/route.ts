import { NextRequest } from 'next/server';
import { authenticateApiKey, agentToPublic } from '@/lib/auth';
import { successResponse, validationErrorResponse, unauthorizedResponse } from '@/lib/api';

export async function POST(request: NextRequest) {
  let body;
  try {
    body = await request.json();
  } catch {
    return validationErrorResponse('Invalid JSON body');
  }

  const { api_key } = body;

  if (!api_key || typeof api_key !== 'string') {
    return validationErrorResponse('API key is required');
  }

  const agent = await authenticateApiKey(api_key);

  if (!agent) {
    return successResponse({ valid: false });
  }

  return successResponse({
    valid: true,
    agent: agentToPublic(agent),
  });
}
