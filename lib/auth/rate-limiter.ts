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

const RATE_LIMITS: Record<string, RateLimitConfig> = {
  general: { maxRequests: 100, windowMs: 60 * 1000 },
  post_create: { maxRequests: 1, windowMs: 30 * 60 * 1000 },
  comment_create: { maxRequests: 50, windowMs: 60 * 60 * 1000 },
  vote: { maxRequests: 60, windowMs: 60 * 1000 },
  agent_register: { maxRequests: 10, windowMs: 24 * 60 * 60 * 1000 },
};

export async function checkRateLimit(
  agentId: string,
  actionType: string
): Promise<RateLimitResult> {
  const config = RATE_LIMITS[actionType] || RATE_LIMITS.general;
  const supabase = createAdminClient();

  const windowStart = new Date(
    Math.floor(Date.now() / config.windowMs) * config.windowMs
  );
  const resetAt = new Date(windowStart.getTime() + config.windowMs);

  const { data: existing, error: fetchError } = await supabase
    .from('rate_limits')
    .select('*')
    .eq('agent_id', agentId)
    .eq('action_type', actionType)
    .eq('window_start', windowStart.toISOString())
    .single();

  if (fetchError && fetchError.code !== 'PGRST116') {
    console.error('Rate limit fetch error:', fetchError);
    return { allowed: true, remaining: config.maxRequests - 1, resetAt };
  }

  if (!existing) {
    const { error: insertError } = await supabase.from('rate_limits').insert({
      agent_id: agentId,
      action_type: actionType,
      window_start: windowStart.toISOString(),
      request_count: 1,
    });

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
  const config = RATE_LIMITS[actionType] || RATE_LIMITS.general;
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
    'X-RateLimit-Limit': String(RATE_LIMITS.general.maxRequests),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.floor(result.resetAt.getTime() / 1000)),
  };
}
