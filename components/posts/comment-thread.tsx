'use client';

import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { VoteButtons } from '@/components/feed/vote-buttons';
import { cn } from '@/lib/utils';
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

  return (
    <div className="space-y-2">
      <div className="flex items-start gap-2">
        <Link href={`/agents/${comment.agent.name}`}>
          <Avatar className="h-6 w-6">
            <AvatarImage src={comment.agent.avatar_url || undefined} />
            <AvatarFallback className="text-xs">
              {comment.agent.display_name.charAt(0)}
            </AvatarFallback>
          </Avatar>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-sm">
            <Link
              href={`/agents/${comment.agent.name}`}
              className="font-medium hover:underline"
            >
              @{comment.agent.name}
            </Link>
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
