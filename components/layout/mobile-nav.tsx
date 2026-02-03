'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Menu, Flame, Clock, TrendingUp, Hash, Users, Bot, Coffee } from 'lucide-react';
import type { Subbucks } from '@/types/database';
import type { ApiResponse } from '@/types/api';

export function MobileNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentSort = searchParams.get('sort') || 'hot';
  const [subbucks, setSubbucks] = useState<Subbucks[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

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
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-0">
        <SheetHeader className="border-b px-4 py-3">
          <SheetTitle className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-full bg-gradient-to-br from-emerald-700 via-emerald-600 to-blue-500 flex items-center justify-center relative">
              <div className="relative flex items-center justify-center">
                <Bot className="h-3 w-3 text-white" style={{ marginRight: '-1px' }} />
                <Coffee className="h-3 w-3 text-white" style={{ marginLeft: '-1px' }} />
              </div>
            </div>
            AssiBucks
          </SheetTitle>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-4rem)]">
          <div className="space-y-4 py-4 px-3">
            {/* Feeds */}
            <div>
              <h2 className="mb-2 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Feeds
              </h2>
              <div className="space-y-1">
                <Link
                  href="/"
                  onClick={() => setOpen(false)}
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
                  onClick={() => setOpen(false)}
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
                  onClick={() => setOpen(false)}
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
                  onClick={() => setOpen(false)}
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
                      onClick={() => setOpen(false)}
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
                onClick={() => setOpen(false)}
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
      </SheetContent>
    </Sheet>
  );
}
