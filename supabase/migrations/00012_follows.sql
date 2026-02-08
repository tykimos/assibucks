-- AssiBucks: Polymorphic Follow System (ALTER existing table)
-- Preserves existing agent-to-agent follows data

-- Step 1: Drop old trigger and function
DROP TRIGGER IF EXISTS trigger_update_follow_counts ON follows;
DROP FUNCTION IF EXISTS update_follow_counts();

-- Step 2: Drop old constraints and indexes
ALTER TABLE follows DROP CONSTRAINT IF EXISTS unique_follow;
ALTER TABLE follows DROP CONSTRAINT IF EXISTS no_self_follow;
DROP INDEX IF EXISTS idx_follows_follower;
DROP INDEX IF EXISTS idx_follows_following;
DROP INDEX IF EXISTS idx_follows_created;

-- Step 3: Add new columns
ALTER TABLE follows ADD COLUMN IF NOT EXISTS follower_agent_id UUID REFERENCES agents(id) ON DELETE CASCADE;
ALTER TABLE follows ADD COLUMN IF NOT EXISTS follower_observer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE follows ADD COLUMN IF NOT EXISTS follower_type TEXT;
ALTER TABLE follows ADD COLUMN IF NOT EXISTS followed_agent_id UUID REFERENCES agents(id) ON DELETE CASCADE;
ALTER TABLE follows ADD COLUMN IF NOT EXISTS followed_observer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE follows ADD COLUMN IF NOT EXISTS followed_type TEXT;

-- Step 4: Migrate existing data (old follower_id/following_id → new columns)
UPDATE follows
SET follower_agent_id = follower_id,
    follower_type = 'agent',
    followed_agent_id = following_id,
    followed_type = 'agent'
WHERE follower_agent_id IS NULL AND follower_id IS NOT NULL;

-- Step 5: Make type columns NOT NULL
ALTER TABLE follows ALTER COLUMN follower_type SET NOT NULL;
ALTER TABLE follows ALTER COLUMN followed_type SET NOT NULL;

-- Step 6: Drop old columns
ALTER TABLE follows DROP COLUMN IF EXISTS follower_id;
ALTER TABLE follows DROP COLUMN IF EXISTS following_id;

-- Step 7: Add new constraints
ALTER TABLE follows ADD CONSTRAINT follow_follower_check CHECK (
  (follower_type = 'agent' AND follower_agent_id IS NOT NULL AND follower_observer_id IS NULL) OR
  (follower_type = 'human' AND follower_observer_id IS NOT NULL AND follower_agent_id IS NULL)
);
ALTER TABLE follows ADD CONSTRAINT follow_followed_check CHECK (
  (followed_type = 'agent' AND followed_agent_id IS NOT NULL AND followed_observer_id IS NULL) OR
  (followed_type = 'human' AND followed_observer_id IS NOT NULL AND followed_agent_id IS NULL)
);
ALTER TABLE follows ADD CONSTRAINT no_self_follow CHECK (
  NOT (follower_agent_id IS NOT NULL AND follower_agent_id = followed_agent_id) AND
  NOT (follower_observer_id IS NOT NULL AND follower_observer_id = followed_observer_id)
);

-- Step 8: Add new indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_follows_unique ON follows(
  COALESCE(follower_agent_id, '00000000-0000-0000-0000-000000000000'),
  COALESCE(follower_observer_id, '00000000-0000-0000-0000-000000000000'),
  COALESCE(followed_agent_id, '00000000-0000-0000-0000-000000000000'),
  COALESCE(followed_observer_id, '00000000-0000-0000-0000-000000000000')
);

CREATE INDEX IF NOT EXISTS idx_follows_follower_agent ON follows(follower_agent_id) WHERE follower_agent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_follows_follower_observer ON follows(follower_observer_id) WHERE follower_observer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_follows_followed_agent ON follows(followed_agent_id) WHERE followed_agent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_follows_followed_observer ON follows(followed_observer_id) WHERE followed_observer_id IS NOT NULL;

-- Step 9: Update RLS policies
DROP POLICY IF EXISTS "Follows are viewable by everyone" ON follows;
DROP POLICY IF EXISTS "Follows viewable by everyone" ON follows;
DROP POLICY IF EXISTS "Service role can manage follows" ON follows;

CREATE POLICY "Follows viewable by everyone" ON follows
  FOR SELECT USING (true);

CREATE POLICY "Service role can manage follows" ON follows
  FOR ALL USING (auth.role() = 'service_role');

-- Step 10: Add performance indexes for common queries
CREATE INDEX IF NOT EXISTS idx_posts_submolt_hot ON posts(submolt_id, hot_score DESC) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_posts_submolt_new ON posts(submolt_id, created_at DESC) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_posts_agent_id ON posts(agent_id) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_dm_conversations_p1_agent ON dm_conversations(participant1_agent_id) WHERE participant1_agent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_dm_conversations_p2_agent ON dm_conversations(participant2_agent_id) WHERE participant2_agent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_dm_conversations_p1_observer ON dm_conversations(participant1_observer_id) WHERE participant1_observer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_dm_conversations_p2_observer ON dm_conversations(participant2_observer_id) WHERE participant2_observer_id IS NOT NULL;

-- Step 11: Stats function (replaces 10 individual COUNT queries)
CREATE OR REPLACE FUNCTION get_platform_stats()
RETURNS JSON AS $$
DECLARE
  result JSON;
  today_start TIMESTAMPTZ;
BEGIN
  today_start := date_trunc('day', NOW());

  SELECT json_build_object(
    'agents', json_build_object(
      'total', (SELECT COUNT(*) FROM agents WHERE is_active = true),
      'today', (SELECT COUNT(*) FROM agents WHERE is_active = true AND created_at >= today_start)
    ),
    'observers', json_build_object(
      'total', (SELECT COUNT(*) FROM observers),
      'today', (SELECT COUNT(*) FROM observers WHERE created_at >= today_start)
    ),
    'posts', json_build_object(
      'total', (SELECT COUNT(*) FROM posts WHERE is_deleted = false),
      'today', (SELECT COUNT(*) FROM posts WHERE is_deleted = false AND created_at >= today_start)
    ),
    'comments', json_build_object(
      'total', (SELECT COUNT(*) FROM comments WHERE is_deleted = false),
      'today', (SELECT COUNT(*) FROM comments WHERE is_deleted = false AND created_at >= today_start)
    ),
    'subbucks', json_build_object(
      'total', (SELECT COUNT(*) FROM submolts WHERE is_active = true),
      'today', (SELECT COUNT(*) FROM submolts WHERE is_active = true AND created_at >= today_start)
    )
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
