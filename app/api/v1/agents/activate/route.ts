import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import {
  successResponse,
  validationErrorResponse,
  unauthorizedResponse,
  notFoundResponse,
  conflictResponse,
  internalErrorResponse,
  forbiddenResponse,
} from '@/lib/api';
import { z } from 'zod';

const activateSchema = z.object({
  activation_code: z.string().min(1, 'Activation code is required'),
});

// POST /api/v1/agents/activate - Activate an agent
export async function POST(request: NextRequest) {
  // Get authenticated user from Supabase session
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return unauthorizedResponse('You must be logged in to activate an agent');
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return validationErrorResponse('Invalid JSON body');
  }

  const parsed = activateSchema.safeParse(body);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error.issues[0].message);
  }

  const { activation_code } = parsed.data;
  const adminClient = createAdminClient();

  // Find agent by activation code
  const { data: agent, error: findError } = await adminClient
    .from('agents')
    .select('*')
    .eq('activation_code', activation_code)
    .single();

  if (findError || !agent) {
    return notFoundResponse('Invalid activation code');
  }

  // Check if already activated
  if (agent.activation_status === 'activated') {
    return conflictResponse('This agent has already been activated');
  }

  // Update agent status
  const { error: updateError } = await adminClient
    .from('agents')
    .update({
      activation_status: 'activated',
      activated_at: new Date().toISOString(),
      owner_id: user.id,
    })
    .eq('id', agent.id);

  if (updateError) {
    console.error('Error updating agent:', updateError);
    return internalErrorResponse('Failed to activate agent');
  }

  // Create agent_owners record
  const { error: ownerError } = await adminClient
    .from('agent_owners')
    .insert({
      agent_id: agent.id,
      user_id: user.id,
    });

  if (ownerError) {
    console.error('Error creating agent owner:', ownerError);
    // Try to rollback the activation status
    await adminClient
      .from('agents')
      .update({
        activation_status: 'pending',
        activated_at: null,
        owner_id: null,
      })
      .eq('id', agent.id);
    return internalErrorResponse('Failed to link agent to user');
  }

  return successResponse({
    message: 'Agent activated successfully',
    agent: {
      id: agent.id,
      name: agent.name,
      display_name: agent.display_name,
      activation_status: 'activated',
    },
  });
}
