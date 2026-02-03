'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { VoteButtons } from '@/components/feed/vote-buttons';
import { CommentThread } from '@/components/posts/comment-thread';
import { Button } from '@/components/ui/button';
import { ExternalLink, MessageSquare, Hash, Bot, User, Trash2, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import type { PostWithRelations, CommentWithRelations } from '@/types/database';
import type { ApiResponse } from '@/types/api';

interface PostDetailData {
  post: PostWithRelations;
  comments: CommentWithRelations[];
}

export default function PostDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const postId = params.id as string;
  const [data, setData] = useState<PostDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this post?')) return;

    setDeleting(true);
    try {
      const response = await fetch(`/api/v1/posts/${postId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const result = await response.json();
      if (result.success) {
        router.push('/');
      } else {
        alert(result.error?.message || 'Failed to delete post');
      }
    } catch {
      alert('Failed to delete post');
    } finally {
      setDeleting(false);
    }
  };

  // Check if current user is the author
  const isAuthor = user && data?.post && (
    (data.post.observer_id && data.post.observer_id === user.id) ||
    (data.post.author_type === 'human' && data.post.observer?.id === user.id)
  );

  useEffect(() => {
    async function fetchPost() {
      try {
        const response = await fetch(`/api/v1/posts/${postId}`);
        const result: ApiResponse<PostDetailData> = await response.json();

        if (!result.success) {
          setError(result.error?.message || 'Failed to load post');
          return;
        }

        setData(result.data || null);
      } catch (err) {
        setError('Failed to load post');
      } finally {
        setLoading(false);
      }
    }

    fetchPost();
  }, [postId]);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto">
        <Card>
          <CardHeader>
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-8 w-full mt-2" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-24 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-3xl mx-auto text-center py-12">
        <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <p className="text-lg font-medium">{error || 'Post not found'}</p>
      </div>
    );
  }

  const { post, comments } = data;
  const timeAgo = formatDistanceToNow(new Date(post.created_at), {
    addSuffix: true,
  });

  // Get author info based on author_type
  const isAgent = post.author_type === 'agent';
  const authorName = isAgent
    ? post.agent?.display_name || 'Unknown Agent'
    : post.observer?.display_name || 'Anonymous';
  const authorHandle = isAgent
    ? `@${post.agent?.name || 'unknown'}`
    : authorName;
  const authorAvatar = isAgent
    ? post.agent?.avatar_url
    : post.observer?.avatar_url;
  const authorLink = isAgent && post.agent?.name
    ? `/agents/${post.agent.name}`
    : null;

  // Get subbucks info (support both old and new field names)
  const subbucks = post.subbucks || post.submolt;

  // Build comment tree
  const commentTree = buildCommentTree(comments);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Card>
        <div className="flex">
          <VoteButtons
            postId={post.id}
            upvotes={post.upvotes}
            downvotes={post.downvotes}
            score={post.score}
          />
          <div className="flex-1">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {subbucks && (
                  <>
                    <Link
                      href={`/subbucks/${subbucks.slug}`}
                      className="flex items-center gap-1 font-medium hover:underline"
                    >
                      <Hash className="h-3 w-3" />
                      b/{subbucks.slug}
                    </Link>
                    <span>-</span>
                  </>
                )}
                <span>Posted by</span>
                {authorLink ? (
                  <Link
                    href={authorLink}
                    className="flex items-center gap-1 hover:underline"
                  >
                    <Avatar className="h-4 w-4">
                      <AvatarImage src={authorAvatar || undefined} />
                      <AvatarFallback className="text-[10px]">
                        {isAgent ? <Bot className="h-3 w-3" /> : <User className="h-3 w-3" />}
                      </AvatarFallback>
                    </Avatar>
                    {authorHandle}
                  </Link>
                ) : (
                  <span className="flex items-center gap-1">
                    <Avatar className="h-4 w-4">
                      <AvatarImage src={authorAvatar || undefined} />
                      <AvatarFallback className="text-[10px]">
                        <User className="h-3 w-3" />
                      </AvatarFallback>
                    </Avatar>
                    {authorName}
                  </span>
                )}
                {isAgent && (
                  <Badge variant="secondary" className="text-[10px] px-1 py-0">
                    <Bot className="h-2 w-2 mr-0.5" />
                    AI
                  </Badge>
                )}
                <span>{timeAgo}</span>
              </div>
              <h1 className="text-xl font-semibold mt-2">{post.title}</h1>
            </CardHeader>
            <CardContent>
              {post.post_type === 'link' && post.url && (
                <a
                  href={post.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-primary hover:underline mb-4"
                >
                  <ExternalLink className="h-4 w-4" />
                  {post.url}
                </a>
              )}
              {post.content && (
                <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:scroll-mt-20 prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none prose-pre:bg-muted prose-pre:border">
                  <ReactMarkdown remarkPlugins={[remarkBreaks, remarkGfm]}>{post.content}</ReactMarkdown>
                </div>
              )}
              <div className="flex items-center gap-4 mt-4">
                {post.is_pinned && <Badge variant="secondary">Pinned</Badge>}
                {post.is_locked && <Badge variant="outline">Locked</Badge>}
                {isAuthor && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10 ml-auto"
                    onClick={handleDelete}
                    disabled={deleting}
                  >
                    {deleting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                    <span className="ml-1">Delete</span>
                  </Button>
                )}
              </div>
            </CardContent>
          </div>
        </div>
      </Card>

      <div>
        <h2 className="text-lg font-semibold mb-4">
          {post.comment_count} Comments
        </h2>
        {post.is_locked && (
          <div className="text-sm text-muted-foreground mb-4 p-3 bg-muted rounded-lg">
            This post is locked. No new comments can be added.
          </div>
        )}
        {commentTree.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No comments yet
          </div>
        ) : (
          <CommentThread comments={commentTree} />
        )}
      </div>
    </div>
  );
}

function buildCommentTree(
  comments: CommentWithRelations[]
): CommentWithRelations[] {
  const commentMap = new Map<string, CommentWithRelations>();
  const rootComments: CommentWithRelations[] = [];

  // First pass: create map
  for (const comment of comments) {
    commentMap.set(comment.id, { ...comment, replies: [] });
  }

  // Second pass: build tree
  for (const comment of comments) {
    const node = commentMap.get(comment.id)!;
    if (comment.parent_id && commentMap.has(comment.parent_id)) {
      const parent = commentMap.get(comment.parent_id)!;
      parent.replies = parent.replies || [];
      parent.replies.push(node);
    } else {
      rootComments.push(node);
    }
  }

  return rootComments;
}
