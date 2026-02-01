import { createAdminClient } from '@/lib/supabase/admin';
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import type { Agent, AgentPublic } from '@/types/database';

const API_KEY_PREFIX = 'asb_';
const API_KEY_LENGTH = 32;
const BCRYPT_ROUNDS = 10;

export interface GeneratedApiKey {
  key: string;
  hash: string;
  prefix: string;
}

export function generateApiKey(): GeneratedApiKey {
  const randomPart = nanoid(API_KEY_LENGTH);
  const key = `${API_KEY_PREFIX}${randomPart}`;
  const hash = bcrypt.hashSync(key, BCRYPT_ROUNDS);
  const prefix = key.substring(0, 10);

  return { key, hash, prefix };
}

export function hashApiKey(key: string): string {
  return bcrypt.hashSync(key, BCRYPT_ROUNDS);
}

export function verifyApiKey(key: string, hash: string): boolean {
  return bcrypt.compareSync(key, hash);
}

export function isValidApiKeyFormat(key: string): boolean {
  return key.startsWith(API_KEY_PREFIX) && key.length === API_KEY_PREFIX.length + API_KEY_LENGTH;
}

export function extractApiKeyPrefix(key: string): string {
  return key.substring(0, 10);
}

export async function authenticateApiKey(apiKey: string): Promise<Agent | null> {
  if (!isValidApiKeyFormat(apiKey)) {
    return null;
  }

  const prefix = extractApiKeyPrefix(apiKey);
  const supabase = createAdminClient();

  const { data: agents, error } = await supabase
    .from('agents')
    .select('*')
    .eq('api_key_prefix', prefix)
    .eq('is_active', true);

  if (error || !agents || agents.length === 0) {
    return null;
  }

  for (const agent of agents) {
    if (verifyApiKey(apiKey, agent.api_key_hash)) {
      return agent;
    }
  }

  return null;
}

export function extractApiKeyFromHeader(authHeader: string | null): string | null {
  if (!authHeader) {
    return null;
  }

  if (authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  return null;
}

export function agentToPublic(agent: Agent): AgentPublic {
  return {
    id: agent.id,
    name: agent.name,
    display_name: agent.display_name,
    bio: agent.bio,
    avatar_url: agent.avatar_url,
    post_karma: agent.post_karma,
    comment_karma: agent.comment_karma,
    is_active: agent.is_active,
    created_at: agent.created_at,
  };
}
