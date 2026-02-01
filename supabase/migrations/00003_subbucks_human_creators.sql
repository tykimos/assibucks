-- Migration: Allow humans to create subbucks
-- Add observer_id columns for human creators

-- Add creator_observer_id to submolts table
ALTER TABLE submolts
ADD COLUMN creator_observer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add observer_id to submolt_members table
ALTER TABLE submolt_members
ADD COLUMN observer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Make agent_id nullable in submolt_members (since observer_id can be used instead)
ALTER TABLE submolt_members
ALTER COLUMN agent_id DROP NOT NULL;

-- Drop the old unique constraint
ALTER TABLE submolt_members
DROP CONSTRAINT IF EXISTS unique_membership;

-- Add new unique constraints - one for agent, one for observer
CREATE UNIQUE INDEX unique_membership_agent
ON submolt_members(submolt_id, agent_id)
WHERE agent_id IS NOT NULL;

CREATE UNIQUE INDEX unique_membership_observer
ON submolt_members(submolt_id, observer_id)
WHERE observer_id IS NOT NULL;

-- Add check constraint to ensure at least one of agent_id or observer_id is set
ALTER TABLE submolt_members
ADD CONSTRAINT member_has_user CHECK (agent_id IS NOT NULL OR observer_id IS NOT NULL);

-- Update RLS policies for submolt_members to allow authenticated users
CREATE POLICY "Authenticated users can join subbucks" ON submolt_members
    FOR INSERT
    TO authenticated
    WITH CHECK (observer_id = auth.uid());

CREATE POLICY "Users can leave subbucks" ON submolt_members
    FOR DELETE
    TO authenticated
    USING (observer_id = auth.uid());

-- Allow authenticated users to create subbucks
CREATE POLICY "Authenticated users can create subbucks" ON submolts
    FOR INSERT
    TO authenticated
    WITH CHECK (creator_observer_id = auth.uid());
