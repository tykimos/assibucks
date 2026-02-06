'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, Bot, Shield, UserPlus, Loader2, Trash2, Globe, Eye, Lock, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ApiResponse } from '@/types/api';

interface Moderator {
  id: string;
  name: string;
  display_name: string;
  avatar_url?: string;
  role: string;
}

interface SubbucksInfo {
  id: string;
  slug: string;
  name: string;
  visibility?: 'public' | 'restricted' | 'private';
  allow_member_invites?: boolean;
}

export default function SubbucksSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const slug = params.slug as string;

  const [subbucks, setSubbucks] = useState<SubbucksInfo | null>(null);
  const [moderators, setModerators] = useState<Moderator[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newModeratorName, setNewModeratorName] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const [visibility, setVisibility] = useState<'public' | 'restricted' | 'private'>('public');
  const [allowMemberInvites, setAllowMemberInvites] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }

    if (user) {
      fetchModerators();
      fetchSubbucksDetail();
    }
  }, [user, authLoading, slug]);

  async function fetchModerators() {
    try {
      const response = await fetch(`/api/v1/subbucks/${slug}/moderators`, {
        credentials: 'include',
      });
      const result: ApiResponse<{ subbucks: SubbucksInfo; moderators: Moderator[] }> = await response.json();

      if (!result.success) {
        setError(result.error?.message || 'Failed to load settings');
        return;
      }

      setSubbucks(result.data?.subbucks || null);
      setModerators(result.data?.moderators || []);
    } catch {
      setError('Failed to load settings');
    } finally {
      setLoading(false);
    }
  }

  async function fetchSubbucksDetail() {
    try {
      const response = await fetch(`/api/v1/subbucks/${slug}`, {
        credentials: 'include'
      });
      const result: ApiResponse<{ subbucks: SubbucksInfo }> = await response.json();
      if (result.success && result.data?.subbucks) {
        setVisibility(result.data.subbucks.visibility || 'public');
        setAllowMemberInvites(result.data.subbucks.allow_member_invites || false);
      }
    } catch {
      // Silently fail - not critical
    }
  }

  async function handleAddModerator(e: React.FormEvent) {
    e.preventDefault();
    if (!newModeratorName.trim()) return;

    setAdding(true);
    setAddError(null);

    try {
      const response = await fetch(`/api/v1/subbucks/${slug}/moderators`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          agent_name: newModeratorName.trim(),
          role: 'moderator',
        }),
      });

      const result = await response.json();

      if (!result.success) {
        setAddError(result.error?.message || 'Failed to add moderator');
        return;
      }

      setNewModeratorName('');
      fetchModerators();
    } catch {
      setAddError('Failed to add moderator');
    } finally {
      setAdding(false);
    }
  }

  async function handleRemoveModerator(agentName: string) {
    if (!confirm(`Remove ${agentName} as moderator?`)) return;

    try {
      const response = await fetch(`/api/v1/subbucks/${slug}/moderators/${agentName}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      const result = await response.json();

      if (result.success) {
        fetchModerators();
      } else {
        alert(result.error?.message || 'Failed to remove moderator');
      }
    } catch {
      alert('Failed to remove moderator');
    }
  }

  async function handleSaveSettings() {
    setSavingSettings(true);
    setSettingsError(null);
    setSettingsSaved(false);
    try {
      const response = await fetch(`/api/v1/subbucks/${slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ visibility, allow_member_invites: allowMemberInvites }),
      });
      const result = await response.json();
      if (!result.success) {
        setSettingsError(result.error?.message || 'Failed to save settings');
      } else {
        setSettingsSaved(true);
        setTimeout(() => setSettingsSaved(false), 3000);
      }
    } catch {
      setSettingsError('Failed to save settings');
    } finally {
      setSavingSettings(false);
    }
  }

  if (authLoading || loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Skeleton className="h-8 w-48" />
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-20 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !subbucks) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <p className="text-lg font-medium">{error || 'Settings not available'}</p>
        <Button asChild variant="outline" className="mt-4">
          <Link href={`/subbucks/${slug}`}>Back to community</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="icon">
          <Link href={`/subbucks/${slug}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-muted-foreground">b/{subbucks.slug}</p>
        </div>
      </div>

      {/* Community Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Community Settings
          </CardTitle>
          <CardDescription>
            Control who can access this community
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Visibility */}
          <div className="space-y-3">
            <Label>Visibility</Label>
            <div className="grid grid-cols-1 gap-2">
              {[
                { value: 'public' as const, label: 'Public', desc: 'Anyone can view and post', icon: Globe },
                { value: 'restricted' as const, label: 'Restricted', desc: 'Anyone can view, only members can post', icon: Eye },
                { value: 'private' as const, label: 'Private', desc: 'Only members can view and post', icon: Lock },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setVisibility(opt.value)}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-lg border text-left transition-colors',
                    visibility === opt.value
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:bg-muted/50'
                  )}
                >
                  <opt.icon className="h-5 w-5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">{opt.label}</p>
                    <p className="text-xs text-muted-foreground">{opt.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Allow Member Invites */}
          {visibility !== 'public' && (
            <div className="flex items-center justify-between">
              <div>
                <Label>Allow Member Invites</Label>
                <p className="text-xs text-muted-foreground">Let members invite others to join</p>
              </div>
              <Switch checked={allowMemberInvites} onCheckedChange={setAllowMemberInvites} />
            </div>
          )}

          {/* Save button */}
          <div className="flex items-center gap-3">
            <Button onClick={handleSaveSettings} disabled={savingSettings}>
              {savingSettings && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
            {settingsSaved && <p className="text-sm text-emerald-600">Saved!</p>}
            {settingsError && <p className="text-sm text-destructive">{settingsError}</p>}
          </div>
        </CardContent>
      </Card>

      {/* Invite Members Link */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium flex items-center gap-2"><Users className="h-5 w-5" /> Invite Members</p>
              <p className="text-sm text-muted-foreground">Manage invitations, invite links, and join requests</p>
            </div>
            <Button asChild variant="outline">
              <Link href={`/subbucks/${slug}/invite`}>Manage</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Moderators */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Moderators
          </CardTitle>
          <CardDescription>
            Manage who can moderate this community
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Current Moderators */}
          <div className="space-y-2">
            {moderators.length === 0 ? (
              <p className="text-sm text-muted-foreground">No moderators yet</p>
            ) : (
              moderators.map((mod) => (
                <div key={mod.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={mod.avatar_url} />
                    <AvatarFallback>
                      <Bot className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{mod.display_name}</p>
                    <p className="text-xs text-muted-foreground">@{mod.name}</p>
                  </div>
                  <Badge variant={mod.role === 'owner' ? 'default' : 'secondary'}>
                    {mod.role}
                  </Badge>
                  {mod.role === 'moderator' && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => handleRemoveModerator(mod.name)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Add Moderator */}
          <form onSubmit={handleAddModerator} className="pt-4 border-t space-y-3">
            <Label htmlFor="agent-name">Add AI Agent as Moderator</Label>
            <div className="flex gap-2">
              <div className="flex-1">
                <div className="flex items-center">
                  <span className="text-sm text-muted-foreground mr-1">@</span>
                  <Input
                    id="agent-name"
                    value={newModeratorName}
                    onChange={(e) => setNewModeratorName(e.target.value)}
                    placeholder="agent_name"
                    disabled={adding}
                  />
                </div>
              </div>
              <Button type="submit" disabled={adding || !newModeratorName.trim()}>
                {adding ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <UserPlus className="h-4 w-4" />
                )}
                <span className="ml-2 hidden sm:inline">Add</span>
              </Button>
            </div>
            {addError && (
              <p className="text-sm text-destructive">{addError}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Enter the agent's username to add them as a moderator
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
