'use client';

import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { VoteButtons } from '@/components/feed/vote-buttons';
import { cn } from '@/lib/utils';
import { Bot, User } from 'lucide-react';
import type { CommentWithRelations } from '@/types/database';

interface CommentThreadProps {
  comments: CommentWithRelations[];
  depth?: number;
}

export function CommentThread({ comments, depth = 0 }: CommentThreadProps) {
  if (comments.length === 0) {
    return null;
  }

  return (
    <div className={cn('space-y-4', depth > 0 && 'ml-4 pl-4 border-l')}>
      {comments.map((comment) => (
        <CommentItem key={comment.id} comment={comment} depth={depth} />
      ))}
    </div>
  );
}

interface CommentItemProps {
  comment: CommentWithRelations;
  depth: number;
}

function CommentItem({ comment, depth }: CommentItemProps) {
  const timeAgo = formatDistanceToNow(new Date(comment.created_at), {
    addSuffix: true,
  });

  // Get author info based on author_type
  const isAgent = comment.author_type === 'agent';
  const authorName = isAgent
    ? comment.agent?.display_name || 'Unknown Agent'
    : comment.observer?.display_name || 'Anonymous';
  const authorHandle = isAgent
    ? `@${comment.agent?.name || 'unknown'}`
    : authorName;
  const authorAvatar = isAgent
    ? comment.agent?.avatar_url
    : comment.observer?.avatar_url;
  const authorLink = isAgent && comment.agent?.name
    ? `/agents/${comment.agent.name}`
    : null;

  return (
    <div className="space-y-2">
      <div className="flex items-start gap-2">
        {authorLink ? (
          <Link href={authorLink}>
            <Avatar className="h-6 w-6">
              <AvatarImage src={authorAvatar || undefined} />
              <AvatarFallback className="text-xs">
                {isAgent ? <Bot className="h-3 w-3" /> : <User className="h-3 w-3" />}
              </AvatarFallback>
            </Avatar>
          </Link>
        ) : (
          <Avatar className="h-6 w-6">
            <AvatarImage src={authorAvatar || undefined} />
            <AvatarFallback className="text-xs">
              <User className="h-3 w-3" />
            </AvatarFallback>
          </Avatar>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-sm">
            {authorLink ? (
              <Link
                href={authorLink}
                className="font-medium hover:underline"
              >
                {authorHandle}
              </Link>
            ) : (
              <span className="font-medium">{authorName}</span>
            )}
            {isAgent && (
              <Badge variant="secondary" className="text-[10px] px-1 py-0">
                <Bot className="h-2 w-2 mr-0.5" />
                AI
              </Badge>
            )}
            <span className="text-muted-foreground">{timeAgo}</span>
          </div>
          <div className="mt-1 text-sm whitespace-pre-wrap">
            {comment.content}
          </div>
          <div className="mt-1">
            <VoteButtons
              commentId={comment.id}
              upvotes={comment.upvotes}
              downvotes={comment.downvotes}
              score={comment.score}
              vertical={false}
            />
          </div>
        </div>
      </div>
      {comment.replies && comment.replies.length > 0 && (
        <CommentThread comments={comment.replies} depth={depth + 1} />
      )}
    </div>
  );
}
