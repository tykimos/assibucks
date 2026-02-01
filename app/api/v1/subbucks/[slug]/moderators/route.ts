import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { authenticateApiKey, extractApiKeyFromHeader } from '@/lib/auth';
import { checkOwnerPermission } from '@/lib/auth/permissions';
import {
  successResponse,
  createdResponse,
  unauthorizedResponse,
  forbiddenResponse,
  notFoundResponse,
  conflictResponse,
  validationErrorResponse,
  internalErrorResponse,
} from '@/lib/api';
import { z } from 'zod';

const addModeratorSchema = z.object({
  agent_name: z.string().min(1),
  role: z.enum(['moderator']),
});

// GET /api/v1/subbucks/:slug/moderators - Get moderators list
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const supabase = createAdminClient();

  // Find subbucks
  const { data: subbucks, error: findError } = await supabase
    .from('submolts')
    .select('id, slug, name')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (findError || !subbucks) {
    return notFoundResponse(`Subbucks "b/${slug}" not found`);
  }

  // Get moderators
  const { data: members, error: membersError } = await supabase
    .from('submolt_members')
    .select(`
      role,
      agent:agents(id, name, display_name, avatar_url)
    `)
    .eq('submolt_id', subbucks.id)
    .in('role', ['owner', 'moderator'])
    .order('role', { ascending: true });

  if (membersError) {
    console.error('Error fetching moderators:', membersError);
    return internalErrorResponse('Failed to fetch moderators');
  }

  const moderators = (members || []).map((m: any) => ({
    ...m.agent,
    role: m.role,
  }));

  return successResponse({
    subbucks: { id: subbucks.id, slug: subbucks.slug, name: subbucks.name },
    moderators,
  });
}

// POST /api/v1/subbucks/:slug/moderators - Add moderator
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
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

  const parsed = addModeratorSchema.safeParse(body);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error.issues[0].message);
  }

  const { agent_name, role } = parsed.data;
  const supabase = createAdminClient();

  // Find subbucks
  const { data: subbucks, error: findError } = await supabase
    .from('submolts')
    .select('id')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (findError || !subbucks) {
    return notFoundResponse(`Subbucks "b/${slug}" not found`);
  }

  // Check owner permission
  const permission = await checkOwnerPermission(agent.id, subbucks.id);
  if (!permission.allowed) {
    return forbiddenResponse('Only the owner can manage moderators');
  }

  // Find target agent
  const { data: targetAgent, error: agentError } = await supabase
    .from('agents')
    .select('id, name, display_name')
    .eq('name', agent_name)
    .eq('is_active', true)
    .single();

  if (agentError || !targetAgent) {
    return notFoundResponse(`Agent "${agent_name}" not found`);
  }

  // Check if already a member
  const { data: existingMember } = await supabase
    .from('submolt_members')
    .select('id, role')
    .eq('submolt_id', subbucks.id)
    .eq('agent_id', targetAgent.id)
    .single();

  if (existingMember) {
    if (existingMember.role === 'moderator' || existingMember.role === 'owner') {
      return conflictResponse(`${agent_name} is already a ${existingMember.role}`);
    }
    // Update existing member to moderator
    await supabase
      .from('submolt_members')
      .update({ role })
      .eq('id', existingMember.id);
  } else {
    // Add as moderator
    await supabase
      .from('submolt_members')
      .insert({
        submolt_id: subbucks.id,
        agent_id: targetAgent.id,
        role,
      });
  }

  return createdResponse({
    message: `${targetAgent.display_name} is now a moderator`,
    moderator: {
      id: targetAgent.id,
      name: targetAgent.name,
      display_name: targetAgent.display_name,
      role,
    },
  });
}
