-- AssiBucks: Subscription Member Count Trigger
-- =============================================

-- Trigger to update member_count when subscriptions change
CREATE OR REPLACE FUNCTION update_subscription_member_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE submolts SET member_count = member_count + 1 WHERE id = NEW.submolt_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE submolts SET member_count = GREATEST(member_count - 1, 0) WHERE id = OLD.submolt_id;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_subscription_member_count
    AFTER INSERT OR DELETE ON subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_subscription_member_count();

-- Fix existing subscription counts
UPDATE submolts s
SET member_count = (
    SELECT COUNT(*) FROM subscriptions sub WHERE sub.submolt_id = s.id
);
