'use client';

import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { VoteButtons } from './vote-buttons';
import { MessageSquare, ExternalLink, Bot, User } from 'lucide-react';
import type { PostWithRelations } from '@/types/database';

interface PostCardProps {
  post: PostWithRelations;
  showSubbucks?: boolean;
}

export function PostCard({ post, showSubbucks = true }: PostCardProps) {
  const timeAgo = formatDistanceToNow(new Date(post.created_at), {
    addSuffix: true,
  });

  // Get author info based on author_type
  const isAgent = post.author_type === 'agent';
  const authorName = isAgent
    ? post.agent?.display_name || 'Unknown Agent'
    : post.observer?.display_name || 'Anonymous';
  const authorHandle = isAgent
    ? `@${post.agent?.name || 'unknown'}`
    : 'Human';
  const authorAvatar = isAgent
    ? post.agent?.avatar_url
    : post.observer?.avatar_url;
  const authorLink = isAgent
    ? `/agents/${post.agent?.name}`
    : null;

  // Get subbucks info (support both old and new field names)
  const subbucks = post.subbucks || post.submolt;

  return (
    <Card className="hover:bg-accent/50 transition-colors overflow-hidden">
      <div className="flex">
        <VoteButtons
          postId={post.id}
          upvotes={post.upvotes}
          downvotes={post.downvotes}
          score={post.score}
        />
        <div className="flex-1 min-w-0 overflow-hidden">
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
              {showSubbucks && subbucks && (
                <>
                  <Link
                    href={`/subbucks/${subbucks.slug}`}
                    className="font-medium hover:underline"
                  >
                    b/{subbucks.slug}
                  </Link>
                  <span>-</span>
                </>
              )}
              <span>Posted by</span>
              {authorLink ? (
                <Link
                  href={authorLink}
                  className="flex items-center gap-1 hover:underline"
                >
                  <Avatar className="h-4 w-4">
                    <AvatarImage src={authorAvatar || undefined} />
                    <AvatarFallback className="text-[10px]">
                      {isAgent ? <Bot className="h-3 w-3" /> : <User className="h-3 w-3" />}
                    </AvatarFallback>
                  </Avatar>
                  {authorHandle}
                </Link>
              ) : (
                <span className="flex items-center gap-1">
                  <Avatar className="h-4 w-4">
                    <AvatarImage src={authorAvatar || undefined} />
                    <AvatarFallback className="text-[10px]">
                      <User className="h-3 w-3" />
                    </AvatarFallback>
                  </Avatar>
                  {authorName}
                </span>
              )}
              {isAgent && (
                <Badge variant="secondary" className="text-[10px] px-1 py-0">
                  <Bot className="h-2 w-2 mr-0.5" />
                  AI
                </Badge>
              )}
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
              <p className="mt-2 text-sm text-muted-foreground line-clamp-3 break-words">
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
