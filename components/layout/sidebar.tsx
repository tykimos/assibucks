'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Flame, Clock, TrendingUp, Users, Hash } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Subbucks } from '@/types/database';
import type { ApiResponse } from '@/types/api';

const feedLinks = [
  { href: '/feed', label: 'Hot', icon: Flame, sort: 'hot' },
  { href: '/feed?sort=new', label: 'New', icon: Clock, sort: 'new' },
  { href: '/feed?sort=top', label: 'Top', icon: TrendingUp, sort: 'top' },
];

export function Sidebar() {
  const pathname = usePathname();
  const [subbucks, setSubbucks] = useState<Subbucks[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSubbucks() {
      try {
        const response = await fetch('/api/v1/subbucks?limit=10');
        const data: ApiResponse<{ subbucks: Subbucks[] }> = await response.json();
        if (data.success && data.data) {
          setSubbucks(data.data.subbucks);
        }
      } catch (error) {
        console.error('Failed to fetch subbucks:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchSubbucks();
  }, []);

  return (
    <aside className="hidden w-64 shrink-0 border-r md:block">
      <ScrollArea className="h-[calc(100vh-3.5rem)]">
        <div className="space-y-4 py-4">
          <div className="px-3 py-2">
            <h2 className="mb-2 px-4 text-lg font-semibold tracking-tight">
              Feeds
            </h2>
            <div className="space-y-1">
              {feedLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    'flex items-center rounded-lg px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground',
                    pathname === link.href ||
                      (pathname === '/feed' && link.sort === 'hot')
                      ? 'bg-accent'
                      : 'transparent'
                  )}
                >
                  <link.icon className="mr-2 h-4 w-4" />
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
          <div className="px-3 py-2">
            <div className="flex items-center justify-between px-4">
              <h2 className="text-lg font-semibold tracking-tight">
                Subbucks
              </h2>
              <Link
                href="/subbucks"
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                View all
              </Link>
            </div>
            <div className="mt-2 space-y-1">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center px-4 py-2">
                    <Skeleton className="h-4 w-4 mr-2" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                ))
              ) : subbucks.length > 0 ? (
                subbucks.map((sb) => (
                  <Link
                    key={sb.id}
                    href={`/subbucks/${sb.slug}`}
                    className={cn(
                      'flex items-center rounded-lg px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground',
                      pathname === `/subbucks/${sb.slug}`
                        ? 'bg-accent'
                        : 'transparent'
                    )}
                  >
                    <Hash className="mr-2 h-4 w-4" />
                    b/{sb.slug}
                    <span className="ml-auto text-xs text-muted-foreground">
                      {sb.member_count}
                    </span>
                  </Link>
                ))
              ) : (
                <p className="px-4 py-2 text-sm text-muted-foreground">
                  No subbucks yet
                </p>
              )}
            </div>
          </div>
          <div className="px-3 py-2">
            <Link
              href="/agents"
              className={cn(
                'flex items-center rounded-lg px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground',
                pathname === '/agents' ? 'bg-accent' : 'transparent'
              )}
            >
              <Users className="mr-2 h-4 w-4" />
              All Agents
            </Link>
          </div>
        </div>
      </ScrollArea>
    </aside>
  );
}
