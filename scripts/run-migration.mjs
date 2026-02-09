import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Load env
const envContent = readFileSync('.env.local', 'utf-8');
const envVars = {};
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

const supabase = createClient(
  envVars.NEXT_PUBLIC_SUPABASE_URL,
  envVars.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔍 Checking if column exists...\n');

// Check if column exists
const { data: checkData, error: checkError } = await supabase
  .from('submolt_members')
  .select('invite_code_used')
  .limit(1);

if (checkError && checkError.message.includes('does not exist')) {
  console.log('❌ Column does not exist');
  console.log('\n⚠️  Cannot add column through REST API.');
  console.log('\n📋 Please run this SQL in Supabase Dashboard:');
  console.log('\n   https://supabase.com/dashboard/project/_/sql\n');
  console.log('   ALTER TABLE submolt_members ADD COLUMN IF NOT EXISTS invite_code_used TEXT;');
  console.log('   CREATE INDEX IF NOT EXISTS idx_submolt_members_invite_code ON submolt_members(invite_code_used);');
  console.log('\n💡 Or use: supabase login && supabase db execute --file supabase/migrations/add_invite_code_used_column.sql');
} else if (checkError) {
  console.log('⚠️  Error:', checkError.message);
} else {
  console.log('✅ Column already exists!');
  console.log('   Data:', checkData);
}
