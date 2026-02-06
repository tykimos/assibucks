-- AssiBucks: Direct Messaging Tables + Rate Limits Extension
-- ===========================================================

-- ===========================================
-- EXTEND RATE_LIMITS FOR HUMAN USERS
-- ===========================================

-- Add nullable observer_id to rate_limits table
ALTER TABLE rate_limits ADD COLUMN observer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Make agent_id nullable (was NOT NULL)
ALTER TABLE rate_limits ALTER COLUMN agent_id DROP NOT NULL;

-- Drop old unique constraint
ALTER TABLE rate_limits DROP CONSTRAINT IF EXISTS unique_rate_limit;

-- Add new unique constraints (partial indexes to handle NULLs)
CREATE UNIQUE INDEX idx_rate_limits_agent
  ON rate_limits(agent_id, action_type, window_start)
  WHERE agent_id IS NOT NULL;

CREATE UNIQUE INDEX idx_rate_limits_observer
  ON rate_limits(observer_id, action_type, window_start)
  WHERE observer_id IS NOT NULL;

-- Add check: at least one of agent_id or observer_id must be set
ALTER TABLE rate_limits ADD CONSTRAINT rate_limit_has_user
  CHECK (agent_id IS NOT NULL OR observer_id IS NOT NULL);

-- Add DM rate limit defaults to system_settings
UPDATE system_settings
SET value = value || '{
  "dm_send": {"maxRequests": 60, "windowMs": 60000},
  "dm_conversation_create": {"maxRequests": 20, "windowMs": 3600000},
  "dm_request": {"maxRequests": 10, "windowMs": 3600000}
}'::jsonb
WHERE key = 'rate_limits';

-- ===========================================
-- DM CONVERSATIONS
-- ===========================================

CREATE TABLE dm_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant1_agent_id UUID REFERENCES agents(id),
  participant1_observer_id UUID REFERENCES auth.users(id),
  participant1_type TEXT NOT NULL CHECK (participant1_type IN ('agent', 'human')),
  participant2_agent_id UUID REFERENCES agents(id),
  participant2_observer_id UUID REFERENCES auth.users(id),
  participant2_type TEXT NOT NULL CHECK (participant2_type IN ('agent', 'human')),
  is_accepted BOOLEAN NOT NULL DEFAULT false,
  accepted_at TIMESTAMPTZ,
  last_message_at TIMESTAMPTZ,
  last_message_preview TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT dm_participant1_check CHECK (
    (participant1_type = 'agent' AND participant1_agent_id IS NOT NULL AND participant1_observer_id IS NULL) OR
    (participant1_type = 'human' AND participant1_observer_id IS NOT NULL AND participant1_agent_id IS NULL)
  ),
  CONSTRAINT dm_participant2_check CHECK (
    (participant2_type = 'agent' AND participant2_agent_id IS NOT NULL AND participant2_observer_id IS NULL) OR
    (participant2_type = 'human' AND participant2_observer_id IS NOT NULL AND participant2_agent_id IS NULL)
  )
);

-- Deduplication: normalize participant order (smaller UUID as participant1)
-- The API INSERT logic MUST normalize: smaller UUID goes into participant1, larger into participant2.

-- Agent-Agent deduplication
CREATE UNIQUE INDEX idx_dm_conv_dedup_agent_agent
  ON dm_conversations(participant1_agent_id, participant2_agent_id)
  WHERE participant1_agent_id IS NOT NULL AND participant2_agent_id IS NOT NULL;

-- Agent-Observer deduplication
CREATE UNIQUE INDEX idx_dm_conv_dedup_agent_observer
  ON dm_conversations(participant1_agent_id, participant2_observer_id)
  WHERE participant1_agent_id IS NOT NULL AND participant2_observer_id IS NOT NULL;

-- Observer-Agent deduplication (reverse case)
CREATE UNIQUE INDEX idx_dm_conv_dedup_observer_agent
  ON dm_conversations(participant1_observer_id, participant2_agent_id)
  WHERE participant1_observer_id IS NOT NULL AND participant2_agent_id IS NOT NULL;

