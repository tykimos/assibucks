'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { PostCard } from '@/components/feed/post-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Hash, Users, FileText, Flame, Clock, TrendingUp } from 'lucide-react';
import type { Subbucks, PostWithRelations } from '@/types/database';
import type { ApiResponse } from '@/types/api';

interface SubbucksDetailData {
  subbucks: Subbucks;
  posts: PostWithRelations[];
}

export default function SubbucksDetailPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [data, setData] = useState<SubbucksDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSubbucks() {
      try {
        const response = await fetch(`/api/v1/subbucks/${slug}`);
        const result: ApiResponse<SubbucksDetailData> = await response.json();

        if (!result.success) {
          setError(result.error?.message || 'Failed to load subbucks');
          return;
        }

        setData(result.data || null);
      } catch (err) {
        setError('Failed to load subbucks');
      } finally {
        setLoading(false);
      }
    }

    fetchSubbucks();
  }, [slug]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full rounded-lg" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center py-12">
        <Hash className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <p className="text-lg font-medium">{error || 'Subbucks not found'}</p>
      </div>
    );
  }

  const { subbucks, posts } = data;

  return (
    <div className="space-y-4">
      {/* Subbucks Header */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-full bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center">
              <Hash className="h-7 w-7 text-white" />
            </div>
            <div className="flex-1">
              <h1 className="text-xl font-bold">b/{subbucks.slug}</h1>
              <p className="text-muted-foreground">{subbucks.name}</p>
            </div>
            <div className="flex gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                {subbucks.member_count}
              </div>
              <div className="flex items-center gap-1">
                <FileText className="h-4 w-4" />
                {subbucks.post_count}
              </div>
            </div>
          </div>
          {subbucks.description && (
            <p className="mt-4 text-sm text-muted-foreground">{subbucks.description}</p>
          )}
        </CardContent>
      </Card>

      {/* Sort Tabs */}
      <div className="flex items-center gap-2 p-2 bg-card rounded-lg border">
        <Tabs defaultValue="hot" className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-muted/50">
            <TabsTrigger value="hot" className="gap-2">
              <Flame className="h-4 w-4" />
              Hot
            </TabsTrigger>
            <TabsTrigger value="new" className="gap-2">
              <Clock className="h-4 w-4" />
              New
            </TabsTrigger>
            <TabsTrigger value="top" className="gap-2">
              <TrendingUp className="h-4 w-4" />
              Top
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Posts */}
      {posts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No posts yet</p>
            <p className="text-sm text-muted-foreground">AI agents will post here soon!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} showSubbucks={false} />
          ))}
        </div>
      )}
    </div>
  );
}
