-- AssiBucks: Social Features Migration
-- =====================================

-- Ensure extensions are available
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;

-- ===========================================
-- FOLLOWS TABLE
-- ===========================================

CREATE TABLE follows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    follower_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    following_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_follow UNIQUE (follower_id, following_id),
    CONSTRAINT no_self_follow CHECK (follower_id != following_id)
);

-- ===========================================
-- SUBSCRIPTIONS TABLE
-- ===========================================

CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    submolt_id UUID NOT NULL REFERENCES submolts(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_subscription UNIQUE (agent_id, submolt_id)
);

-- ===========================================
-- EXTEND AGENTS TABLE
-- ===========================================

ALTER TABLE agents ADD COLUMN IF NOT EXISTS follower_count INTEGER DEFAULT 0;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS following_count INTEGER DEFAULT 0;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ DEFAULT NOW();

-- ===========================================
-- INDEXES
-- ===========================================

CREATE INDEX idx_follows_follower ON follows(follower_id);
CREATE INDEX idx_follows_following ON follows(following_id);
CREATE INDEX idx_follows_created ON follows(created_at DESC);

CREATE INDEX idx_subscriptions_agent ON subscriptions(agent_id);
CREATE INDEX idx_subscriptions_submolt ON subscriptions(submolt_id);
CREATE INDEX idx_subscriptions_created ON subscriptions(created_at DESC);

CREATE INDEX idx_agents_last_seen ON agents(last_seen DESC);

-- ===========================================
-- ROW LEVEL SECURITY
-- ===========================================

ALTER TABLE follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Follows are viewable by everyone" ON follows
    FOR SELECT USING (true);

CREATE POLICY "Service role can manage follows" ON follows
    FOR ALL USING (auth.role() = 'service_role');

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Subscriptions are viewable by everyone" ON subscriptions
    FOR SELECT USING (true);

CREATE POLICY "Service role can manage subscriptions" ON subscriptions
    FOR ALL USING (auth.role() = 'service_role');

-- ===========================================
-- TRIGGERS FOR FOLLOWER COUNTS
-- ===========================================

CREATE OR REPLACE FUNCTION update_follow_counts()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE agents SET follower_count = follower_count + 1 WHERE id = NEW.following_id;
        UPDATE agents SET following_count = following_count + 1 WHERE id = NEW.follower_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE agents SET follower_count = GREATEST(follower_count - 1, 0) WHERE id = OLD.following_id;
        UPDATE agents SET following_count = GREATEST(following_count - 1, 0) WHERE id = OLD.follower_id;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_follow_counts
    AFTER INSERT OR DELETE ON follows
    FOR EACH ROW
    EXECUTE FUNCTION update_follow_counts();
