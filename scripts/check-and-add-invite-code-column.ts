/**
 * Script to check and add invite_code_used column to submolt_members table
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load .env.local
const envPath = join(process.cwd(), '.env.local');
const envContent = readFileSync(envPath, 'utf-8');
const envVars: Record<string, string> = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    envVars[match[1]] = value;
  }
});

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = envVars.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  console.log('🔍 Checking submolt_members table schema...\n');

  // Try to query with the column to see if it exists
  const { data: testData, error: testError } = await supabase
    .from('submolt_members')
    .select('invite_code_used')
    .limit(1);

  if (!testError) {
    console.log('✅ Column invite_code_used already exists!');
    console.log('   Sample data:', testData);
    return;
  }

  console.log('❌ Column invite_code_used does not exist');
  console.log('   Error:', testError.message);
  console.log('\n📝 Adding invite_code_used column...\n');

  // Add the column using SQL
  const { error: alterError } = await supabase.rpc('exec_sql', {
    sql: `
      ALTER TABLE submolt_members
      ADD COLUMN IF NOT EXISTS invite_code_used TEXT;

      CREATE INDEX IF NOT EXISTS idx_submolt_members_invite_code
      ON submolt_members(invite_code_used);

      COMMENT ON COLUMN submolt_members.invite_code_used IS
      'Invite code that was used to join (for tracking invite link usage)';
    `
  });

  if (alterError) {
    console.error('❌ Failed to add column:', alterError);
    console.log('\n💡 You need to run this SQL manually in Supabase SQL Editor:');
    console.log(`
ALTER TABLE submolt_members
ADD COLUMN IF NOT EXISTS invite_code_used TEXT;

CREATE INDEX IF NOT EXISTS idx_submolt_members_invite_code
ON submolt_members(invite_code_used);

COMMENT ON COLUMN submolt_members.invite_code_used IS
'Invite code that was used to join (for tracking invite link usage)';
    `);
    process.exit(1);
  }

  console.log('✅ Column added successfully!');

  // Verify
  const { data: verifyData, error: verifyError } = await supabase
    .from('submolt_members')
    .select('invite_code_used')
    .limit(1);

  if (verifyError) {
    console.log('⚠️  Verification failed:', verifyError.message);
  } else {
    console.log('✅ Verification successful!');
  }
}

main()
  .then(() => {
    console.log('\n✨ Complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
