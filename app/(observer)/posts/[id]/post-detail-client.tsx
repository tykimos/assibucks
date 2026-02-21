'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { VoteButtons } from '@/components/feed/vote-buttons';
import { CommentThread } from '@/components/posts/comment-thread';
import { CommentForm } from '@/components/posts/comment-form';
import { Button } from '@/components/ui/button';
import { MessageSquare, Hash, Bot, User, Trash2, Loader2, Paperclip, Download, FileText, Pencil, X, Check } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MarkdownToolbar } from '@/components/posts/markdown-toolbar';
import { useAuth } from '@/hooks/use-auth';
import { LinkPreview } from '@/components/feed/link-preview';
import { parseMentions } from '@/lib/mentions';
import type { PostWithRelations, CommentWithRelations } from '@/types/database';
import type { ApiResponse } from '@/types/api';

interface PostDetailData {
  post: PostWithRelations;
  comments: CommentWithRelations[];
}

export default function PostDetailClient() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const postId = params.id as string;
  const [data, setData] = useState<PostDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editTab, setEditTab] = useState('write');
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [refreshKey, setRefreshKey] = useState(0);

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

  const handleStartEdit = () => {
    if (!data?.post) return;
    setEditTitle(data.post.title);
    setEditContent(data.post.content || '');
    setEditTab('write');
    setEditing(true);
  };

  const handleCancelEdit = () => {
    setEditing(false);
  };

  const handleSaveEdit = async () => {
    if (!editTitle.trim()) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/v1/posts/${postId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: editTitle.trim(),
          content: editContent.trim() || null,
        }),
      });
      const result = await response.json();
      if (result.success) {
        setEditing(false);
        setRefreshKey((k) => k + 1);
      } else {
        alert(result.error?.message || 'Failed to update post');
      }
    } catch {
      alert('Failed to update post');
    } finally {
      setSaving(false);
    }
  };

  // Check if current user is the author
  const isAuthor = user && data?.post && (
    (data.post.observer_id && data.post.observer_id === user.id) ||
    (data.post.author_type === 'human' && data.post.observer?.id === user.id)
  );

  const fetchPost = async () => {
    try {
      const response = await fetch(`/api/v1/posts/${postId}`);
      const result: ApiResponse<PostDetailData> = await response.json();

      if (!result.success) {
        setError(result.error?.message || 'Failed to load post');
        return;
      }

      setData(result.data || null);
    } catch {
      setError('Failed to load post');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPost();
  }, [postId, refreshKey]);

  const handleCommentSuccess = () => {
    setRefreshKey((k) => k + 1);
  };

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
              {editing ? (
                <Input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="text-xl font-semibold mt-2"
                  maxLength={300}
                />
              ) : (
                <h1 className="text-xl font-semibold mt-2">{post.title}</h1>
              )}
            </CardHeader>
            <CardContent>
              {editing ? (
                <div className="space-y-3">
                  <Tabs value={editTab} onValueChange={setEditTab}>
                    <TabsList className="h-8">
                      <TabsTrigger value="write" className="text-xs px-3 h-7">Write</TabsTrigger>
                      <TabsTrigger value="preview" className="text-xs px-3 h-7">Preview</TabsTrigger>
                    </TabsList>
                    <TabsContent value="write" className="mt-1.5">
                      <div className="border rounded-md p-2">
                        <MarkdownToolbar
                          textareaRef={editTextareaRef}
                          value={editContent}
                          onChange={setEditContent}
                        />
                        <Textarea
                          ref={editTextareaRef}
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          placeholder="Content (Markdown supported)"
                          className="border-0 p-0 focus-visible:ring-0 resize-y min-h-[150px]"
                          maxLength={40000}
                        />
                      </div>
                    </TabsContent>
                    <TabsContent value="preview" className="mt-1.5">
                      <div className="border rounded-md p-3 min-h-[150px]">
                        {editContent.trim() ? (
                          <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:scroll-mt-20 prose-code:before:content-none prose-code:after:content-none break-words overflow-hidden">
                            <ReactMarkdown remarkPlugins={[remarkBreaks, remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{parseMentions(editContent)}</ReactMarkdown>
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">Nothing to preview</p>
                        )}
                      </div>
                    </TabsContent>
                  </Tabs>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleSaveEdit} disabled={saving || !editTitle.trim()}>
                      {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
                      Save
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleCancelEdit} disabled={saving}>
                      <X className="h-4 w-4 mr-1" />
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  {post.post_type === 'link' && post.url && (
                    <LinkPreview url={post.url} />
                  )}
                  {post.content && (
                    <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:scroll-mt-20 prose-code:before:content-none prose-code:after:content-none break-words overflow-hidden">
                      <ReactMarkdown remarkPlugins={[remarkBreaks, remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{parseMentions(post.content)}</ReactMarkdown>
                    </div>
                  )}
                  {/* Attachments */}
                  {post.attachments && post.attachments.length > 0 && (() => {
                    const images = post.attachments.filter((a) => a.is_image);
                    const files = post.attachments.filter((a) => !a.is_image);
                    return (
                      <div className="mt-4 space-y-3">
                        {images.length > 0 && (
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {images.map((img) => (
                              <a
                                key={img.id}
                                href={img.file_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="relative rounded-lg overflow-hidden border hover:opacity-90 transition-opacity"
                              >
                                <img
                                  src={img.file_url}
                                  alt={img.file_name}
                                  className="w-full h-32 sm:h-40 object-cover"
                                />
                              </a>
                            ))}
                          </div>
                        )}
                        {files.length > 0 && (
                          <div className="space-y-1.5">
                            {files.map((file) => (
                              <a
                                key={file.id}
                                href={file.file_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 p-2 rounded-lg border hover:bg-accent/50 transition-colors text-sm"
                              >
                                <FileText className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                                <span className="truncate flex-1">{file.file_name}</span>
                                <span className="text-xs text-muted-foreground flex-shrink-0">
                                  {file.file_size < 1024 * 1024
                                    ? `${(file.file_size / 1024).toFixed(1)} KB`
                                    : `${(file.file_size / (1024 * 1024)).toFixed(1)} MB`}
                                </span>
                                <Download className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </>
              )}
              <div className="flex items-center gap-4 mt-4">
                {post.is_pinned && <Badge variant="secondary">Pinned</Badge>}
                {post.is_locked && <Badge variant="outline">Locked</Badge>}
                {isAuthor && !editing && (
                  <div className="flex gap-1 ml-auto">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleStartEdit}
                    >
                      <Pencil className="h-4 w-4" />
                      <span className="ml-1">Edit</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
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
                  </div>
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
        {!post.is_locked && (
          <div className="mb-6">
            <CommentForm postId={post.id} onSuccess={handleCommentSuccess} />
          </div>
        )}
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
