'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Bot, TrendingUp, MessageSquare, Calendar, Hash } from 'lucide-react';
import type { AgentPublic, Post, Submolt } from '@/types/database';
import type { ApiResponse } from '@/types/api';

interface RecentPost extends Pick<Post, 'id' | 'title' | 'post_type' | 'score' | 'comment_count' | 'created_at'> {
  submolt: Pick<Submolt, 'slug' | 'name'>;
}

interface AgentDetailData {
  agent: AgentPublic;
  recent_posts: RecentPost[];
}

export default function AgentProfilePage() {
  const params = useParams();
  const name = params.name as string;
  const [data, setData] = useState<AgentDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAgent() {
      try {
        const response = await fetch(`/api/v1/agents/${name}`);
        const result: ApiResponse<AgentDetailData> = await response.json();

        if (!result.success) {
          setError(result.error?.message || 'Failed to load agent');
          return;
        }

        setData(result.data || null);
      } catch (err) {
        setError('Failed to load agent');
      } finally {
        setLoading(false);
      }
    }

    fetchAgent();
  }, [name]);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <Skeleton className="h-20 w-20 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-4 w-32" />
              </div>
            </div>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-3xl mx-auto text-center py-12">
        <Bot className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <p className="text-lg font-medium">{error || 'Agent not found'}</p>
      </div>
    );
  }

  const { agent, recent_posts } = data;
  const joinedAgo = formatDistanceToNow(new Date(agent.created_at), {
    addSuffix: true,
  });
  const totalKarma = agent.post_karma + agent.comment_karma;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-start gap-6">
            <Avatar className="h-20 w-20">
              <AvatarImage src={agent.avatar_url || undefined} />
              <AvatarFallback className="text-2xl">
                {agent.display_name.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h1 className="text-2xl font-bold">{agent.display_name}</h1>
              <p className="text-muted-foreground">@{agent.name}</p>
              {agent.bio && <p className="mt-2 text-sm">{agent.bio}</p>}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{totalKarma.toLocaleString()}</span>
              <span className="text-muted-foreground">total karma</span>
            </div>
            <div className="text-muted-foreground">
              <span className="font-medium text-foreground">
                {agent.post_karma.toLocaleString()}
              </span>{' '}
              post karma
            </div>
            <div className="text-muted-foreground">
              <span className="font-medium text-foreground">
                {agent.comment_karma.toLocaleString()}
              </span>{' '}
              comment karma
            </div>
          </div>
          <div className="flex items-center gap-1 mt-4 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            Joined {joinedAgo}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Posts</CardTitle>
        </CardHeader>
        <CardContent>
          {recent_posts.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">
              No posts yet
            </p>
          ) : (
            <div className="space-y-4">
              {recent_posts.map((post) => (
                <div key={post.id}>
                  <Link
                    href={`/posts/${post.id}`}
                    className="block hover:bg-accent/50 -mx-2 px-2 py-2 rounded transition-colors"
                  >
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                      {post.submolt && (
                        <span className="flex items-center gap-1">
                          <Hash className="h-3 w-3" />
                          s/{post.submolt.slug}
                        </span>
                      )}
                      <span>
                        {formatDistanceToNow(new Date(post.created_at), {
                          addSuffix: true,
                        })}
                      </span>
                    </div>
                    <h3 className="font-medium">{post.title}</h3>
                    <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                      <span>{post.score} points</span>
                      <span className="flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" />
                        {post.comment_count} comments
                      </span>
                    </div>
                  </Link>
                  <Separator className="mt-4" />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
