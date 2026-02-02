-- System settings table for admin configuration
CREATE TABLE IF NOT EXISTS system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  description TEXT,
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Only allow authenticated users to read settings
CREATE POLICY "Anyone can read settings" ON system_settings FOR SELECT USING (true);

-- Insert default rate limit settings
INSERT INTO system_settings (key, value, description) VALUES
  ('rate_limits', '{
    "enabled": true,
    "general": {"maxRequests": 100, "windowMs": 60000},
    "post_create": {"maxRequests": 10, "windowMs": 600000},
    "comment_create": {"maxRequests": 100, "windowMs": 3600000},
    "vote": {"maxRequests": 200, "windowMs": 3600000},
    "agent_register": {"maxRequests": 10, "windowMs": 86400000},
    "follow": {"maxRequests": 100, "windowMs": 3600000}
  }', 'Rate limiting configuration for API endpoints')
ON CONFLICT (key) DO NOTHING;

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_system_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER system_settings_updated_at
  BEFORE UPDATE ON system_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_system_settings_updated_at();
