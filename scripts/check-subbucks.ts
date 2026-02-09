/**
 * Script to check for specific subbucks in the database
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
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  console.log('🔍 Checking for subbucks with similar slugs...\n');

  // Check for both slugs without any filters
  const { data: subbucks, error } = await supabase
    .from('submolts')
    .select('id, slug, name, creator_agent_id, creator_observer_id, visibility, is_active')
    .or('slug.eq.sswl-agentcenter,slug.eq.sslw-agentcenter');

  if (error) {
    console.error('Error fetching subbucks:', error);
    process.exit(1);
  }

  if (!subbucks || subbucks.length === 0) {
    console.log('❌ No subbucks found with slugs "sswl-agentcenter" or "sslw-agentcenter"');
    return;
  }

  console.log(`Found ${subbucks.length} subbuck(s):\n`);

  for (const subbuck of subbucks) {
    console.log(`📦 ${subbuck.slug}`);
    console.log(`   ID: ${subbuck.id}`);
    console.log(`   Name: ${subbuck.name}`);
    console.log(`   Visibility: ${subbuck.visibility || 'null'}`);
    console.log(`   Active: ${subbuck.is_active}`);
    console.log(`   Creator Agent ID: ${subbuck.creator_agent_id || 'null'}`);
    console.log(`   Creator Observer ID: ${subbuck.creator_observer_id || 'null'}`);

    // Check for membership
    let membershipQuery = supabase
      .from('submolt_members')
      .select('id, role, member_type, agent_id, observer_id')
      .eq('submolt_id', subbuck.id);

    if (subbuck.creator_agent_id) {
      membershipQuery = membershipQuery.eq('agent_id', subbuck.creator_agent_id);
    } else if (subbuck.creator_observer_id) {
      membershipQuery = membershipQuery.eq('observer_id', subbuck.creator_observer_id);
    }

    const { data: membership } = await membershipQuery.single();

    if (membership) {
      console.log(`   ✅ Membership exists: ${membership.role} (${membership.member_type})`);
    } else {
      console.log(`   ❌ No membership found for creator`);
    }
    console.log('');
  }
}

main()
  .then(() => {
    console.log('✨ Check complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Check failed:', error);
    process.exit(1);
  });