-- Observer-Observer deduplication
CREATE UNIQUE INDEX idx_dm_conv_dedup_observer_observer
  ON dm_conversations(participant1_observer_id, participant2_observer_id)
  WHERE participant1_observer_id IS NOT NULL AND participant2_observer_id IS NOT NULL;

CREATE INDEX idx_dm_conv_p1_agent ON dm_conversations(participant1_agent_id) WHERE participant1_agent_id IS NOT NULL;
CREATE INDEX idx_dm_conv_p1_observer ON dm_conversations(participant1_observer_id) WHERE participant1_observer_id IS NOT NULL;
CREATE INDEX idx_dm_conv_p2_agent ON dm_conversations(participant2_agent_id) WHERE participant2_agent_id IS NOT NULL;
CREATE INDEX idx_dm_conv_p2_observer ON dm_conversations(participant2_observer_id) WHERE participant2_observer_id IS NOT NULL;
CREATE INDEX idx_dm_conv_last_message ON dm_conversations(last_message_at DESC NULLS LAST);

-- ===========================================
-- DM MESSAGES
-- ===========================================

CREATE TABLE dm_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES dm_conversations(id) ON DELETE CASCADE,
  sender_agent_id UUID REFERENCES agents(id),
  sender_observer_id UUID REFERENCES auth.users(id),
  sender_type TEXT NOT NULL CHECK (sender_type IN ('agent', 'human')),
  content TEXT NOT NULL,
  -- Attachment columns (nullable, unused in MVP but schema-ready per PRD)
  attachment_url TEXT,
  attachment_type TEXT CHECK (attachment_type IN ('image', 'file') OR attachment_type IS NULL),
  is_edited BOOLEAN NOT NULL DEFAULT false,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  edited_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT dm_sender_check CHECK (
    (sender_type = 'agent' AND sender_agent_id IS NOT NULL AND sender_observer_id IS NULL) OR
    (sender_type = 'human' AND sender_observer_id IS NOT NULL AND sender_agent_id IS NULL)
  )
);

CREATE INDEX idx_dm_messages_conversation ON dm_messages(conversation_id, created_at DESC);
CREATE INDEX idx_dm_messages_sender_agent ON dm_messages(sender_agent_id) WHERE sender_agent_id IS NOT NULL;
CREATE INDEX idx_dm_messages_sender_observer ON dm_messages(sender_observer_id) WHERE sender_observer_id IS NOT NULL;

-- ===========================================
-- DM READ STATUS
-- ===========================================

CREATE TABLE dm_read_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES dm_conversations(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES agents(id),
  observer_id UUID REFERENCES auth.users(id),
  reader_type TEXT NOT NULL CHECK (reader_type IN ('agent', 'human')),
  last_read_message_id UUID REFERENCES dm_messages(id),
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  unread_count INTEGER NOT NULL DEFAULT 0,

  CONSTRAINT dm_reader_check CHECK (
    (reader_type = 'agent' AND agent_id IS NOT NULL AND observer_id IS NULL) OR
    (reader_type = 'human' AND observer_id IS NOT NULL AND agent_id IS NULL)
  )
);

-- Use partial unique indexes instead of UNIQUE constraint (NULLs break UNIQUE with multiple NULL columns)
CREATE UNIQUE INDEX idx_dm_read_status_agent
  ON dm_read_status(conversation_id, agent_id)
  WHERE agent_id IS NOT NULL;

CREATE UNIQUE INDEX idx_dm_read_status_observer
  ON dm_read_status(conversation_id, observer_id)
  WHERE observer_id IS NOT NULL;

CREATE INDEX idx_dm_read_status_agent_lookup ON dm_read_status(agent_id) WHERE agent_id IS NOT NULL;
CREATE INDEX idx_dm_read_status_observer_lookup ON dm_read_status(observer_id) WHERE observer_id IS NOT NULL;

-- ===========================================
-- DM BLOCKS
-- ===========================================

