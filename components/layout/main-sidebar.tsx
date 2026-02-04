'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Flame, Clock, TrendingUp, Hash, Users } from 'lucide-react';
import type { Subbucks } from '@/types/database';
import type { ApiResponse } from '@/types/api';

export function MainSidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentSort = searchParams.get('sort') || 'hot';
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

  const isHome = pathname === '/';
  const isFeed = pathname === '/feed';
  const isHotActive = (isHome || isFeed) && currentSort === 'hot';
  const isNewActive = (isHome || isFeed) && currentSort === 'new';
  const isTopActive = (isHome || isFeed) && currentSort === 'top';

  return (
    <aside className="hidden w-64 shrink-0 lg:block sticky top-14 self-start h-[calc(100vh-3.5rem)]">
      <ScrollArea className="h-full py-4">
        <div className="space-y-4 px-3">
          {/* Feeds */}
          <div>
            <h2 className="mb-2 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Feeds
            </h2>
            <div className="space-y-1">
              <Link
                href="/"
                className={cn(
                  'flex items-center rounded-lg px-4 py-2 text-sm font-medium hover:bg-accent',
                  isHotActive && 'bg-accent'
                )}
              >
                <Flame className="mr-3 h-5 w-5 text-orange-500" />
                Hot
              </Link>
              <Link
                href="/?sort=new"
                className={cn(
                  'flex items-center rounded-lg px-4 py-2 text-sm font-medium hover:bg-accent',
                  isNewActive && 'bg-accent'
                )}
              >
                <Clock className="mr-3 h-5 w-5 text-blue-500" />
                New
              </Link>
              <Link
                href="/?sort=top"
                className={cn(
                  'flex items-center rounded-lg px-4 py-2 text-sm font-medium hover:bg-accent',
                  isTopActive && 'bg-accent'
                )}
              >
                <TrendingUp className="mr-3 h-5 w-5 text-green-500" />
                Top
              </Link>
            </div>
          </div>

          {/* Subbucks */}
          <div>
            <div className="flex items-center justify-between px-4 mb-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Subbucks
              </h2>
              <Link
                href="/subbucks"
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                See all
              </Link>
            </div>
            <div className="space-y-1">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center px-4 py-2">
                    <Skeleton className="h-5 w-5 mr-3 rounded" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                ))
              ) : subbucks.length > 0 ? (
                subbucks.map((sb) => (
                  <Link
                    key={sb.id}
                    href={`/subbucks/${sb.slug}`}
                    className={cn(
                      'flex items-center rounded-lg px-4 py-2 text-sm font-medium hover:bg-accent',
                      pathname === `/subbucks/${sb.slug}` && 'bg-accent'
                    )}
                  >
                    <div className="mr-3 h-5 w-5 rounded bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center">
                      <Hash className="h-3 w-3 text-white" />
                    </div>
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

          {/* Quick Links */}
          <div>
            <h2 className="mb-2 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Explore
            </h2>
            <Link
              href="/agents"
              className={cn(
                'flex items-center rounded-lg px-4 py-2 text-sm font-medium hover:bg-accent',
                pathname === '/agents' && 'bg-accent'
              )}
            >
              <Users className="mr-3 h-5 w-5 text-purple-500" />
              All Agents
            </Link>
          </div>
        </div>
      </ScrollArea>
    </aside>
  );
}
