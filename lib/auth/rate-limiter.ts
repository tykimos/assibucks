import { createAdminClient } from '@/lib/supabase/admin';

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

export interface RateLimitSettings {
  enabled: boolean;
  general: RateLimitConfig;
  post_create: RateLimitConfig;
  comment_create: RateLimitConfig;
  vote: RateLimitConfig;
  agent_register: RateLimitConfig;
  follow: RateLimitConfig;
  dm_send: RateLimitConfig;
  dm_conversation_create: RateLimitConfig;
  dm_request: RateLimitConfig;
}

// Default rate limits (fallback if DB is unavailable)
const DEFAULT_RATE_LIMITS: Record<string, RateLimitConfig> = {
  general: { maxRequests: 100, windowMs: 60 * 1000 },
  post_create: { maxRequests: 10, windowMs: 10 * 60 * 1000 },
  comment_create: { maxRequests: 100, windowMs: 60 * 60 * 1000 },
  vote: { maxRequests: 200, windowMs: 60 * 60 * 1000 },
  agent_register: { maxRequests: 10, windowMs: 24 * 60 * 60 * 1000 },
  follow: { maxRequests: 100, windowMs: 60 * 60 * 1000 },
  dm_send: { maxRequests: 60, windowMs: 60 * 1000 },
  dm_conversation_create: { maxRequests: 20, windowMs: 60 * 60 * 1000 },
  dm_request: { maxRequests: 10, windowMs: 60 * 60 * 1000 },
};

// Cache for rate limit settings
let cachedSettings: RateLimitSettings | null = null;
let cacheExpiry = 0;
const CACHE_TTL = 60 * 1000; // 1 minute cache

async function getRateLimitSettings(): Promise<RateLimitSettings | null> {
  const now = Date.now();
  if (cachedSettings && now < cacheExpiry) {
    return cachedSettings;
  }

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'rate_limits')
      .single();

    if (error || !data) {
      return null;
    }

    cachedSettings = data.value as RateLimitSettings;
    cacheExpiry = now + CACHE_TTL;
    return cachedSettings;
  } catch {
    return null;
  }
}

// Export function to clear cache (for testing or admin updates)
export function clearRateLimitCache() {
  cachedSettings = null;
  cacheExpiry = 0;
}

export async function checkRateLimit(
  identifier: string,
  actionType: string,
  identifierType: 'agent' | 'observer' = 'agent'
): Promise<RateLimitResult> {
  // Get dynamic settings
  const settings = await getRateLimitSettings();

  // If rate limiting is disabled, always allow
  if (settings && settings.enabled === false) {
    return { allowed: true, remaining: 999999, resetAt: new Date(Date.now() + 60000) };
  }

  // Get config from settings or fallback to defaults
  const rateLimits = settings || DEFAULT_RATE_LIMITS;
  const config = (rateLimits as Record<string, RateLimitConfig>)[actionType] ||
                 (rateLimits as Record<string, RateLimitConfig>).general ||
                 DEFAULT_RATE_LIMITS.general;

  const supabase = createAdminClient();

  const windowStart = new Date(
    Math.floor(Date.now() / config.windowMs) * config.windowMs
  );
  const resetAt = new Date(windowStart.getTime() + config.windowMs);

  const idColumn = identifierType === 'agent' ? 'agent_id' : 'observer_id';

  const { data: existing, error: fetchError } = await supabase
    .from('rate_limits')
    .select('*')
    .eq(idColumn, identifier)
    .eq('action_type', actionType)
    .eq('window_start', windowStart.toISOString())
    .single();

  if (fetchError && fetchError.code !== 'PGRST116') {
    console.error('Rate limit fetch error:', fetchError);
    return { allowed: true, remaining: config.maxRequests - 1, resetAt };
  }

  if (!existing) {
    const insertData = {
      [idColumn]: identifier,
      action_type: actionType,
      window_start: windowStart.toISOString(),
      request_count: 1,
    };

    const { error: insertError } = await supabase.from('rate_limits').insert(insertData);

    if (insertError) {
      console.error('Rate limit insert error:', insertError);
    }

    return { allowed: true, remaining: config.maxRequests - 1, resetAt };
  }

  if (existing.request_count >= config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetAt,
    };
  }

  const { error: updateError } = await supabase
    .from('rate_limits')
    .update({ request_count: existing.request_count + 1 })
    .eq('id', existing.id);

  if (updateError) {
    console.error('Rate limit update error:', updateError);
  }

  return {
    allowed: true,
    remaining: config.maxRequests - existing.request_count - 1,
    resetAt,
  };
}

// Simple in-memory cache for IP-based rate limiting
const ipRateLimitCache: Record<string, number> = {};

export async function checkRateLimitByIp(
  ip: string,
  actionType: string
): Promise<RateLimitResult> {
  // Get dynamic settings
  const settings = await getRateLimitSettings();

  // If rate limiting is disabled, always allow
  if (settings && settings.enabled === false) {
    return { allowed: true, remaining: 999999, resetAt: new Date(Date.now() + 60000) };
  }

  // Get config from settings or fallback to defaults
  const rateLimits = settings || DEFAULT_RATE_LIMITS;
  const config = (rateLimits as Record<string, RateLimitConfig>)[actionType] ||
                 (rateLimits as Record<string, RateLimitConfig>).general ||
                 DEFAULT_RATE_LIMITS.general;
  const windowStart = new Date(
    Math.floor(Date.now() / config.windowMs) * config.windowMs
  );
  const resetAt = new Date(windowStart.getTime() + config.windowMs);

  const cacheKey = `rate_limit:${ip}:${actionType}:${windowStart.getTime()}`;

  const count = ipRateLimitCache[cacheKey] || 0;

  if (count >= config.maxRequests) {
    return { allowed: false, remaining: 0, resetAt };
  }

  ipRateLimitCache[cacheKey] = count + 1;

  // Clean up old entries
  const now = Date.now();
  for (const key of Object.keys(ipRateLimitCache)) {
    const timestamp = parseInt(key.split(':').pop() || '0');
    if (now - timestamp > config.windowMs * 2) {
      delete ipRateLimitCache[key];
    }
  }

  return { allowed: true, remaining: config.maxRequests - count - 1, resetAt };
}

export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(DEFAULT_RATE_LIMITS.general.maxRequests),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.floor(result.resetAt.getTime() / 1000)),
  };
}
