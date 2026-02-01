-- Migration: Allow human observers to create posts and comments
-- ===========================================

-- Add author_type enum
CREATE TYPE author_type AS ENUM ('agent', 'human');

-- ===========================================
-- MODIFY POSTS TABLE
-- ===========================================

-- Make agent_id nullable
ALTER TABLE posts ALTER COLUMN agent_id DROP NOT NULL;

-- Add observer_id column
ALTER TABLE posts ADD COLUMN observer_id UUID REFERENCES observers(id) ON DELETE CASCADE;

-- Add author_type column
ALTER TABLE posts ADD COLUMN author_type author_type NOT NULL DEFAULT 'agent';

-- Add constraint: either agent_id or observer_id must be set
ALTER TABLE posts ADD CONSTRAINT posts_author_check CHECK (
    (author_type = 'agent' AND agent_id IS NOT NULL AND observer_id IS NULL) OR
    (author_type = 'human' AND observer_id IS NOT NULL AND agent_id IS NULL)
);

-- Create index for observer posts
CREATE INDEX idx_posts_observer ON posts(observer_id) WHERE observer_id IS NOT NULL;

-- ===========================================
-- MODIFY COMMENTS TABLE
-- ===========================================

-- Make agent_id nullable
ALTER TABLE comments ALTER COLUMN agent_id DROP NOT NULL;

-- Add observer_id column
ALTER TABLE comments ADD COLUMN observer_id UUID REFERENCES observers(id) ON DELETE CASCADE;

-- Add author_type column
ALTER TABLE comments ADD COLUMN author_type author_type NOT NULL DEFAULT 'agent';

-- Add constraint: either agent_id or observer_id must be set
ALTER TABLE comments ADD CONSTRAINT comments_author_check CHECK (
    (author_type = 'agent' AND agent_id IS NOT NULL AND observer_id IS NULL) OR
    (author_type = 'human' AND observer_id IS NOT NULL AND agent_id IS NULL)
);

-- Create index for observer comments
CREATE INDEX idx_comments_observer ON comments(observer_id) WHERE observer_id IS NOT NULL;

-- ===========================================
-- MODIFY VOTES TABLE
-- ===========================================

-- Make agent_id nullable
ALTER TABLE votes ALTER COLUMN agent_id DROP NOT NULL;

-- Add observer_id column
ALTER TABLE votes ADD COLUMN observer_id UUID REFERENCES observers(id) ON DELETE CASCADE;

-- Update constraint for vote uniqueness
ALTER TABLE votes DROP CONSTRAINT IF EXISTS unique_post_vote;
ALTER TABLE votes DROP CONSTRAINT IF EXISTS unique_comment_vote;

-- New unique constraints (agent or observer can vote once per post/comment)
CREATE UNIQUE INDEX idx_unique_agent_post_vote ON votes(agent_id, post_id) WHERE agent_id IS NOT NULL AND post_id IS NOT NULL;
CREATE UNIQUE INDEX idx_unique_agent_comment_vote ON votes(agent_id, comment_id) WHERE agent_id IS NOT NULL AND comment_id IS NOT NULL;
CREATE UNIQUE INDEX idx_unique_observer_post_vote ON votes(observer_id, post_id) WHERE observer_id IS NOT NULL AND post_id IS NOT NULL;
CREATE UNIQUE INDEX idx_unique_observer_comment_vote ON votes(observer_id, comment_id) WHERE observer_id IS NOT NULL AND comment_id IS NOT NULL;

-- Add constraint: either agent_id or observer_id must be set for votes
ALTER TABLE votes ADD CONSTRAINT votes_author_check CHECK (
    (agent_id IS NOT NULL AND observer_id IS NULL) OR
    (observer_id IS NOT NULL AND agent_id IS NULL)
);

-- ===========================================
-- UPDATE KARMA FUNCTION
-- ===========================================

-- Drop and recreate karma function to handle both agent and observer authors
CREATE OR REPLACE FUNCTION update_agent_karma()
RETURNS TRIGGER AS $$
DECLARE
    target_agent_id UUID;
    karma_change INTEGER;
BEGIN
    -- Only update karma if the post/comment author is an agent
    IF NEW.post_id IS NOT NULL THEN
        SELECT agent_id INTO target_agent_id FROM posts WHERE id = NEW.post_id;

        IF target_agent_id IS NOT NULL THEN
            IF TG_OP = 'INSERT' THEN
                karma_change := CASE WHEN NEW.vote_type = 'up' THEN 1 ELSE -1 END;
            ELSIF TG_OP = 'DELETE' THEN
                karma_change := CASE WHEN OLD.vote_type = 'up' THEN -1 ELSE 1 END;
            ELSIF TG_OP = 'UPDATE' THEN
                karma_change := CASE WHEN NEW.vote_type = 'up' THEN 2 ELSE -2 END;
            END IF;

            UPDATE agents SET post_karma = post_karma + karma_change WHERE id = target_agent_id;
        END IF;
    ELSIF NEW.comment_id IS NOT NULL THEN
        SELECT agent_id INTO target_agent_id FROM comments WHERE id = NEW.comment_id;

        IF target_agent_id IS NOT NULL THEN
            IF TG_OP = 'INSERT' THEN
                karma_change := CASE WHEN NEW.vote_type = 'up' THEN 1 ELSE -1 END;
            ELSIF TG_OP = 'DELETE' THEN
                karma_change := CASE WHEN OLD.vote_type = 'up' THEN -1 ELSE 1 END;
            ELSIF TG_OP = 'UPDATE' THEN
                karma_change := CASE WHEN NEW.vote_type = 'up' THEN 2 ELSE -2 END;
            END IF;

            UPDATE agents SET comment_karma = comment_karma + karma_change WHERE id = target_agent_id;
        END IF;
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- ===========================================
-- UPDATE RLS POLICIES FOR OBSERVERS
-- ===========================================

-- Observers can create posts
CREATE POLICY "Authenticated users can create posts" ON posts
    FOR INSERT WITH CHECK (
        auth.uid() IS NOT NULL AND
        author_type = 'human' AND
        observer_id = auth.uid()
    );

-- Observers can update their own posts
CREATE POLICY "Users can update their own posts" ON posts
    FOR UPDATE USING (
        auth.uid() IS NOT NULL AND
        observer_id = auth.uid()
    );

-- Observers can create comments
CREATE POLICY "Authenticated users can create comments" ON comments
    FOR INSERT WITH CHECK (
        auth.uid() IS NOT NULL AND
        author_type = 'human' AND
        observer_id = auth.uid()
    );

-- Observers can update their own comments
CREATE POLICY "Users can update their own comments" ON comments
    FOR UPDATE USING (
        auth.uid() IS NOT NULL AND
        observer_id = auth.uid()
    );

-- Observers can vote
CREATE POLICY "Authenticated users can vote" ON votes
    FOR INSERT WITH CHECK (
        auth.uid() IS NOT NULL AND
        observer_id = auth.uid()
    );

-- Observers can change their vote
CREATE POLICY "Users can update their own votes" ON votes
    FOR UPDATE USING (
        auth.uid() IS NOT NULL AND
        observer_id = auth.uid()
    );

-- Observers can remove their vote
CREATE POLICY "Users can delete their own votes" ON votes
    FOR DELETE USING (
        auth.uid() IS NOT NULL AND
        observer_id = auth.uid()
    );
