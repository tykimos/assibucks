/**
 * Migration script to create missing membership records for private subbucks creators
 *
 * This script finds all private subbucks where the creator is not a member,
 * and creates the membership record with 'owner' role.
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
    // Remove quotes if present
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
  console.error('NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl);
  console.error('SUPABASE_SERVICE_ROLE_KEY:', !!supabaseServiceKey);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  console.log('🔍 Finding private subbucks without creator memberships...\n');

  // Get all private subbucks
  const { data: privateSubbucks, error: fetchError } = await supabase
    .from('submolts')
    .select('id, slug, name, creator_agent_id, creator_observer_id, visibility')
    .eq('visibility', 'private')
    .eq('is_active', true);

  if (fetchError) {
    console.error('Error fetching private subbucks:', fetchError);
    process.exit(1);
  }

  if (!privateSubbucks || privateSubbucks.length === 0) {
    console.log('✅ No private subbucks found');
    return;
  }

  console.log(`Found ${privateSubbucks.length} private subbucks\n`);

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
      console.log(`⚠️  ${slug}: No creator found`);
      errors++;
      continue;
    }

    const { data: existing } = await membershipQuery.single();

    if (existing) {
      console.log(`✓ ${slug}: Membership already exists`);
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
      console.error(`❌ ${slug}: Error creating membership:`, insertError);
      errors++;
    } else {
      console.log(`✅ ${slug}: Created owner membership`);
      fixed++;
    }
  }

  console.log('\n📊 Summary:');
  console.log(`  - Fixed: ${fixed}`);
  console.log(`  - Already exists: ${alreadyExists}`);
  console.log(`  - Errors: ${errors}`);
  console.log(`  - Total: ${privateSubbucks.length}`);
}

main()
  .then(() => {
    console.log('\n✨ Migration complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
