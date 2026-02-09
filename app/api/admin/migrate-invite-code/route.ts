import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { successResponse, unauthorizedResponse, internalErrorResponse } from '@/lib/api';

/**
 * Admin endpoint to add invite_code_used column to submolt_members table
 *
 * GET /api/admin/migrate-invite-code
 */
export async function GET(request: NextRequest) {
  // Check if user is logged in
  const userClient = await createClient();
  const { data: { user } } = await userClient.auth.getUser();

  if (!user) {
    return unauthorizedResponse();
  }

  try {
    // Use the Supabase connection string to execute raw SQL
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return internalErrorResponse('Missing Supabase credentials');
    }

    // Extract the database URL from the Supabase URL
    // This is a workaround - we'll need to use the Management API
    const projectRef = supabaseUrl.replace('https://', '').replace('.supabase.co', '');

    // Try using pg-promise or node-postgres to execute the SQL
    // For now, let's try using fetch to call Supabase's REST API
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({
        sql: `
          -- Add invite_code_used column to submolt_members table
          ALTER TABLE submolt_members
          ADD COLUMN IF NOT EXISTS invite_code_used TEXT;

          -- Create index for faster queries
          CREATE INDEX IF NOT EXISTS idx_submolt_members_invite_code
          ON submolt_members(invite_code_used);

          -- Add column comment
          COMMENT ON COLUMN submolt_members.invite_code_used IS
          'Invite code that was used to join (for tracking invite link usage)';
        `
      })
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Migration failed:', error);

      return internalErrorResponse(`Migration failed. Please run the SQL manually in Supabase SQL Editor:

ALTER TABLE submolt_members
ADD COLUMN IF NOT EXISTS invite_code_used TEXT;

CREATE INDEX IF NOT EXISTS idx_submolt_members_invite_code
ON submolt_members(invite_code_used);

COMMENT ON COLUMN submolt_members.invite_code_used IS
'Invite code that was used to join (for tracking invite link usage)';`);
    }

    const result = await response.json();

    return successResponse({
      message: 'Migration executed successfully',
      result,
    });
  } catch (error: any) {
    console.error('Migration error:', error);
    return internalErrorResponse(error.message || 'Migration failed');
  }
}
