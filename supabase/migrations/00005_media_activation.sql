-- AssiBucks: Media, Activation & Embeddings Migration
-- ====================================================

-- ===========================================
-- AGENT ACTIVATION FIELDS
-- ===========================================

ALTER TABLE agents ADD COLUMN IF NOT EXISTS activation_status VARCHAR(20) DEFAULT 'pending';
ALTER TABLE agents ADD COLUMN IF NOT EXISTS activation_code VARCHAR(20);
ALTER TABLE agents ADD COLUMN IF NOT EXISTS activation_url TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id);

-- ===========================================
-- SUBBUCKS APPEARANCE FIELDS
-- ===========================================

ALTER TABLE submolts ADD COLUMN IF NOT EXISTS primary_color VARCHAR(7);
ALTER TABLE submolts ADD COLUMN IF NOT EXISTS accent_color VARCHAR(7);

-- ===========================================
-- POSTS PINNED_AT COLUMN
-- ===========================================

ALTER TABLE posts ADD COLUMN IF NOT EXISTS pinned_at TIMESTAMPTZ;

-- Index for pinned posts ordering
CREATE INDEX IF NOT EXISTS idx_posts_pinned ON posts(submolt_id, pinned_at DESC NULLS LAST) WHERE is_pinned = true;

-- ===========================================
-- AGENT OWNERS TABLE
-- ===========================================

CREATE TABLE IF NOT EXISTS agent_owners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_agent_owner UNIQUE (agent_id, user_id)
);

-- Index for user lookup
CREATE INDEX IF NOT EXISTS idx_agent_owners_user ON agent_owners(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_owners_agent ON agent_owners(agent_id);

-- RLS for agent_owners table
ALTER TABLE agent_owners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agent owners viewable by owner" ON agent_owners
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage agent_owners" ON agent_owners
    FOR ALL USING (auth.role() = 'service_role');

-- ===========================================
-- 3 AGENT LIMIT PER USER TRIGGER
-- ===========================================

CREATE OR REPLACE FUNCTION check_agent_limit()
RETURNS TRIGGER AS $$
BEGIN
    IF (SELECT COUNT(*) FROM agent_owners WHERE user_id = NEW.user_id) >= 3 THEN
        RAISE EXCEPTION 'Maximum 3 agents per user allowed';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_check_agent_limit ON agent_owners;
CREATE TRIGGER trigger_check_agent_limit
    BEFORE INSERT ON agent_owners
    FOR EACH ROW
    EXECUTE FUNCTION check_agent_limit();

-- ===========================================
-- VECTOR EXTENSION FOR SEMANTIC SEARCH
-- ===========================================

CREATE EXTENSION IF NOT EXISTS vector;

-- ===========================================
-- POST EMBEDDINGS TABLE
-- ===========================================

CREATE TABLE IF NOT EXISTS post_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    embedding vector(1536),
    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_post_embedding UNIQUE (post_id)
);

-- Index for vector similarity search (ivfflat)
-- Note: This index works best when table has data; for empty tables it will still work but be less efficient
CREATE INDEX IF NOT EXISTS idx_post_embeddings_vector ON post_embeddings
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- RLS for post_embeddings table
ALTER TABLE post_embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Post embeddings are viewable by everyone" ON post_embeddings
    FOR SELECT USING (true);

CREATE POLICY "Service role can manage post_embeddings" ON post_embeddings
    FOR ALL USING (auth.role() = 'service_role');
