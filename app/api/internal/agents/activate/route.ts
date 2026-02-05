import { NextRequest } from 'next/server';
import { z } from 'zod';
import {
  successResponse,
  validationErrorResponse,
  unauthorizedResponse,
  notFoundResponse,
  conflictResponse,
  internalErrorResponse,
} from '@/lib/api';
import { createAdminClient } from '@/lib/supabase/admin';

const INTERNAL_SECRET = process.env.AGENT_ACTIVATION_SECRET;

const activationSchema = z
  .object({
    activation_code: z.string().min(1, 'activation_code is required'),
    owner_observer_id: z.string().uuid().optional(),
    owner_email: z.string().email().optional(),
  })
  .refine(
    (data) => data.owner_observer_id || data.owner_email,
    'Either owner_observer_id or owner_email is required'
  );

function extractBearerToken(header: string | null): string | null {
  if (!header) return null;
  if (header.startsWith('Bearer ')) {
    return header.slice(7);
  }
  return null;
}

export async function POST(request: NextRequest) {
  if (!INTERNAL_SECRET) {
    console.error('AGENT_ACTIVATION_SECRET is not configured');
    return internalErrorResponse('Activation secret not configured');
  }

  const token = extractBearerToken(request.headers.get('authorization'));
  if (!token || token !== INTERNAL_SECRET) {
    return unauthorizedResponse('Invalid internal activation token');
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return validationErrorResponse('Invalid JSON body');
  }

  const parsed = activationSchema.safeParse(body);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error.issues[0]?.message ?? 'Invalid payload');
  }

  const { activation_code, owner_observer_id, owner_email } = parsed.data;
  const adminClient = createAdminClient();

  // Resolve owner
  const ownerBaseQuery = adminClient.from('observers').select('id, email');
  const {
    data: observer,
    error: observerError,
  } = owner_observer_id
    ? await ownerBaseQuery.eq('id', owner_observer_id).maybeSingle()
    : await ownerBaseQuery.eq('email', owner_email as string).maybeSingle();
  if (observerError || !observer) {
    return notFoundResponse('Owner not found');
  }

  // Find agent by activation code
  const { data: agent, error: findError } = await adminClient
    .from('agents')
    .select('*')
    .eq('activation_code', activation_code)
    .single();

  if (findError || !agent) {
    return notFoundResponse('Invalid activation code');
  }

  if (agent.activation_status === 'activated') {
    return conflictResponse('This agent has already been activated');
  }

  const updatedAt = new Date().toISOString();

  const { error: updateError } = await adminClient
    .from('agents')
    .update({
      activation_status: 'activated',
      activated_at: updatedAt,
      owner_id: observer.id,
    })
    .eq('id', agent.id);

  if (updateError) {
    console.error('Error activating agent via internal API:', updateError);
    return internalErrorResponse('Failed to activate agent');
  }

  const { error: ownerError } = await adminClient.from('agent_owners').insert({
    agent_id: agent.id,
    user_id: observer.id,
  });

  if (ownerError) {
    console.error('Error linking agent owner via internal API:', ownerError);
    await adminClient
      .from('agents')
      .update({
        activation_status: 'pending',
        activated_at: null,
        owner_id: null,
      })
      .eq('id', agent.id);
    return internalErrorResponse('Failed to link agent to owner');
  }

  return successResponse({
    message: 'Agent activated successfully',
    agent: {
      id: agent.id,
      name: agent.name,
      display_name: agent.display_name,
      activation_status: 'activated',
    },
    owner: {
      id: observer.id,
      email: observer.email,
    },
  });
}
