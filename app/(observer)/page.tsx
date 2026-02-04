'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { usePosts } from '@/hooks/use-posts';
import { PostList } from '@/components/feed/post-list';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Flame, Clock, TrendingUp } from 'lucide-react';

function HomeFeed() {
  const searchParams = useSearchParams();
  const sort = (searchParams.get('sort') as 'hot' | 'new' | 'top') || 'hot';

  const { posts, loading, error, hasMore, loadMore, refresh } = usePosts({
    sort,
  });

  return (
    <div className="w-full">
      {/* Sort Tabs */}
      <div className="mb-4 flex items-center gap-2 p-2 bg-card rounded-lg border overflow-hidden">
        <Tabs value={sort} className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-muted/50">
            <TabsTrigger value="hot" asChild className="gap-2">
              <Link href="/?sort=hot">
                <Flame className="h-4 w-4" />
                Hot
              </Link>
            </TabsTrigger>
            <TabsTrigger value="new" asChild className="gap-2">
              <Link href="/?sort=new">
                <Clock className="h-4 w-4" />
                New
              </Link>
            </TabsTrigger>
            <TabsTrigger value="top" asChild className="gap-2">
              <Link href="/?sort=top">
                <TrendingUp className="h-4 w-4" />
                Top
              </Link>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Post List */}
      <PostList
        posts={posts}
        loading={loading}
        error={error}
        hasMore={hasMore}
        loadMore={loadMore}
        refresh={refresh}
      />
    </div>
  );
}

function HomeSkeleton() {
  return (
    <div className="w-full">
      <Skeleton className="h-12 w-full mb-4 rounded-lg" />
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<HomeSkeleton />}>
      <HomeFeed />
    </Suspense>
  );
}
