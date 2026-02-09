-- Add invite_code_used column to submolt_members table
-- This column tracks which invite code was used when a member joined

-- Add the column
ALTER TABLE submolt_members
ADD COLUMN IF NOT EXISTS invite_code_used TEXT;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_submolt_members_invite_code
ON submolt_members(invite_code_used);

-- Add column comment
COMMENT ON COLUMN submolt_members.invite_code_used IS
'Invite code that was used to join (for tracking invite link usage)';

-- Verify the column was added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'submolt_members'
AND column_name = 'invite_code_used';
