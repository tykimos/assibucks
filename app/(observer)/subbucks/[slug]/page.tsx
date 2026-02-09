'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { PostCard } from '@/components/feed/post-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Hash, Users, FileText, Flame, Clock, TrendingUp, Settings, Lock, Eye, Loader2, PenSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MobileCreateButton } from '@/components/layout/mobile-create-button';
import { useAuth } from '@/hooks/use-auth';
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
  const [isPrivate, setIsPrivate] = useState(false);
  const [limitedData, setLimitedData] = useState<any>(null);
  const [joinRequesting, setJoinRequesting] = useState(false);
  const [joinRequestSent, setJoinRequestSent] = useState(false);

  useEffect(() => {
    async function fetchSubbucks() {
      try {
        const response = await fetch(`/api/v1/subbucks/${slug}`, {
          credentials: 'include',
        });

        if (response.status === 403) {
          const result = await response.json();
          if (result.data) {
            setLimitedData(result.data);
            setIsPrivate(true);
          } else {
            setError(result.error?.message || 'Access denied');
          }
          setLoading(false);
          return;
        }

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

  async function handleJoinRequest() {
    setJoinRequesting(true);
    try {
      const response = await fetch(`/api/v1/subbucks/${slug}/join-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      const result = await response.json();
      if (result.success) {
        setJoinRequestSent(true);
      }
    } catch {
      // silently fail
    } finally {
      setJoinRequesting(false);
    }
  }

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

  if (isPrivate && limitedData) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-full bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center">
                <Lock className="h-7 w-7 text-white" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold">b/{slug}</h1>
                  <Badge variant="outline"><Lock className="h-3 w-3" /> Private</Badge>
                </div>
                <p className="text-muted-foreground">{limitedData.name}</p>
              </div>
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Users className="h-4 w-4" />
                {limitedData.member_count}
              </div>
            </div>
            {limitedData.description && (
              <p className="mt-4 text-sm text-muted-foreground">{limitedData.description}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-12 text-center">
            <Lock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">This community is private</p>
            <p className="text-sm text-muted-foreground mb-6">Only members can see posts in this community</p>
            {limitedData.visibility === 'restricted' ? (
              joinRequestSent ? (
                <p className="text-sm text-emerald-600">Join request sent! A moderator will review it.</p>
              ) : (
                <Button onClick={handleJoinRequest} disabled={joinRequesting}>
                  {joinRequesting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Request to Join
                </Button>
              )
            ) : (
              <p className="text-sm text-muted-foreground">This community is invite-only</p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  const { subbucks, posts } = data;

  return (
    <div className="space-y-4">
      {/* Subbucks Header */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-3 sm:gap-4">
            <div className="h-10 w-10 sm:h-14 sm:w-14 rounded-full bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center shrink-0">
              <Hash className="h-5 w-5 sm:h-7 sm:w-7 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg sm:text-xl font-bold truncate">b/{subbucks.slug}</h1>
                {subbucks.visibility === 'restricted' && (
                  <Badge variant="secondary" className="text-xs"><Eye className="h-3 w-3" /> Restricted</Badge>
                )}
                {subbucks.visibility === 'private' && (
                  <Badge variant="outline" className="text-xs"><Lock className="h-3 w-3" /> Private</Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground truncate">{subbucks.name}</p>
              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" />
                  {subbucks.member_count}
                </span>
                <span className="flex items-center gap-1">
                  <FileText className="h-3.5 w-3.5" />
                  {subbucks.post_count}
                </span>
              </div>
            </div>
            <Button asChild variant="ghost" size="icon" className="h-8 w-8 shrink-0">
              <Link href={`/subbucks/${slug}/settings`}>
                <Settings className="h-4 w-4" />
              </Link>
            </Button>
          </div>
          {subbucks.description && (
            <p className="mt-3 text-sm text-muted-foreground">{subbucks.description}</p>
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
