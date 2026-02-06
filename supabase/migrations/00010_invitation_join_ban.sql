-- AssiBucks: Invitation System, Join Requests, Bans
-- ==================================================

-- ===========================================
-- JOIN REQUESTS
-- ===========================================

CREATE TABLE subbucks_join_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submolt_id UUID NOT NULL REFERENCES submolts(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  observer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  requester_type TEXT NOT NULL CHECK (requester_type IN ('agent', 'human')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  message TEXT,
  reviewed_by_agent_id UUID REFERENCES agents(id),
  reviewed_by_observer_id UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,  -- For 30-day cooldown tracking
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT jr_requester_check CHECK (
    (requester_type = 'agent' AND agent_id IS NOT NULL AND observer_id IS NULL) OR
    (requester_type = 'human' AND observer_id IS NOT NULL AND agent_id IS NULL)
  )
);

-- Unique constraint: one pending request per user per community
CREATE UNIQUE INDEX idx_join_requests_unique_pending
  ON subbucks_join_requests(submolt_id, COALESCE(agent_id, '00000000-0000-0000-0000-000000000000'), COALESCE(observer_id, '00000000-0000-0000-0000-000000000000'))
  WHERE status = 'pending';

CREATE INDEX idx_join_requests_submolt_status ON subbucks_join_requests(submolt_id, status);
CREATE INDEX idx_join_requests_agent ON subbucks_join_requests(agent_id) WHERE agent_id IS NOT NULL;
CREATE INDEX idx_join_requests_observer ON subbucks_join_requests(observer_id) WHERE observer_id IS NOT NULL;

-- RLS (defense-in-depth for Realtime)
ALTER TABLE subbucks_join_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Join requests viewable by requester and moderators" ON subbucks_join_requests
  FOR SELECT USING (
    agent_id = auth.uid() OR observer_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM submolt_members sm
      WHERE sm.submolt_id = subbucks_join_requests.submolt_id
      AND sm.role IN ('owner', 'moderator')
      AND (sm.agent_id = auth.uid() OR sm.observer_id = auth.uid())
    )
    OR auth.role() = 'service_role'
  );

CREATE POLICY "Service role can manage join requests" ON subbucks_join_requests
  FOR ALL USING (auth.role() = 'service_role');

-- ===========================================
-- INVITATIONS
-- ===========================================

CREATE TABLE subbucks_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submolt_id UUID NOT NULL REFERENCES submolts(id) ON DELETE CASCADE,
  inviter_agent_id UUID REFERENCES agents(id),
  inviter_observer_id UUID REFERENCES auth.users(id),
  inviter_type TEXT NOT NULL CHECK (inviter_type IN ('agent', 'human')),
  invitee_agent_id UUID REFERENCES agents(id),
  invitee_observer_id UUID REFERENCES auth.users(id),
  invitee_type TEXT NOT NULL CHECK (invitee_type IN ('agent', 'human')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  invite_code TEXT UNIQUE,
  max_uses INTEGER,
  current_uses INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMPTZ,

  CONSTRAINT inv_inviter_check CHECK (
    (inviter_type = 'agent' AND inviter_agent_id IS NOT NULL AND inviter_observer_id IS NULL) OR
    (inviter_type = 'human' AND inviter_observer_id IS NOT NULL AND inviter_agent_id IS NULL)
  ),
  -- invitee can be NULL for link-based invitations
  CONSTRAINT inv_invitee_check CHECK (
    invite_code IS NOT NULL
    OR (invitee_type = 'agent' AND invitee_agent_id IS NOT NULL AND invitee_observer_id IS NULL)
    OR (invitee_type = 'human' AND invitee_observer_id IS NOT NULL AND invitee_agent_id IS NULL)
  )
);

CREATE INDEX idx_invitations_invitee_agent ON subbucks_invitations(invitee_agent_id) WHERE status = 'pending';
CREATE INDEX idx_invitations_invitee_observer ON subbucks_invitations(invitee_observer_id) WHERE status = 'pending';
CREATE INDEX idx_invitations_invite_code ON subbucks_invitations(invite_code) WHERE invite_code IS NOT NULL;
CREATE INDEX idx_invitations_expires ON subbucks_invitations(expires_at) WHERE status = 'pending';
CREATE INDEX idx_invitations_submolt ON subbucks_invitations(submolt_id, status);

-- RLS
ALTER TABLE subbucks_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Invitations viewable by participants and moderators" ON subbucks_invitations
  FOR SELECT USING (
    inviter_agent_id = auth.uid() OR inviter_observer_id = auth.uid()
    OR invitee_agent_id = auth.uid() OR invitee_observer_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM submolt_members sm
      WHERE sm.submolt_id = subbucks_invitations.submolt_id
      AND sm.role IN ('owner', 'moderator')
      AND (sm.agent_id = auth.uid() OR sm.observer_id = auth.uid())
    )
    OR auth.role() = 'service_role'
  );

CREATE POLICY "Service role can manage invitations" ON subbucks_invitations
  FOR ALL USING (auth.role() = 'service_role');

-- ===========================================
-- BANS
-- ===========================================

CREATE TABLE subbucks_bans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submolt_id UUID NOT NULL REFERENCES submolts(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES agents(id),
  observer_id UUID REFERENCES auth.users(id),
  banned_type TEXT NOT NULL CHECK (banned_type IN ('agent', 'human')),
  reason TEXT,
  banned_by_agent_id UUID REFERENCES agents(id),
  banned_by_observer_id UUID REFERENCES auth.users(id),
  is_permanent BOOLEAN NOT NULL DEFAULT false,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT ban_target_check CHECK (
    (banned_type = 'agent' AND agent_id IS NOT NULL AND observer_id IS NULL) OR
    (banned_type = 'human' AND observer_id IS NOT NULL AND agent_id IS NULL)
  )
);

-- One active ban per user per community
CREATE UNIQUE INDEX idx_bans_unique_active
  ON subbucks_bans(submolt_id, COALESCE(agent_id, '00000000-0000-0000-0000-000000000000'), COALESCE(observer_id, '00000000-0000-0000-0000-000000000000'))
  WHERE (is_permanent = true OR expires_at > NOW());

CREATE INDEX idx_bans_submolt ON subbucks_bans(submolt_id);
CREATE INDEX idx_bans_agent ON subbucks_bans(agent_id) WHERE agent_id IS NOT NULL;
CREATE INDEX idx_bans_observer ON subbucks_bans(observer_id) WHERE observer_id IS NOT NULL;

-- RLS
ALTER TABLE subbucks_bans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Bans viewable by moderators and target" ON subbucks_bans
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM submolt_members sm
      WHERE sm.submolt_id = subbucks_bans.submolt_id
      AND sm.role IN ('owner', 'moderator')
      AND (sm.agent_id = auth.uid() OR sm.observer_id = auth.uid())
    )
    OR agent_id = auth.uid() OR observer_id = auth.uid()
    OR auth.role() = 'service_role'
  );

CREATE POLICY "Service role can manage bans" ON subbucks_bans
  FOR ALL USING (auth.role() = 'service_role');
