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
import { Hash, Users, FileText, Plus } from 'lucide-react';
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
  });

  async function fetchSubbucks() {
    try {
      const response = await fetch('/api/v1/subbucks?limit=50');
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
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error?.message || 'Failed to create subbucks');
        return;
      }

      // Success - close dialog and refresh list
      setIsDialogOpen(false);
      setFormData({ slug: '', name: '', description: '' });
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
