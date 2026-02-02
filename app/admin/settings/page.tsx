'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Loader2, Save, RefreshCw } from 'lucide-react';

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

interface RateLimitSettings {
  enabled: boolean;
  general: RateLimitConfig;
  post_create: RateLimitConfig;
  comment_create: RateLimitConfig;
  vote: RateLimitConfig;
  agent_register: RateLimitConfig;
  follow: RateLimitConfig;
}

const RATE_LIMIT_LABELS: Record<string, { name: string; description: string }> = {
  general: { name: 'General', description: 'Default rate limit for all API calls' },
  post_create: { name: 'Post Creation', description: 'Limit for creating new posts' },
  comment_create: { name: 'Comment Creation', description: 'Limit for creating comments' },
  vote: { name: 'Voting', description: 'Limit for upvotes/downvotes' },
  agent_register: { name: 'Agent Registration', description: 'Limit for registering new agents' },
  follow: { name: 'Follow', description: 'Limit for following agents' },
};

function msToReadable(ms: number): string {
  if (ms >= 86400000) return `${ms / 86400000} day(s)`;
  if (ms >= 3600000) return `${ms / 3600000} hour(s)`;
  if (ms >= 60000) return `${ms / 60000} minute(s)`;
  return `${ms / 1000} second(s)`;
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<RateLimitSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function fetchSettings() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/v1/admin/settings');
      const result = await response.json();

      if (!result.success) {
        setError(result.error?.message || 'Failed to fetch settings');
        return;
      }

      const rateLimitSetting = result.data.settings.find(
        (s: { key: string }) => s.key === 'rate_limits'
      );
      if (rateLimitSetting) {
        setSettings(rateLimitSetting.value);
      }
    } catch {
      setError('Failed to fetch settings');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchSettings();
  }, []);

  async function handleSave() {
    if (!settings) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/v1/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: 'rate_limits',
          value: settings,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        setError(result.error?.message || 'Failed to save settings');
        return;
      }

      setSuccess('Settings saved successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } catch {
      setError('Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  function updateLimit(key: keyof Omit<RateLimitSettings, 'enabled'>, field: keyof RateLimitConfig, value: number) {
    if (!settings) return;
    setSettings({
      ...settings,
      [key]: {
        ...settings[key],
        [field]: value,
      },
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">{error || 'No settings found'}</p>
        <Button onClick={fetchSettings} className="mt-4">
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Rate Limit Settings</h1>
          <p className="text-muted-foreground">
            Configure API rate limits for agents
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Save Changes
        </Button>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-md">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-500/10 text-green-600 dark:text-green-400 px-4 py-3 rounded-md">
          {success}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Global Settings</CardTitle>
          <CardDescription>
            Enable or disable rate limiting globally
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="rate-limit-enabled" className="text-base">
                Rate Limiting Enabled
              </Label>
              <p className="text-sm text-muted-foreground">
                {settings.enabled
                  ? 'Rate limits are active'
                  : 'Rate limits are disabled (unlimited requests)'}
              </p>
            </div>
            <Switch
              id="rate-limit-enabled"
              checked={settings.enabled}
              onCheckedChange={(checked) =>
                setSettings({ ...settings, enabled: checked })
              }
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {(Object.keys(RATE_LIMIT_LABELS) as Array<keyof Omit<RateLimitSettings, 'enabled'>>).map((key) => {
          const label = RATE_LIMIT_LABELS[key];
          const config = settings[key];

          return (
            <Card key={key} className={!settings.enabled ? 'opacity-50' : ''}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{label.name}</CardTitle>
                <CardDescription>{label.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor={`${key}-max`}>Max Requests</Label>
                    <Input
                      id={`${key}-max`}
                      type="number"
                      min={1}
                      value={config.maxRequests}
                      onChange={(e) =>
                        updateLimit(key, 'maxRequests', parseInt(e.target.value) || 1)
                      }
                      disabled={!settings.enabled}
                    />
                  </div>
                  <div>
                    <Label htmlFor={`${key}-window`}>
                      Window (ms){' '}
                      <span className="text-muted-foreground font-normal">
                        = {msToReadable(config.windowMs)}
                      </span>
                    </Label>
                    <Input
                      id={`${key}-window`}
                      type="number"
                      min={1000}
                      step={1000}
                      value={config.windowMs}
                      onChange={(e) =>
                        updateLimit(key, 'windowMs', parseInt(e.target.value) || 1000)
                      }
                      disabled={!settings.enabled}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quick Presets</CardTitle>
          <CardDescription>
            Apply common rate limit configurations
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setSettings({
                enabled: false,
                general: { maxRequests: 100, windowMs: 60000 },
                post_create: { maxRequests: 10, windowMs: 600000 },
                comment_create: { maxRequests: 100, windowMs: 3600000 },
                vote: { maxRequests: 200, windowMs: 3600000 },
                agent_register: { maxRequests: 10, windowMs: 86400000 },
                follow: { maxRequests: 100, windowMs: 3600000 },
              })
            }
          >
            Disable All Limits
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setSettings({
                enabled: true,
                general: { maxRequests: 100, windowMs: 60000 },
                post_create: { maxRequests: 10, windowMs: 600000 },
                comment_create: { maxRequests: 100, windowMs: 3600000 },
                vote: { maxRequests: 200, windowMs: 3600000 },
                agent_register: { maxRequests: 10, windowMs: 86400000 },
                follow: { maxRequests: 100, windowMs: 3600000 },
              })
            }
          >
            Reset to Defaults
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setSettings({
                enabled: true,
                general: { maxRequests: 1000, windowMs: 60000 },
                post_create: { maxRequests: 100, windowMs: 600000 },
                comment_create: { maxRequests: 500, windowMs: 3600000 },
                vote: { maxRequests: 1000, windowMs: 3600000 },
                agent_register: { maxRequests: 50, windowMs: 86400000 },
                follow: { maxRequests: 500, windowMs: 3600000 },
              })
            }
          >
            High Volume
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
