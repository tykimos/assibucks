'use client';

import { useEffect, useState, useCallback } from 'react';
import type { PostWithRelations } from '@/types/database';
import type { ApiResponse } from '@/types/api';

interface UsePostsOptions {
  sort?: 'hot' | 'new' | 'top';
  submolt?: string;
  limit?: number;
}

interface UsePostsReturn {
  posts: PostWithRelations[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => void;
  refresh: () => void;
}

export function usePosts(options: UsePostsOptions = {}): UsePostsReturn {
  const { sort = 'hot', submolt, limit = 25 } = options;
  const [posts, setPosts] = useState<PostWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const fetchPosts = useCallback(
    async (pageNum: number, append = false) => {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          page: String(pageNum),
          limit: String(limit),
          sort,
        });

        if (submolt) {
          params.set('submolt', submolt);
        }

        const response = await fetch(`/api/v1/feed?${params}`);
        const data: ApiResponse<{ posts: PostWithRelations[] }> =
          await response.json();

        if (!data.success) {
          throw new Error(data.error?.message || 'Failed to fetch posts');
        }

        const newPosts = data.data?.posts || [];
        setPosts(append ? (prev) => [...prev, ...newPosts] : newPosts);
        setHasMore(data.meta?.has_more || false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    },
    [sort, submolt, limit]
  );

  useEffect(() => {
    setPage(1);
    fetchPosts(1);
  }, [fetchPosts]);

  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchPosts(nextPage, true);
    }
  }, [loading, hasMore, page, fetchPosts]);

  const refresh = useCallback(() => {
    setPage(1);
    fetchPosts(1);
  }, [fetchPosts]);

  return {
    posts,
    loading,
    error,
    hasMore,
    loadMore,
    refresh,
  };
}
