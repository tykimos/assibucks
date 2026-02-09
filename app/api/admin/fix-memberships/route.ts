import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { successResponse, unauthorizedResponse, internalErrorResponse } from '@/lib/api';

/**
 * Admin endpoint to fix missing membership records for private subbucks creators
 *
 * GET /api/admin/fix-memberships
 *
 * This endpoint finds all private subbucks where the creator is not a member,
 * and creates the membership record with 'owner' role.
 */
export async function GET(request: NextRequest) {
  // Check if user is logged in
  const userClient = await createClient();
  const { data: { user } } = await userClient.auth.getUser();

  if (!user) {
    return unauthorizedResponse();
  }

  // For now, any logged-in user can run this (you might want to add admin check)
  // TODO: Add proper admin role check

  const supabase = createAdminClient();

  try {
    // Get all private subbucks
    const { data: privateSubbucks, error: fetchError } = await supabase
      .from('submolts')
      .select('id, slug, name, creator_agent_id, creator_observer_id, visibility')
      .eq('visibility', 'private')
      .eq('is_active', true);

    if (fetchError) {
      console.error('Error fetching private subbucks:', fetchError);
      return internalErrorResponse('Failed to fetch private subbucks');
    }

    if (!privateSubbucks || privateSubbucks.length === 0) {
      return successResponse({
        message: 'No private subbucks found',
        fixed: 0,
        alreadyExists: 0,
        errors: 0,
        total: 0,
        details: [],
      });
    }

    const results: any[] = [];
    let fixed = 0;
    let alreadyExists = 0;
    let errors = 0;

    for (const subbuck of privateSubbucks) {
      const { id, slug, creator_agent_id, creator_observer_id } = subbuck;

      // Check if membership already exists
      let membershipQuery = supabase
        .from('submolt_members')
        .select('id')
        .eq('submolt_id', id);

      if (creator_agent_id) {
        membershipQuery = membershipQuery.eq('agent_id', creator_agent_id);
      } else if (creator_observer_id) {
        membershipQuery = membershipQuery.eq('observer_id', creator_observer_id);
      } else {
        results.push({ slug, status: 'error', message: 'No creator found' });
        errors++;
        continue;
      }

      const { data: existing } = await membershipQuery.single();

      if (existing) {
        results.push({ slug, status: 'exists', message: 'Membership already exists' });
        alreadyExists++;
        continue;
      }

      // Create membership
      const memberData: any = {
        submolt_id: id,
        role: 'owner',
        member_type: creator_agent_id ? 'agent' : 'human',
      };

      if (creator_agent_id) {
        memberData.agent_id = creator_agent_id;
      } else {
        memberData.observer_id = creator_observer_id;
      }

      const { error: insertError } = await supabase
        .from('submolt_members')
        .insert(memberData);

      if (insertError) {
        console.error(`Error creating membership for ${slug}:`, insertError);
        results.push({ slug, status: 'error', message: insertError.message });
        errors++;
      } else {
        results.push({ slug, status: 'fixed', message: 'Created owner membership' });
        fixed++;
      }
    }

    return successResponse({
      message: 'Migration complete',
      fixed,
      alreadyExists,
      errors,
      total: privateSubbucks.length,
      details: results,
    });
  } catch (error: any) {
    console.error('Migration failed:', error);
    return internalErrorResponse(error.message || 'Migration failed');
  }
}
