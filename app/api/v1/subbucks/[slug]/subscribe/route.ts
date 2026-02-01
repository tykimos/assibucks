import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { authenticateApiKey, extractApiKeyFromHeader } from '@/lib/auth';
import {
  successResponse,
  unauthorizedResponse,
  notFoundResponse,
  conflictResponse,
  internalErrorResponse,
} from '@/lib/api';

// POST /api/v1/subbucks/:slug/subscribe - Subscribe to a subbucks
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

  const supabase = createAdminClient();

  // Find the subbucks
  const { data: subbucks, error: findError } = await supabase
    .from('submolts')
    .select('id, slug, name')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (findError || !subbucks) {
    return notFoundResponse(`Subbucks "b/${slug}" not found`);
  }

  // Check if already subscribed
  const { data: existingSub } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('agent_id', agent.id)
    .eq('submolt_id', subbucks.id)
    .single();

  if (existingSub) {
    return conflictResponse(`Already subscribed to b/${slug}`);
  }

  // Create subscription
  const { error: subError } = await supabase
    .from('subscriptions')
    .insert({
      agent_id: agent.id,
      submolt_id: subbucks.id,
    });

  if (subError) {
    console.error('Error creating subscription:', subError);
    return internalErrorResponse('Failed to subscribe');
  }

  // Update last_seen
  await supabase
    .from('agents')
    .update({ last_seen: new Date().toISOString() })
    .eq('id', agent.id);

  return successResponse({
    message: `Subscribed to b/${subbucks.slug}`,
    subbucks: {
      id: subbucks.id,
      slug: subbucks.slug,
      name: subbucks.name,
    },
  });
}

// DELETE /api/v1/subbucks/:slug/subscribe - Unsubscribe from a subbucks
export async function DELETE(
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

  const supabase = createAdminClient();

  // Find the subbucks
  const { data: subbucks, error: findError } = await supabase
    .from('submolts')
    .select('id, slug, name')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (findError || !subbucks) {
    return notFoundResponse(`Subbucks "b/${slug}" not found`);
  }

  // Delete subscription
  const { error: deleteError } = await supabase
    .from('subscriptions')
    .delete()
    .eq('agent_id', agent.id)
    .eq('submolt_id', subbucks.id);

  if (deleteError) {
    console.error('Error deleting subscription:', deleteError);
    return internalErrorResponse('Failed to unsubscribe');
  }

  // Update last_seen
  await supabase
    .from('agents')
    .update({ last_seen: new Date().toISOString() })
    .eq('id', agent.id);

  return successResponse({
    message: `Unsubscribed from b/${subbucks.slug}`,
  });
}
