'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useAuth } from '@/hooks/use-auth';
import { Loader2, Plus, Globe, Lock, Eye } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

export function CreateSubbucksButton() {
  const { user } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [slug, setSlug] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'restricted' | 'private'>('public');
  const [allowMemberInvites, setAllowMemberInvites] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !slug.trim() || !name.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/v1/subbucks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          slug: slug.trim().toLowerCase().replace(/[^a-z0-9]/g, ''),
          name: name.trim(),
          description: description.trim() || undefined,
          visibility,
          allow_member_invites: allowMemberInvites,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        setError(result.error?.message || 'Failed to create community');
        return;
      }

      setOpen(false);
      setSlug('');
      setName('');
      setDescription('');
      setVisibility('public');
      setAllowMemberInvites(false);
      router.push(`/subbucks/${result.data.subbucks.slug}`);
      router.refresh();
    } catch (err) {
      setError('Failed to create community');
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus className="h-4 w-4 mr-2" />
          Create Community
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a Community</DialogTitle>
          <DialogDescription>
            Create a new community for discussions around a specific topic.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="slug">URL Slug</Label>
            <div className="flex items-center mt-1">
              <span className="text-sm text-muted-foreground mr-1">b/</span>
              <Input
                id="slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))}
                placeholder="mycommunitiy"
                maxLength={30}
                required
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Only lowercase letters and numbers. Cannot be changed later.
            </p>
          </div>

          <div>
            <Label htmlFor="name">Display Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Community"
              maxLength={100}
              className="mt-1"
              required
            />
          </div>

          <div>
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this community about?"
              maxLength={500}
              className="mt-1"
            />
          </div>

          <div>
            <Label>Visibility</Label>
            <div className="grid grid-cols-1 gap-2 mt-2">
              <div
                onClick={() => setVisibility('public')}
                className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                  visibility === 'public' ? 'border-primary bg-primary/5' : 'hover:bg-accent'
                }`}
              >
                <div className="mt-0.5">
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    visibility === 'public' ? 'border-primary' : 'border-muted-foreground'
                  }`}>
                    {visibility === 'public' && (
                      <div className="w-2 h-2 rounded-full bg-primary" />
                    )}
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    <span className="font-medium">Public</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Anyone can view and post
                  </p>
                </div>
              </div>

              <div
                onClick={() => setVisibility('restricted')}
                className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                  visibility === 'restricted' ? 'border-primary bg-primary/5' : 'hover:bg-accent'
                }`}
              >
                <div className="mt-0.5">
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    visibility === 'restricted' ? 'border-primary' : 'border-muted-foreground'
                  }`}>
                    {visibility === 'restricted' && (
                      <div className="w-2 h-2 rounded-full bg-primary" />
                    )}
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Eye className="h-4 w-4" />
                    <span className="font-medium">Restricted</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Anyone can view, only members can post
                  </p>
                </div>
              </div>

              <div
                onClick={() => setVisibility('private')}
                className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                  visibility === 'private' ? 'border-primary bg-primary/5' : 'hover:bg-accent'
                }`}
              >
                <div className="mt-0.5">
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    visibility === 'private' ? 'border-primary' : 'border-muted-foreground'
                  }`}>
                    {visibility === 'private' && (
                      <div className="w-2 h-2 rounded-full bg-primary" />
                    )}
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Lock className="h-4 w-4" />
                    <span className="font-medium">Private</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Only members can view and post
                  </p>
                </div>
              </div>
            </div>
          </div>

          {(visibility === 'restricted' || visibility === 'private') && (
            <div className="flex items-center justify-between space-x-2">
              <div className="space-y-0.5">
                <Label htmlFor="allow-invites">Allow members to invite others</Label>
                <p className="text-xs text-muted-foreground">
                  Members can invite new users to join this community
                </p>
              </div>
              <Switch
                id="allow-invites"
                checked={allowMemberInvites}
                onCheckedChange={setAllowMemberInvites}
              />
            </div>
          )}

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !slug.trim() || !name.trim()}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
