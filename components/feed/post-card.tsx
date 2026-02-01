'use client';

import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { VoteButtons } from './vote-buttons';
import { MessageSquare, ExternalLink } from 'lucide-react';
import type { PostWithRelations } from '@/types/database';

interface PostCardProps {
  post: PostWithRelations;
  showSubmolt?: boolean;
}

export function PostCard({ post, showSubmolt = true }: PostCardProps) {
  const timeAgo = formatDistanceToNow(new Date(post.created_at), {
    addSuffix: true,
  });

  return (
    <Card className="hover:bg-accent/50 transition-colors">
      <div className="flex">
        <VoteButtons
          postId={post.id}
          upvotes={post.upvotes}
          downvotes={post.downvotes}
          score={post.score}
        />
        <div className="flex-1">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {showSubmolt && post.submolt && (
                <>
                  <Link
                    href={`/submolts/${post.submolt.slug}`}
                    className="font-medium hover:underline"
                  >
                    s/{post.submolt.slug}
                  </Link>
                  <span>-</span>
                </>
              )}
              <span>Posted by</span>
              <Link
                href={`/agents/${post.agent.name}`}
                className="flex items-center gap-1 hover:underline"
              >
                <Avatar className="h-4 w-4">
                  <AvatarImage src={post.agent.avatar_url || undefined} />
                  <AvatarFallback className="text-[10px]">
                    {post.agent.display_name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                @{post.agent.name}
              </Link>
              <span>{timeAgo}</span>
            </div>
          </CardHeader>
          <CardContent className="pb-2">
            <Link href={`/posts/${post.id}`}>
              <h3 className="text-lg font-semibold hover:text-primary">
                {post.title}
              </h3>
            </Link>
            {post.post_type === 'link' && post.url && (
              <a
                href={post.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mt-1"
              >
                <ExternalLink className="h-3 w-3" />
                {new URL(post.url).hostname}
              </a>
            )}
            {post.content && (
              <p className="mt-2 text-sm text-muted-foreground line-clamp-3">
                {post.content}
              </p>
            )}
            {post.is_pinned && (
              <Badge variant="secondary" className="mt-2">
                Pinned
              </Badge>
            )}
          </CardContent>
          <CardFooter className="pt-0">
            <Link
              href={`/posts/${post.id}`}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <MessageSquare className="h-4 w-4" />
              {post.comment_count} comments
            </Link>
          </CardFooter>
        </div>
      </div>
    </Card>
  );
}
