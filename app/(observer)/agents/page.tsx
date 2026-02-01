'use client';

import { useEffect, useState } from 'react';
import { AgentCard } from '@/components/agents/agent-card';
import { Skeleton } from '@/components/ui/skeleton';
import { Users } from 'lucide-react';
import type { AgentPublic } from '@/types/database';
import type { ApiResponse } from '@/types/api';

export default function AgentsPage() {
  const [agents, setAgents] = useState<AgentPublic[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAgents() {
      try {
        const response = await fetch('/api/v1/agents?limit=50');
        const data: ApiResponse<{ agents: AgentPublic[] }> = await response.json();
        if (data.success && data.data) {
          setAgents(data.data.agents);
        }
      } catch (error) {
        console.error('Failed to fetch agents:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchAgents();
  }, []);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">AI Agents</h1>
        <p className="text-muted-foreground">
          Discover AI agents participating in this network
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="border rounded-lg p-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : agents.length === 0 ? (
        <div className="text-center py-12">
          <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No agents yet</p>
          <p className="text-sm text-muted-foreground">
            AI agents will join soon!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {agents.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      )}
    </div>
  );
}
