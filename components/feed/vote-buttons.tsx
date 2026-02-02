'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowBigUp, ArrowBigDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';

interface VoteButtonsProps {
  postId?: string;
  commentId?: string;
  upvotes: number;
  downvotes: number;
  score: number;
  vertical?: boolean;
}

export function VoteButtons({
  postId,
  commentId,
  upvotes,
  downvotes,
  score: initialScore,
  vertical = true,
}: VoteButtonsProps) {
  const { user } = useAuth();
  const [score, setScore] = useState(initialScore);
  const [userVote, setUserVote] = useState<'up' | 'down' | null>(null);
  const [loading, setLoading] = useState(false);

  const formatScore = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return n.toString();
  };

  const handleVote = async (voteType: 'up' | 'down') => {
    if (!user || loading) return;

    setLoading(true);
    try {
      const endpoint = postId
        ? `/api/v1/posts/${postId}`
        : `/api/v1/comments/${commentId}`;

      // If clicking same vote, remove it
      if (userVote === voteType) {
        const response = await fetch(`${endpoint}/unvote`, {
          method: 'POST',
          credentials: 'include',
        });
        const result = await response.json();
        if (result.success) {
          setScore(result.data.post?.score ?? result.data.comment?.score ?? score);
          setUserVote(null);
        }
      } else {
        // New vote or change vote
        const response = await fetch(`${endpoint}/${voteType}vote`, {
          method: 'POST',
          credentials: 'include',
        });
        const result = await response.json();
        if (result.success) {
          setScore(result.data.post?.score ?? result.data.comment?.score ?? score);
          setUserVote(voteType);
        }
      }
    } catch (error) {
      console.error('Vote error:', error);
    } finally {
      setLoading(false);
    }
  };

  const isDisabled = !user || loading;
  const title = !user ? 'Login to vote' : '';

  if (vertical) {
    return (
      <div className="flex flex-col items-center px-2 py-4">
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            'h-8 w-8 rounded-sm',
            userVote === 'up' && 'text-orange-500 bg-orange-500/10'
          )}
          disabled={isDisabled}
          title={title}
          onClick={() => handleVote('up')}
        >
          <ArrowBigUp className="h-5 w-5" />
        </Button>
        <span
          className={cn(
            'text-sm font-medium py-1',
            userVote === 'up' && 'text-orange-500',
            userVote === 'down' && 'text-blue-500'
          )}
        >
          {formatScore(score)}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            'h-8 w-8 rounded-sm',
            userVote === 'down' && 'text-blue-500 bg-blue-500/10'
          )}
          disabled={isDisabled}
          title={title}
          onClick={() => handleVote('down')}
        >
          <ArrowBigDown className="h-5 w-5" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          'h-6 w-6 rounded-sm',
          userVote === 'up' && 'text-orange-500 bg-orange-500/10'
        )}
        disabled={isDisabled}
        title={title}
        onClick={() => handleVote('up')}
      >
        <ArrowBigUp className="h-4 w-4" />
      </Button>
      <span
        className={cn(
          'text-xs font-medium',
          userVote === 'up' && 'text-orange-500',
          userVote === 'down' && 'text-blue-500'
        )}
      >
        {formatScore(score)}
      </span>
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          'h-6 w-6 rounded-sm',
          userVote === 'down' && 'text-blue-500 bg-blue-500/10'
        )}
        disabled={isDisabled}
        title={title}
        onClick={() => handleVote('down')}
      >
        <ArrowBigDown className="h-4 w-4" />
      </Button>
    </div>
  );
}
