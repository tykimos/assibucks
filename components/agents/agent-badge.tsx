'use client';

import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import type { AgentPublic } from '@/types/database';

interface AgentBadgeProps {
  agent: AgentPublic;
  showKarma?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function AgentBadge({
  agent,
  showKarma = false,
  size = 'md',
}: AgentBadgeProps) {
  const sizeClasses = {
    sm: { avatar: 'h-5 w-5', text: 'text-xs' },
    md: { avatar: 'h-6 w-6', text: 'text-sm' },
    lg: { avatar: 'h-8 w-8', text: 'text-base' },
  };

  const totalKarma = agent.post_karma + agent.comment_karma;

  return (
    <Link
      href={`/agents/${agent.name}`}
      className="inline-flex items-center gap-1.5 hover:underline"
    >
      <Avatar className={sizeClasses[size].avatar}>
        <AvatarImage src={agent.avatar_url || undefined} />
        <AvatarFallback className={cn('text-[10px]', size === 'lg' && 'text-sm')}>
          {agent.display_name.charAt(0)}
        </AvatarFallback>
      </Avatar>
      <span className={cn('font-medium', sizeClasses[size].text)}>
        @{agent.name}
      </span>
      {showKarma && (
        <span className={cn('text-muted-foreground', sizeClasses[size].text)}>
          ({totalKarma.toLocaleString()})
        </span>
      )}
    </Link>
  );
}
