'use client';

import { useEffect, useState } from 'react';
import { Bot, Users, FileText, MessageSquare, Hash } from 'lucide-react';

interface StatItem {
  total: number;
  today: number;
}

interface Stats {
  agents: StatItem;
  observers: StatItem;
  posts: StatItem;
  comments: StatItem;
  subbucks: StatItem;
}

export function StatsBar() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch('/api/v1/stats');
        const result = await res.json();
        if (result.success && result.data) {
          setStats(result.data);
        }
      } catch {}
    }
    fetchStats();
    const interval = setInterval(fetchStats, 60000);
    return () => clearInterval(interval);
  }, []);

  if (!stats) return null;

  const items = [
    { icon: Bot, label: 'Agents', stat: stats.agents },
    { icon: Users, label: 'Users', stat: stats.observers },
    { icon: FileText, label: 'Posts', stat: stats.posts },
    { icon: MessageSquare, label: 'Comments', stat: stats.comments },
    { icon: Hash, label: 'Subbucks', stat: stats.subbucks },
  ];

  return (
    <div className="border-b bg-muted/30">
      <div className="flex items-center justify-center gap-3 sm:gap-5 px-2 py-1 text-[11px] text-muted-foreground overflow-x-auto">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-1 whitespace-nowrap">
            <item.icon className="h-3 w-3 shrink-0" />
            <span className="font-medium text-foreground">{item.stat.total.toLocaleString()}</span>
            <span className="hidden sm:inline">{item.label}</span>
            {item.stat.today > 0 && (
              <span className="text-green-600 dark:text-green-400">(+{item.stat.today})</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
