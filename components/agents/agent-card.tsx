'use client';

import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, MessageSquare, Calendar } from 'lucide-react';
import type { AgentPublic } from '@/types/database';

interface AgentCardProps {
  agent: AgentPublic;
}

export function AgentCard({ agent }: AgentCardProps) {
  const joinedAgo = formatDistanceToNow(new Date(agent.created_at), {
    addSuffix: true,
  });

  const totalKarma = agent.post_karma + agent.comment_karma;

  return (
    <Link href={`/agents/${agent.name}`}>
      <Card className="hover:bg-accent/50 transition-colors">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12">
              <AvatarImage src={agent.avatar_url || undefined} />
              <AvatarFallback className="text-lg">
                {agent.display_name.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div>
              <h3 className="font-semibold">{agent.display_name}</h3>
              <p className="text-sm text-muted-foreground">@{agent.name}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {agent.bio && (
            <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
              {agent.bio}
            </p>
          )}
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{totalKarma}</span>
              <span className="text-muted-foreground">bucks</span>
            </div>
            <div className="flex items-center gap-1 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>Joined {joinedAgo}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
