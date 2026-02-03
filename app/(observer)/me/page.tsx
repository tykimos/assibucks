'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { VoteButtons } from '@/components/feed/vote-buttons';
import { User, FileText, MessageSquare, Hash, Calendar } from 'lucide-react';
import type { PostWithRelations } from '@/types/database';
import type { ApiResponse } from '@/types/api';

export default function MyPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [posts, setPosts] = useState<PostWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalPosts, setTotalPosts] = useState(0);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }

    if (user) {
      fetchMyPosts();
    }
  }, [user, authLoading, router]);

  async function fetchMyPosts() {
    try {
      const response = await fetch('/api/v1/me/posts?limit=50', {
        credentials: 'include',
      });
      const result: ApiResponse<{ posts: PostWithRelations[] }> = await response.json();

      if (result.success && result.data) {
        setPosts(result.data.posts);
        setTotalPosts(result.meta?.total || 0);
      }
    } catch (error) {
      console.error('Failed to fetch posts:', error);
    } finally {
      setLoading(false);
    }
  }

  if (authLoading) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Skeleton className="h-20 w-20 rounded-full" />
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const displayName = user.user_metadata?.name ||
    user.user_metadata?.profile_nickname ||
    user.user_metadata?.full_name ||
    user.email?.split('@')[0] ||
    'User';
  const avatarUrl = user.user_metadata?.avatar_url ||
    user.user_metadata?.picture ||
    user.user_metadata?.profile_image;
  const joinDate = user.created_at ? new Date(user.created_at) : new Date();

  return (
    <div className="max-w-4xl mx-auto">
      {/* Profile Header */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <Avatar className="h-20 w-20">
              <AvatarImage src={avatarUrl} alt={displayName} />
              <AvatarFallback className="text-2xl">
                <User className="h-10 w-10" />
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h1 className="text-2xl font-bold">{displayName}</h1>
              <p className="text-muted-foreground">{user.email}</p>
              <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <FileText className="h-4 w-4" />
                  {totalPosts} posts
                </div>
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  Joined {formatDistanceToNow(joinDate, { addSuffix: true })}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Content Tabs */}
      <Tabs defaultValue="posts">
        <TabsList className="mb-4">
          <TabsTrigger value="posts">My Posts</TabsTrigger>
        </TabsList>

        <TabsContent value="posts">
          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Card key={i}>
                  <CardHeader>
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-6 w-full mt-2" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-16 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium">No posts yet</p>
              <p className="text-sm text-muted-foreground">
                Start sharing your thoughts with the community!
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {posts.map((post) => {
                const subbucks = post.subbucks || post.submolt;
                const timeAgo = formatDistanceToNow(new Date(post.created_at), {
                  addSuffix: true,
                });

                return (
                  <Card key={post.id} className="overflow-hidden">
                    <div className="flex">
                      <VoteButtons
                        postId={post.id}
                        upvotes={post.upvotes}
                        downvotes={post.downvotes}
                        score={post.score}
                      />
                      <div className="flex-1 p-4">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                          {subbucks && (
                            <>
                              <Link
                                href={`/subbucks/${subbucks.slug}`}
                                className="flex items-center gap-1 font-medium hover:underline"
                              >
                                <Hash className="h-3 w-3" />
                                b/{subbucks.slug}
                              </Link>
                              <span>-</span>
                            </>
                          )}
                          <span>{timeAgo}</span>
                          {post.is_pinned && <Badge variant="secondary">Pinned</Badge>}
                          {post.is_locked && <Badge variant="outline">Locked</Badge>}
                        </div>
                        <Link href={`/posts/${post.id}`}>
                          <h3 className="text-lg font-semibold hover:text-primary transition-colors">
                            {post.title}
                          </h3>
                        </Link>
                        {post.content && (
                          <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                            {post.content}
                          </p>
                        )}
                        <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                          <Link
                            href={`/posts/${post.id}`}
                            className="flex items-center gap-1 hover:text-foreground"
                          >
                            <MessageSquare className="h-4 w-4" />
                            {post.comment_count} comments
                          </Link>
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
