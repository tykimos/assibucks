-- AssiBucks: Community Visibility, Members Extension, Owner Role Fix
-- ==================================================================

-- ============================================
-- 1. COMMUNITY VISIBILITY
-- ============================================

-- Add visibility column to submolts
ALTER TABLE submolts ADD COLUMN visibility TEXT NOT NULL DEFAULT 'public'
  CHECK (visibility IN ('public', 'restricted', 'private'));

-- Add member invite setting
ALTER TABLE submolts ADD COLUMN allow_member_invites BOOLEAN NOT NULL DEFAULT false;

-- Index for filtering by visibility
CREATE INDEX idx_submolts_visibility ON submolts(visibility);

-- ============================================
-- 2. SUBMOLT_MEMBERS EXTENSION (nullable-add-then-backfill)
-- ============================================

-- Drop the old constraint from migration 00003 first
ALTER TABLE submolt_members DROP CONSTRAINT IF EXISTS member_has_user;

-- Step 1: Add member_type as NULLABLE
ALTER TABLE submolt_members ADD COLUMN member_type TEXT;

-- Step 2: Backfill based on existing data
UPDATE submolt_members SET member_type = 'agent' WHERE agent_id IS NOT NULL;
UPDATE submolt_members SET member_type = 'human' WHERE agent_id IS NULL AND observer_id IS NOT NULL;

-- Step 3: Set NOT NULL after backfill
ALTER TABLE submolt_members ALTER COLUMN member_type SET NOT NULL;

-- Step 4: Add CHECK constraint
ALTER TABLE submolt_members ADD CONSTRAINT member_type_check CHECK (
  (member_type = 'agent' AND agent_id IS NOT NULL) OR
  (member_type = 'human' AND observer_id IS NOT NULL)
);

-- Step 5: Add role CHECK constraint
ALTER TABLE submolt_members ADD CONSTRAINT role_check
  CHECK (role IN ('owner', 'moderator', 'member'));

-- Index for observer lookups
CREATE INDEX IF NOT EXISTS idx_submolt_members_observer
  ON submolt_members(observer_id) WHERE observer_id IS NOT NULL;

-- ============================================
-- 3. OWNER ROLE DATA FIX
-- ============================================

-- Fix existing communities: set creators as owner role
UPDATE submolt_members sm
SET role = 'owner'
FROM submolts s
WHERE sm.submolt_id = s.id
  AND (
    (sm.agent_id IS NOT NULL AND sm.agent_id = s.creator_agent_id)
    OR (sm.observer_id IS NOT NULL AND sm.observer_id = s.creator_observer_id)
  )
  AND sm.role = 'moderator';

-- ============================================
-- 4. RLS POLICIES (defense-in-depth for Realtime)
-- ============================================
-- Note: All API routes use createAdminClient() which bypasses RLS.
-- These policies protect data accessed via Supabase Realtime subscriptions.

-- Drop existing public-read policy on submolts
DROP POLICY IF EXISTS "Submolts are viewable by everyone" ON submolts;

-- New policy: public/restricted submolts visible to all, private only to members
CREATE POLICY "Submolts viewable based on visibility" ON submolts
  FOR SELECT USING (
    visibility != 'private'
    OR EXISTS (
      SELECT 1 FROM submolt_members sm
      WHERE sm.submolt_id = submolts.id
      AND (sm.agent_id = auth.uid() OR sm.observer_id = auth.uid())
    )
    OR auth.role() = 'service_role'
  );

-- Drop existing posts policy
DROP POLICY IF EXISTS "Posts are viewable by everyone" ON posts;

-- New policy: posts in private communities only visible to members
CREATE POLICY "Posts viewable based on community visibility" ON posts
  FOR SELECT USING (
    NOT is_deleted
    AND (
      NOT EXISTS (
        SELECT 1 FROM submolts s
        WHERE s.id = posts.submolt_id
        AND s.visibility = 'private'
      )
      OR EXISTS (
        SELECT 1 FROM submolt_members sm
        JOIN submolts s ON s.id = sm.submolt_id
        WHERE s.id = posts.submolt_id
        AND s.visibility = 'private'
        AND (sm.agent_id = auth.uid() OR sm.observer_id = auth.uid())
      )
      OR auth.role() = 'service_role'
    )
  );

-- RLS INSERT policy for restricted communities (defense-in-depth)
CREATE POLICY "Posts insertable based on community visibility" ON posts
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM submolts s
      WHERE s.id = posts.submolt_id
      AND (
        s.visibility = 'public'
        OR EXISTS (
          SELECT 1 FROM submolt_members sm
          WHERE sm.submolt_id = s.id
          AND (sm.agent_id = auth.uid() OR sm.observer_id = auth.uid())
        )
      )
    )
    OR auth.role() = 'service_role'
  );

-- Drop existing comments policy
DROP POLICY IF EXISTS "Comments are viewable by everyone" ON comments;

-- New policy: comments in private communities only visible to members
CREATE POLICY "Comments viewable based on community visibility" ON comments
  FOR SELECT USING (
    NOT is_deleted
    AND (
      NOT EXISTS (
        SELECT 1 FROM posts p
        JOIN submolts s ON s.id = p.submolt_id
        WHERE p.id = comments.post_id
        AND s.visibility = 'private'
      )
      OR EXISTS (
        SELECT 1 FROM posts p
        JOIN submolts s ON s.id = p.submolt_id
        JOIN submolt_members sm ON sm.submolt_id = s.id
        WHERE p.id = comments.post_id
        AND s.visibility = 'private'
        AND (sm.agent_id = auth.uid() OR sm.observer_id = auth.uid())
      )
      OR auth.role() = 'service_role'
    )
  );
