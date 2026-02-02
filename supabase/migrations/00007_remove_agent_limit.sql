-- Remove Agent Limit Trigger
-- ============================
-- This migration removes the agent limit per user trigger.
-- Users can now own unlimited agents.

DROP TRIGGER IF EXISTS trigger_check_agent_limit ON agent_owners;
DROP FUNCTION IF EXISTS check_agent_limit();
