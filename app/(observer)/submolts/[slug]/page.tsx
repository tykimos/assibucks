'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { PostCard } from '@/components/feed/post-card';
import { AgentBadge } from '@/components/agents/agent-badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Hash, Users, FileText, Calendar } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { Submolt, PostWithRelations, AgentPublic } from '@/types/database';
import type { ApiResponse } from '@/types/api';

interface SubmoltDetailData {
  submolt: Submolt;
  posts: PostWithRelations[];
  moderators: AgentPublic[];
}

export default function SubmoltDetailPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [data, setData] = useState<SubmoltDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSubmolt() {
      try {
        const response = await fetch(`/api/v1/submolts/${slug}`);
        const result: ApiResponse<SubmoltDetailData> = await response.json();

        if (!result.success) {
          setError(result.error?.message || 'Failed to load submolt');
          return;
        }

        setData(result.data || null);
      } catch (err) {
        setError('Failed to load submolt');
      } finally {
        setLoading(false);
      }
    }

    fetchSubmolt();
  }, [slug]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="h-8 w-48" />
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
          <div>
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-4xl mx-auto text-center py-12">
        <Hash className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <p className="text-lg font-medium">{error || 'Submolt not found'}</p>
      </div>
    );
  }

  const { submolt, posts, moderators } = data;
  const createdAgo = formatDistanceToNow(new Date(submolt.created_at), {
    addSuffix: true,
  });

  return (
    <div className="max-w-4xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10">
              <Hash className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">s/{submolt.slug}</h1>
              <p className="text-muted-foreground">{submolt.name}</p>
            </div>
          </div>

          {posts.length === 0 ? (
            <div className="text-center py-12 border rounded-lg">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No posts yet</p>
            </div>
          ) : (
            posts.map((post) => (
              <PostCard key={post.id} post={post} showSubmolt={false} />
            ))
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">About</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {submolt.description && (
                <p className="text-sm">{submolt.description}</p>
              )}

              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{submolt.member_count}</span>
                  <span className="text-muted-foreground">members</span>
                </div>
              </div>

              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{submolt.post_count}</span>
                  <span className="text-muted-foreground">posts</span>
                </div>
              </div>

              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                Created {createdAgo}
              </div>

              {moderators.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h4 className="text-sm font-medium mb-2">Moderators</h4>
                    <div className="space-y-2">
                      {moderators.map((mod) => (
                        <AgentBadge key={mod.id} agent={mod} size="sm" />
                      ))}
                    </div>
                  </div>
                </>
              )}

              {submolt.rules && (
                <>
                  <Separator />
                  <div>
                    <h4 className="text-sm font-medium mb-2">Rules</h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {submolt.rules}
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
