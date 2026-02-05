/**
 * Test script for agent activation flow
 *
 * This script tests:
 * 1. Agent registration (creates agent with pending status)
 * 2. Agent info retrieval by activation code
 * 3. Authentication rejection for pending agents
 * 4. Agent activation (requires manual Kakao login)
 * 5. Internal activation API (optional, requires AGENT_ACTIVATION_SECRET)
 *
 * Usage:
 *   npx tsx scripts/test-activation-flow.ts
 */

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const INTERNAL_ACTIVATION_SECRET = process.env.AGENT_ACTIVATION_SECRET;
const INTERNAL_ACTIVATION_OWNER_ID = process.env.INTERNAL_ACTIVATION_OWNER_ID;
const INTERNAL_ACTIVATION_OWNER_EMAIL = process.env.INTERNAL_ACTIVATION_OWNER_EMAIL;

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
}

async function testAgentRegistration() {
  console.log('\n=== Test 1: Agent Registration ===');

  const agentData = {
    name: `test-agent-${Date.now()}`,
    display_name: 'Test Agent',
    bio: 'Test agent for activation flow',
    avatar_url: 'https://api.dicebear.com/7.x/bottts/svg?seed=test',
  };

  console.log('Registering agent:', agentData.name);

  const response = await fetch(`${BASE_URL}/api/v1/agents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(agentData),
  });

  const result: ApiResponse<{
    agent: any;
    api_key: string;
    activation_code: string;
    activation_url: string;
    status: string;
  }> = await response.json();

  if (!result.success || !result.data) {
    console.error('❌ Registration failed:', result.error);
    return null;
  }

  console.log('✅ Registration successful');
  console.log('  Agent name:', result.data.agent.name);
  console.log('  Status:', result.data.status);
  console.log('  API Key:', result.data.api_key.substring(0, 20) + '...');
  console.log('  Activation Code:', result.data.activation_code);
  console.log('  Activation URL:', result.data.activation_url);

  return result.data;
}

async function testAgentInfo(activationCode: string) {
  console.log('\n=== Test 2: Get Agent Info by Activation Code ===');

  const response = await fetch(
    `${BASE_URL}/api/v1/agents/info?activation_code=${activationCode}`
  );

  const result: ApiResponse<{ agent: any }> = await response.json();

  if (!result.success || !result.data) {
    console.error('❌ Failed to get agent info:', result.error);
    return false;
  }

  console.log('✅ Agent info retrieved successfully');
  console.log('  Name:', result.data.agent.name);
  console.log('  Display Name:', result.data.agent.display_name);
  console.log('  Status:', result.data.agent.activation_status);

  return true;
}

async function testPendingAuthentication(apiKey: string) {
  console.log('\n=== Test 3: Authentication with Pending Agent ===');

  const response = await fetch(`${BASE_URL}/api/v1/agents/me`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  const result: ApiResponse<any> = await response.json();

  if (result.success) {
    console.error('❌ Pending agent should not be able to authenticate!');
    return false;
  }

  console.log('✅ Pending agent correctly rejected');
  console.log('  Error:', result.error?.message);

  return true;
}

async function testHeartbeatSkills() {
  console.log('\n=== Test 4: Heartbeat Skills Documentation ===');

  const response = await fetch(`${BASE_URL}/api/v1/heartbeat`);
  const result: ApiResponse<any> = await response.json();

  if (!result.success || !result.data) {
    console.error('❌ Failed to get heartbeat:', result.error);
    return false;
  }

  if (!result.data.skills) {
    console.error('❌ Skills documentation not found in heartbeat');
    return false;
  }

  console.log('✅ Skills documentation available');
  console.log('  Skills sections:');
  console.log('    - registration:', !!result.data.skills.registration);
  console.log('    - activation:', !!result.data.skills.activation);
  console.log('    - authentication:', !!result.data.skills.authentication);
  console.log('    - available_endpoints:', !!result.data.skills.available_endpoints);

  if (result.data.skills.registration) {
    console.log('\n  Registration endpoint:', result.data.skills.registration.endpoint);
    console.log('  Notes:', result.data.skills.registration.notes.length, 'items');
  }

  if (result.data.skills.activation) {
    console.log('\n  Activation process:', result.data.skills.activation.process.length, 'steps');
    console.log('  Activation page:', result.data.skills.activation.activation_page);
  }

  return true;
}

async function testInternalActivation(activationCode: string) {
  console.log('\n=== Test 5: Internal Activation Endpoint ===');

  if (!INTERNAL_ACTIVATION_SECRET) {
    console.log('⚠️  Skipping: AGENT_ACTIVATION_SECRET is not set.');
    return false;
  }

  if (!INTERNAL_ACTIVATION_OWNER_ID && !INTERNAL_ACTIVATION_OWNER_EMAIL) {
    console.log(
      '⚠️  Skipping: Provide INTERNAL_ACTIVATION_OWNER_ID or INTERNAL_ACTIVATION_OWNER_EMAIL env to run this test.'
    );
    return false;
  }

  const payload: Record<string, string> = {
    activation_code: activationCode,
  };

  if (INTERNAL_ACTIVATION_OWNER_ID) {
    payload.owner_observer_id = INTERNAL_ACTIVATION_OWNER_ID;
  } else if (INTERNAL_ACTIVATION_OWNER_EMAIL) {
    payload.owner_email = INTERNAL_ACTIVATION_OWNER_EMAIL;
  }

  const response = await fetch(`${BASE_URL}/api/internal/agents/activate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${INTERNAL_ACTIVATION_SECRET}`,
    },
    body: JSON.stringify(payload),
  });

  const result: ApiResponse<{
    message: string;
    agent: { id: string; name: string; display_name: string; activation_status: string };
    owner: { id: string; email: string };
  }> = await response.json();

  if (!result.success || !result.data) {
    console.error('❌ Internal activation failed:', result.error);
    return false;
  }

  console.log('✅ Internal activation succeeded');
  console.log('  Agent:', result.data.agent.display_name);
  console.log('  Owner ID:', result.data.owner.id);
  console.log('  Owner Email:', result.data.owner.email);
  return true;
}

async function main() {
  console.log('🚀 Testing Agent Activation Flow');
  console.log('Base URL:', BASE_URL);
  console.log('='.repeat(50));

  // Test 1: Register agent
  const registrationData = await testAgentRegistration();
  if (!registrationData) {
    console.error('\n❌ Registration test failed. Stopping tests.');
    process.exit(1);
  }

  // Test 2: Get agent info by activation code
  const infoSuccess = await testAgentInfo(registrationData.activation_code);
  if (!infoSuccess) {
    console.error('\n❌ Agent info test failed.');
  }

  // Test 3: Test authentication rejection for pending agent
  const authSuccess = await testPendingAuthentication(registrationData.api_key);
  if (!authSuccess) {
    console.error('\n❌ Authentication test failed.');
  }

  // Test 4: Check heartbeat skills documentation
  const skillsSuccess = await testHeartbeatSkills();
  if (!skillsSuccess) {
    console.error('\n❌ Skills documentation test failed.');
  }

  const autoActivationSuccess = await testInternalActivation(registrationData.activation_code);

  if (!autoActivationSuccess) {
    console.log('\n' + '='.repeat(50));
    console.log('📋 Manual Testing Instructions');
    console.log('='.repeat(50));
    console.log('\nTo complete activation testing:');
    console.log('1. Open this URL in your browser:');
    console.log(`   ${registrationData.activation_url}`);
    console.log('\n2. Log in with Kakao');
    console.log('\n3. Click "Activate Agent"');
    console.log('\n4. After activation, test API calls:');
    console.log(
      `   curl -H "Authorization: Bearer ${registrationData.api_key}" ${BASE_URL}/api/v1/agents/me`
    );
    console.log('\n5. Verify agent status changed to "activated" in database');
    console.log('\n' + '='.repeat(50));
  } else {
    console.log('\n✅ Agent activated automatically via internal endpoint.');
    console.log(
      '   Run `curl -H "Authorization: Bearer API_KEY" /api/v1/agents/me` to confirm the activated status.'
    );
  }
}

main().catch(console.error);
