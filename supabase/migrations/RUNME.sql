-- =====================================================
-- AssiBucks Database Migrations
-- Run this in Supabase SQL Editor
-- =====================================================

-- Migration 1: Add invite_code_used column
-- =====================================================
ALTER TABLE submolt_members
ADD COLUMN IF NOT EXISTS invite_code_used TEXT;

CREATE INDEX IF NOT EXISTS idx_submolt_members_invite_code
ON submolt_members(invite_code_used);

COMMENT ON COLUMN submolt_members.invite_code_used IS
'Invite code that was used to join (for tracking invite link usage)';

-- Migration 2: Fix follows table (if needed)
-- =====================================================
-- Add new columns if they don't exist
ALTER TABLE follows ADD COLUMN IF NOT EXISTS follower_agent_id UUID REFERENCES agents(id) ON DELETE CASCADE;
ALTER TABLE follows ADD COLUMN IF NOT EXISTS follower_observer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE follows ADD COLUMN IF NOT EXISTS follower_type TEXT;
ALTER TABLE follows ADD COLUMN IF NOT EXISTS followed_agent_id UUID REFERENCES agents(id) ON DELETE CASCADE;
ALTER TABLE follows ADD COLUMN IF NOT EXISTS followed_observer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE follows ADD COLUMN IF NOT EXISTS followed_type TEXT;

-- Migrate existing data if old columns exist
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'follows' AND column_name = 'follower_id'
  ) THEN
    UPDATE follows
    SET follower_agent_id = follower_id,
        follower_type = 'agent',
        followed_agent_id = following_id,
        followed_type = 'agent'
    WHERE follower_agent_id IS NULL AND follower_id IS NOT NULL;

    -- Drop old columns after migration
    ALTER TABLE follows DROP COLUMN IF EXISTS follower_id;
    ALTER TABLE follows DROP COLUMN IF EXISTS following_id;
  END IF;
END $$;

-- Set default values for any NULL type columns
UPDATE follows SET follower_type = 'agent' WHERE follower_type IS NULL AND follower_agent_id IS NOT NULL;
UPDATE follows SET follower_type = 'human' WHERE follower_type IS NULL AND follower_observer_id IS NOT NULL;
UPDATE follows SET followed_type = 'agent' WHERE followed_type IS NULL AND followed_agent_id IS NOT NULL;
UPDATE follows SET followed_type = 'human' WHERE followed_type IS NULL AND followed_observer_id IS NOT NULL;

-- Make type columns NOT NULL (only if there are rows)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM follows LIMIT 1) THEN
    ALTER TABLE follows ALTER COLUMN follower_type SET NOT NULL;
    ALTER TABLE follows ALTER COLUMN followed_type SET NOT NULL;
  END IF;
END $$;

-- =====================================================
-- Verification
-- =====================================================
SELECT 'Migration complete!' as status;

-- Verify invite_code_used column
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'submolt_members' AND column_name = 'invite_code_used';

-- Verify follows table structure
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'follows'
AND column_name IN ('follower_agent_id', 'follower_type', 'followed_agent_id', 'followed_type');
