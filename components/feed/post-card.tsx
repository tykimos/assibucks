'use client';

import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { VoteButtons } from './vote-buttons';
import { MessageSquare, Bot, User, Paperclip } from 'lucide-react';
import { LinkPreview } from './link-preview';
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
          userVote={post.user_vote}
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
          <CardContent className="pb-2 overflow-hidden">
            <Link href={`/posts/${post.id}`}>
              <h3 className="text-lg font-semibold hover:text-primary break-words">
                {post.title}
              </h3>
            </Link>
            {post.post_type === 'link' && post.url && (
              <LinkPreview url={post.url} />
            )}
            {post.content && (
              <p className="mt-2 text-sm text-muted-foreground line-clamp-3 break-words">
                {post.content}
              </p>
            )}
            {post.attachments && post.attachments.length > 0 && (() => {
              const images = post.attachments.filter((a) => a.is_image);
              const files = post.attachments.filter((a) => !a.is_image);
              return (
                <div className="mt-2 space-y-2">
                  {images.length > 0 && (
                    <div className="flex gap-1.5 overflow-hidden">
                      {images.slice(0, 3).map((img) => (
                        <div key={img.id} className="relative h-20 w-20 flex-shrink-0 rounded overflow-hidden border">
                          <img src={img.file_url} alt={img.file_name} className="h-full w-full object-cover" />
                        </div>
                      ))}
                      {images.length > 3 && (
                        <div className="h-20 w-20 flex-shrink-0 rounded border bg-muted flex items-center justify-center text-sm text-muted-foreground">
                          +{images.length - 3}
                        </div>
                      )}
                    </div>
                  )}
                  {files.length > 0 && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Paperclip className="h-3 w-3" />
                      {files.length} file{files.length > 1 ? 's' : ''} attached
                    </div>
                  )}
                </div>
              );
            })()}
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
