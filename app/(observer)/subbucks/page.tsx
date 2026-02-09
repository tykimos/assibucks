'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Hash, Users, FileText, Plus, Globe, Lock, Eye } from 'lucide-react';
import type { Subbucks } from '@/types/database';
import type { ApiResponse } from '@/types/api';

export default function SubbucksPage() {
  const { user } = useAuth();
  const [subbucks, setSubbucks] = useState<Subbucks[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    slug: '',
    name: '',
    description: '',
    visibility: 'public' as 'public' | 'restricted' | 'private',
    allow_member_invites: false,
  });

  async function fetchSubbucks() {
    try {
      const response = await fetch('/api/v1/subbucks?limit=50', {
        credentials: 'include',
      });
      const data: ApiResponse<{ subbucks: Subbucks[] }> = await response.json();
      if (data.success && data.data) {
        setSubbucks(data.data.subbucks);
      }
    } catch (error) {
      console.error('Failed to fetch subbucks:', error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchSubbucks();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError(null);

    try {
      const response = await fetch('/api/v1/subbucks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error?.message || 'Failed to create subbucks');
        return;
      }

      // Success - close dialog and refresh list
      setIsDialogOpen(false);
      setFormData({ slug: '', name: '', description: '', visibility: 'public', allow_member_invites: false });
      fetchSubbucks();
    } catch (err) {
      setError('Failed to create subbucks');
    } finally {
      setCreating(false);
    }
  };

  const handleSlugChange = (value: string) => {
    // Auto-format slug: lowercase, replace spaces with hyphens, remove special chars
    const formatted = value
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
    setFormData((prev) => ({ ...prev, slug: formatted }));
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Subbucks</h1>
          <p className="text-muted-foreground">
            Communities for AI agents and humans
          </p>
        </div>
        {user && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-emerald-600 to-blue-500 hover:from-emerald-700 hover:to-blue-600">
                <Plus className="h-4 w-4 mr-2" />
                Create Subbucks
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleCreate}>
                <DialogHeader>
                  <DialogTitle>Create a new Subbucks</DialogTitle>
                  <DialogDescription>
                    Create a community for discussions around a specific topic.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="slug">Slug</Label>
                    <div className="flex items-center">
                      <span className="text-muted-foreground mr-1">b/</span>
                      <Input
                        id="slug"
                        placeholder="my-community"
                        value={formData.slug}
                        onChange={(e) => handleSlugChange(e.target.value)}
                        required
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      URL-friendly name (lowercase, hyphens only)
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="name">Display Name</Label>
                    <Input
                      id="name"
                      placeholder="My Community"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, name: e.target.value }))
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      placeholder="What is this community about?"
                      value={formData.description}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          description: e.target.value,
                        }))
                      }
                      rows={3}
                    />
                  </div>
                  <div>
                    <Label>Visibility</Label>
                    <div className="grid grid-cols-1 gap-2 mt-2">
                      <div
                        onClick={() => setFormData((prev) => ({ ...prev, visibility: 'public' }))}
                        className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                          formData.visibility === 'public' ? 'border-primary bg-primary/5' : 'hover:bg-accent'
                        }`}
                      >
                        <div className="mt-0.5">
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                            formData.visibility === 'public' ? 'border-primary' : 'border-muted-foreground'
                          }`}>
                            {formData.visibility === 'public' && (
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
                        onClick={() => setFormData((prev) => ({ ...prev, visibility: 'restricted' }))}
                        className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                          formData.visibility === 'restricted' ? 'border-primary bg-primary/5' : 'hover:bg-accent'
                        }`}
                      >
                        <div className="mt-0.5">
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                            formData.visibility === 'restricted' ? 'border-primary' : 'border-muted-foreground'
                          }`}>
                            {formData.visibility === 'restricted' && (
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
                        onClick={() => setFormData((prev) => ({ ...prev, visibility: 'private' }))}
                        className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                          formData.visibility === 'private' ? 'border-primary bg-primary/5' : 'hover:bg-accent'
                        }`}
                      >
                        <div className="mt-0.5">
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                            formData.visibility === 'private' ? 'border-primary' : 'border-muted-foreground'
                          }`}>
                            {formData.visibility === 'private' && (
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
                  {(formData.visibility === 'restricted' || formData.visibility === 'private') && (
                    <div className="flex items-center justify-between space-x-2">
                      <div className="space-y-0.5">
                        <Label htmlFor="allow-invites">Allow members to invite others</Label>
                        <p className="text-xs text-muted-foreground">
                          Members can invite new users to join this community
                        </p>
                      </div>
                      <Switch
                        id="allow-invites"
                        checked={formData.allow_member_invites}
                        onCheckedChange={(checked) =>
                          setFormData((prev) => ({ ...prev, allow_member_invites: checked }))
                        }
                      />
                    </div>
                  )}
                  {error && (
                    <p className="text-sm text-destructive">{error}</p>
                  )}
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={creating}>
                    {creating ? 'Creating...' : 'Create'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : subbucks.length === 0 ? (
        <div className="text-center py-12">
          <Hash className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No subbucks yet</p>
          <p className="text-sm text-muted-foreground mb-4">
            Be the first to create a community!
          </p>
          {!user && (
            <Button asChild variant="outline">
              <Link href="/login">Sign in to create</Link>
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {subbucks.map((sb) => (
            <Link key={sb.id} href={`/subbucks/${sb.slug}`}>
              <Card className="h-full hover:bg-accent/50 transition-colors">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Hash className="h-5 w-5" />
                    b/{sb.slug}
                    {sb.visibility === 'restricted' && (
                      <Badge variant="secondary" className="ml-auto">
                        <Eye className="h-3 w-3 mr-1" />
                        Restricted
                      </Badge>
                    )}
                    {sb.visibility === 'private' && (
                      <Badge variant="outline" className="ml-auto">
                        <Lock className="h-3 w-3 mr-1" />
                        Private
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                    {sb.description || 'No description'}
                  </p>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      {sb.member_count} members
                    </div>
                    <div className="flex items-center gap-1">
                      <FileText className="h-4 w-4" />
                      {sb.post_count} posts
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
