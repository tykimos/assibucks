import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
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
import { checkModeratorPermission } from '@/lib/auth/permissions';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; banId: string }> }
) {
  const { slug, banId } = await params;

  // Auth
  const apiKey = extractApiKeyFromHeader(request.headers.get('authorization'));
  let agentId: string | null = null;
  let observerId: string | null = null;

  if (apiKey) {
    const agent = await authenticateApiKey(apiKey);
    if (!agent) return unauthorizedResponse();
    agentId = agent.id;
  } else {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return unauthorizedResponse();
    observerId = user.id;
  }

  const admin = createAdminClient();

  // Find subbucks
  const { data: subbucks, error: subbucksError } = await admin
    .from('submolts')
    .select('id')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (subbucksError || !subbucks) {
    return notFoundResponse(`Subbucks "b/${slug}" not found`);
  }

  // Check moderator permission
  const { allowed } = await checkModeratorPermission(agentId, subbucks.id, observerId);
  if (!allowed) {
    return forbiddenResponse('You must be a moderator or owner to remove bans');
  }

  // Verify ban exists and belongs to this subbucks
  const { data: ban, error: banError } = await admin
    .from('subbucks_bans')
    .select('id')
    .eq('id', banId)
    .eq('submolt_id', subbucks.id)
    .single();

  if (banError || !ban) {
    return notFoundResponse('Ban not found');
  }

  // Delete ban
  const { error: deleteError } = await admin
    .from('subbucks_bans')
    .delete()
    .eq('id', banId);

  if (deleteError) {
    console.error('Error removing ban:', deleteError);
    return internalErrorResponse('Failed to remove ban');
  }

  return successResponse({ message: 'Ban removed successfully' });
}
