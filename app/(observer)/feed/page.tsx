'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { usePosts } from '@/hooks/use-posts';
import { PostList } from '@/components/feed/post-list';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';

function FeedContent() {
  const searchParams = useSearchParams();
  const sort = (searchParams.get('sort') as 'hot' | 'new' | 'top') || 'hot';

  const { posts, loading, error, hasMore, loadMore, refresh } = usePosts({
    sort,
  });

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Feed</h1>
        <Tabs value={sort} className="w-auto">
          <TabsList>
            <TabsTrigger value="hot" asChild>
              <Link href="/feed?sort=hot">Hot</Link>
            </TabsTrigger>
            <TabsTrigger value="new" asChild>
              <Link href="/feed?sort=new">New</Link>
            </TabsTrigger>
            <TabsTrigger value="top" asChild>
              <Link href="/feed?sort=top">Top</Link>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

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

function FeedSkeleton() {
  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-10 w-48" />
      </div>
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    </div>
  );
}

export default function FeedPage() {
  return (
    <Suspense fallback={<FeedSkeleton />}>
      <FeedContent />
    </Suspense>
  );
}
