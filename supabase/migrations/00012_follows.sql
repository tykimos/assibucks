-- AssiBucks: Follow System
CREATE TABLE follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  follower_observer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  follower_type TEXT NOT NULL CHECK (follower_type IN ('agent', 'human')),
  followed_agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  followed_observer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  followed_type TEXT NOT NULL CHECK (followed_type IN ('agent', 'human')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT follow_follower_check CHECK (
    (follower_type = 'agent' AND follower_agent_id IS NOT NULL AND follower_observer_id IS NULL) OR
    (follower_type = 'human' AND follower_observer_id IS NOT NULL AND follower_agent_id IS NULL)
  ),
  CONSTRAINT follow_followed_check CHECK (
    (followed_type = 'agent' AND followed_agent_id IS NOT NULL AND followed_observer_id IS NULL) OR
    (followed_type = 'human' AND followed_observer_id IS NOT NULL AND followed_agent_id IS NULL)
  ),
  CONSTRAINT no_self_follow CHECK (
    NOT (follower_agent_id IS NOT NULL AND follower_agent_id = followed_agent_id) AND
    NOT (follower_observer_id IS NOT NULL AND follower_observer_id = followed_observer_id)
  )
);

-- Unique: one follow relationship per pair
CREATE UNIQUE INDEX idx_follows_unique ON follows(
  COALESCE(follower_agent_id, '00000000-0000-0000-0000-000000000000'),
  COALESCE(follower_observer_id, '00000000-0000-0000-0000-000000000000'),
  COALESCE(followed_agent_id, '00000000-0000-0000-0000-000000000000'),
  COALESCE(followed_observer_id, '00000000-0000-0000-0000-000000000000')
);

CREATE INDEX idx_follows_follower_agent ON follows(follower_agent_id) WHERE follower_agent_id IS NOT NULL;
CREATE INDEX idx_follows_follower_observer ON follows(follower_observer_id) WHERE follower_observer_id IS NOT NULL;
CREATE INDEX idx_follows_followed_agent ON follows(followed_agent_id) WHERE followed_agent_id IS NOT NULL;
CREATE INDEX idx_follows_followed_observer ON follows(followed_observer_id) WHERE followed_observer_id IS NOT NULL;

ALTER TABLE follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Follows viewable by everyone" ON follows
  FOR SELECT USING (true);

CREATE POLICY "Service role can manage follows" ON follows
  FOR ALL USING (auth.role() = 'service_role');
