'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/use-auth';
import { Loader2, Send, Hash } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Subbucks {
  id: string;
  slug: string;
  name: string;
}

interface CreatePostFormProps {
  defaultSubbucks?: string;
  onSuccess?: () => void;
  compact?: boolean;
}

export function CreatePostForm({ defaultSubbucks, onSuccess, compact }: CreatePostFormProps = {}) {
  const { user } = useAuth();
  const router = useRouter();
  const [subbucksList, setSubbucksList] = useState<Subbucks[]>([]);
  const [selectedSubbucks, setSelectedSubbucks] = useState(defaultSubbucks || 'general');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSubbucks() {
      try {
        const response = await fetch('/api/v1/subbucks?limit=50');
        const result = await response.json();
        if (result.success && result.data?.subbucks) {
          setSubbucksList(result.data.subbucks);
        }
      } catch (err) {
        console.error('Failed to fetch subbucks:', err);
      }
    }
    fetchSubbucks();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !title.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/v1/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          subbucks: selectedSubbucks,
          title: title.trim(),
          content: content.trim() || undefined,
          post_type: 'text',
        }),
      });

      const result = await response.json();

      if (!result.success) {
        setError(result.error?.message || 'Failed to create post');
        return;
      }

      // Clear form and redirect
      setTitle('');
      setContent('');
      onSuccess?.();
      router.push(`/posts/${result.data.post.id}`);
      router.refresh();
    } catch (err) {
      setError('Failed to create post');
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    if (compact) {
      return (
        <p className="py-4 text-center text-sm text-muted-foreground">
          Login to create a post
        </p>
      );
    }
    return (
      <Card>
        <CardContent className="py-4 text-center text-sm text-muted-foreground">
          Login to create a post
        </CardContent>
      </Card>
    );
  }

  const formContent = (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <Label htmlFor="subbucks" className="text-xs">Community</Label>
        <div className="relative mt-1">
          <Hash className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <select
            id="subbucks"
            value={selectedSubbucks}
            onChange={(e) => setSelectedSubbucks(e.target.value)}
            className="w-full h-9 pl-8 pr-3 rounded-md border border-input bg-background text-sm"
          >
            {subbucksList.map((sb) => (
              <option key={sb.id} value={sb.slug}>
                b/{sb.slug}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <Label htmlFor="title" className="text-xs">Title</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What's on your mind?"
          className="mt-1"
          maxLength={300}
          required
        />
      </div>

      <div>
        <Label htmlFor="content" className="text-xs">Content (optional)</Label>
        <Textarea
          id="content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Add more details... (Markdown supported)"
          className={cn("mt-1", compact ? "min-h-[80px]" : "min-h-[120px]")}
          maxLength={10000}
        />
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <Button type="submit" disabled={loading || !title.trim()} className="w-full">
        {loading ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Send className="h-4 w-4 mr-2" />
        )}
        Post
      </Button>
    </form>
  );

  if (compact) {
    return formContent;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Create Post</CardTitle>
      </CardHeader>
      <CardContent>
        {formContent}
      </CardContent>
    </Card>
  );
}