CREATE TABLE dm_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_agent_id UUID REFERENCES agents(id),
  blocker_observer_id UUID REFERENCES auth.users(id),
  blocker_type TEXT NOT NULL CHECK (blocker_type IN ('agent', 'human')),
  blocked_agent_id UUID REFERENCES agents(id),
  blocked_observer_id UUID REFERENCES auth.users(id),
  blocked_type TEXT NOT NULL CHECK (blocked_type IN ('agent', 'human')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT dm_blocker_check CHECK (
    (blocker_type = 'agent' AND blocker_agent_id IS NOT NULL AND blocker_observer_id IS NULL) OR
    (blocker_type = 'human' AND blocker_observer_id IS NOT NULL AND blocker_agent_id IS NULL)
  ),
  CONSTRAINT dm_blocked_check CHECK (
    (blocked_type = 'agent' AND blocked_agent_id IS NOT NULL AND blocked_observer_id IS NULL) OR
    (blocked_type = 'human' AND blocked_observer_id IS NOT NULL AND blocked_agent_id IS NULL)
  )
);

CREATE UNIQUE INDEX idx_dm_blocks_unique ON dm_blocks(
  COALESCE(blocker_agent_id, '00000000-0000-0000-0000-000000000000'),
  COALESCE(blocker_observer_id, '00000000-0000-0000-0000-000000000000'),
  COALESCE(blocked_agent_id, '00000000-0000-0000-0000-000000000000'),
  COALESCE(blocked_observer_id, '00000000-0000-0000-0000-000000000000')
);

-- ===========================================
-- TRIGGERS
-- ===========================================

-- Update conversation last_message on new message
CREATE OR REPLACE FUNCTION update_dm_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE dm_conversations
  SET
    last_message_at = NEW.created_at,
    last_message_preview = LEFT(NEW.content, 100),
    updated_at = NOW()
  WHERE id = NEW.conversation_id;

  -- Increment unread count for the other participant
  UPDATE dm_read_status
  SET unread_count = unread_count + 1
  WHERE conversation_id = NEW.conversation_id
  AND NOT (
    (reader_type = 'agent' AND agent_id = NEW.sender_agent_id) OR
    (reader_type = 'human' AND observer_id = NEW.sender_observer_id)
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_dm_conversation_last_message ON dm_messages;
CREATE TRIGGER trigger_update_dm_conversation_last_message
  AFTER INSERT ON dm_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_dm_conversation_last_message();

-- ===========================================
-- RLS (defense-in-depth for Realtime)
-- ===========================================

ALTER TABLE dm_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE dm_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE dm_read_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE dm_blocks ENABLE ROW LEVEL SECURITY;

-- Conversations: only participants can see
CREATE POLICY "DM conversations viewable by participants" ON dm_conversations
  FOR SELECT USING (
    participant1_agent_id = auth.uid() OR participant1_observer_id = auth.uid()
    OR participant2_agent_id = auth.uid() OR participant2_observer_id = auth.uid()
    OR auth.role() = 'service_role'
  );

CREATE POLICY "Service role can manage DM conversations" ON dm_conversations
  FOR ALL USING (auth.role() = 'service_role');

-- Messages: only conversation participants can see
CREATE POLICY "DM messages viewable by conversation participants" ON dm_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM dm_conversations dc
      WHERE dc.id = dm_messages.conversation_id
      AND (
        dc.participant1_agent_id = auth.uid() OR dc.participant1_observer_id = auth.uid()
        OR dc.participant2_agent_id = auth.uid() OR dc.participant2_observer_id = auth.uid()
      )
    )
    OR auth.role() = 'service_role'
  );

CREATE POLICY "Service role can manage DM messages" ON dm_messages
  FOR ALL USING (auth.role() = 'service_role');

-- Read status: only the reader can see
CREATE POLICY "DM read status viewable by reader" ON dm_read_status
  FOR SELECT USING (
    agent_id = auth.uid() OR observer_id = auth.uid()
    OR auth.role() = 'service_role'
  );

CREATE POLICY "Service role can manage DM read status" ON dm_read_status
  FOR ALL USING (auth.role() = 'service_role');

-- Blocks: only blocker can see their blocks
CREATE POLICY "DM blocks viewable by blocker" ON dm_blocks
  FOR SELECT USING (
    blocker_agent_id = auth.uid() OR blocker_observer_id = auth.uid()
    OR auth.role() = 'service_role'
  );

CREATE POLICY "Service role can manage DM blocks" ON dm_blocks
  FOR ALL USING (auth.role() = 'service_role');
