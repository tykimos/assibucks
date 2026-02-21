'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/use-auth';
import { Loader2, Send, Hash, Paperclip, X, FileText, Image as ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MarkdownToolbar } from './markdown-toolbar';
import { parseMentions } from '@/lib/mentions';

interface Subbucks {
  id: string;
  slug: string;
  name: string;
}

interface AttachmentPreview {
  file: File;
  previewUrl?: string;
  uploading: boolean;
  uploaded?: {
    url: string;
    file_name: string;
    file_size: number;
    file_type: string;
    is_image: boolean;
  };
  error?: string;
}

interface CreatePostFormProps {
  defaultSubbucks?: string;
  onSuccess?: () => void;
  compact?: boolean;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function CreatePostForm({ defaultSubbucks, onSuccess, compact }: CreatePostFormProps = {}) {
  const { user } = useAuth();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [subbucksList, setSubbucksList] = useState<Subbucks[]>([]);
  const [selectedSubbucks, setSelectedSubbucks] = useState(defaultSubbucks || 'general');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [attachments, setAttachments] = useState<AttachmentPreview[]>([]);
  const [loading, setLoading] = useState(false);
  const [pasteUploading, setPasteUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('write');

  useEffect(() => {
    async function fetchSubbucks() {
      try {
        const response = await fetch('/api/v1/subbucks?limit=50');
        const result = await response.json();
        if (result.success && result.data?.subbucks) {
          setSubbucksList(result.data.subbucks);
        }
      } catch (err) {
        console.error('Failed to fetch subbucks:', err);
      }
    }
    fetchSubbucks();
  }, []);

  const uploadSingleFile = useCallback(async (file: File): Promise<{
    url: string;
    file_name: string;
    file_size: number;
    file_type: string;
    is_image: boolean;
  } | null> => {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/v1/upload/post-attachment', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      const result = await response.json();
      if (result.success) {
        return result.data;
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  const insertTextAtCursor = useCallback((text: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setContent((prev) => prev + text);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newContent = content.substring(0, start) + text + content.substring(end);
    setContent(newContent);
    requestAnimationFrame(() => {
      textarea.focus();
      const newPos = start + text.length;
      textarea.setSelectionRange(newPos, newPos);
    });
  }, [content]);

  const handlePaste = useCallback(async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) return;

        if (attachments.length >= 10) {
          setError('Maximum 10 attachments');
          return;
        }

        setPasteUploading(true);

        // Add placeholder text
        const placeholder = '![Uploading image...]()';
        const textarea = textareaRef.current;
        const cursorPos = textarea?.selectionStart ?? content.length;
        const newContent = content.substring(0, cursorPos) + placeholder + content.substring(cursorPos);
        setContent(newContent);

        const uploaded = await uploadSingleFile(file);

        if (uploaded) {
          // Replace placeholder with actual image
          setContent((prev) => prev.replace(placeholder, `![${uploaded.file_name}](${uploaded.url})`));

          // Add to attachments list
          setAttachments((prev) => [
            ...prev,
            {
              file,
              previewUrl: URL.createObjectURL(file),
              uploading: false,
              uploaded,
            },
          ]);
        } else {
          // Remove placeholder
          setContent((prev) => prev.replace(placeholder, ''));
          setError('Failed to upload pasted image');
        }

        setPasteUploading(false);
        return;
      }
    }
  }, [content, attachments.length, uploadSingleFile]);

  const handleImageInsert = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue;
      if (attachments.length >= 10) break;

      setPasteUploading(true);
      const uploaded = await uploadSingleFile(file);

      if (uploaded) {
        insertTextAtCursor(`![${uploaded.file_name}](${uploaded.url})\n`);
        setAttachments((prev) => [
          ...prev,
          {
            file,
            previewUrl: URL.createObjectURL(file),
            uploading: false,
            uploaded,
          },
        ]);
      } else {
        setError('Failed to upload image');
      }
      setPasteUploading(false);
    }

    if (imageInputRef.current) {
      imageInputRef.current.value = '';
    }
  }, [attachments.length, uploadSingleFile, insertTextAtCursor]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const remaining = 10 - attachments.length;
    const newFiles = Array.from(files).slice(0, remaining);

    const newAttachments: AttachmentPreview[] = newFiles.map((file) => {
      const isImage = file.type.startsWith('image/');
      return {
        file,
        previewUrl: isImage ? URL.createObjectURL(file) : undefined,
        uploading: false,
      };
    });

    setAttachments((prev) => [...prev, ...newAttachments]);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachments((prev) => {
      const att = prev[index];
      if (att.previewUrl) {
        URL.revokeObjectURL(att.previewUrl);
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  const uploadAttachments = async (): Promise<Array<{
    file_url: string;
    file_name: string;
    file_size: number;
    file_type: string;
    is_image: boolean;
    display_order: number;
  }> | null> => {
    const results = [];

    for (let i = 0; i < attachments.length; i++) {
      const att = attachments[i];

      if (att.uploaded) {
        results.push({
          file_url: att.uploaded.url,
          file_name: att.uploaded.file_name,
          file_size: att.uploaded.file_size,
          file_type: att.uploaded.file_type,
          is_image: att.uploaded.is_image,
          display_order: i,
        });
        continue;
      }

      setAttachments((prev) =>
        prev.map((a, idx) => (idx === i ? { ...a, uploading: true, error: undefined } : a))
      );

      const formData = new FormData();
      formData.append('file', att.file);

      try {
        const response = await fetch('/api/v1/upload/post-attachment', {
          method: 'POST',
          credentials: 'include',
          body: formData,
        });

        const result = await response.json();

        if (!result.success) {
          setAttachments((prev) =>
            prev.map((a, idx) =>
              idx === i ? { ...a, uploading: false, error: result.error?.message || 'Upload failed' } : a
            )
          );
          return null;
        }

        const uploaded = result.data;
        setAttachments((prev) =>
          prev.map((a, idx) => (idx === i ? { ...a, uploading: false, uploaded } : a))
        );

        results.push({
          file_url: uploaded.url,
          file_name: uploaded.file_name,
          file_size: uploaded.file_size,
          file_type: uploaded.file_type,
          is_image: uploaded.is_image,
          display_order: i,
        });
      } catch {
        setAttachments((prev) =>
          prev.map((a, idx) =>
            idx === i ? { ...a, uploading: false, error: 'Upload failed' } : a
          )
        );
        return null;
      }
    }

    return results;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !title.trim()) return;

    setLoading(true);
    setError(null);

    try {
      let uploadedAttachments;
      if (attachments.length > 0) {
        uploadedAttachments = await uploadAttachments();
        if (!uploadedAttachments) {
          setError('Failed to upload attachments');
          setLoading(false);
          return;
        }
      }

      const response = await fetch('/api/v1/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          subbucks: selectedSubbucks,
          title: title.trim(),
          content: content.trim() || undefined,
          post_type: 'text',
          attachments: uploadedAttachments,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        setError(result.error?.message || 'Failed to create post');
        return;
      }

      attachments.forEach((att) => {
        if (att.previewUrl) URL.revokeObjectURL(att.previewUrl);
      });

      setTitle('');
      setContent('');
      setAttachments([]);
      onSuccess?.();
      router.push(`/posts/${result.data.post.id}`);
      router.refresh();
    } catch {
      setError('Failed to create post');
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    if (compact) {
      return (
        <p className="py-4 text-center text-sm text-muted-foreground">
          Login to create a post
        </p>
      );
    }
    return (
      <Card>
        <CardContent className="py-4 text-center text-sm text-muted-foreground">
          Login to create a post
        </CardContent>
      </Card>
    );
  }

  const formContent = (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <Label htmlFor="subbucks" className="text-xs">Community</Label>
        <div className="relative mt-1">
          <Hash className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <select
            id="subbucks"
            value={selectedSubbucks}
            onChange={(e) => setSelectedSubbucks(e.target.value)}
            className="w-full h-9 pl-8 pr-3 rounded-md border border-input bg-background text-sm"
          >
            {subbucksList.map((sb) => (
              <option key={sb.id} value={sb.slug}>
                b/{sb.slug}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <Label htmlFor="title" className="text-xs">Title</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What's on your mind?"
          className="mt-1"
          maxLength={300}
          required
        />
      </div>

      <div>
        <Label className="text-xs">Content (optional, Markdown supported)</Label>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-1">
          <TabsList className="h-8">
            <TabsTrigger value="write" className="text-xs px-3 h-7">Write</TabsTrigger>
            <TabsTrigger value="preview" className="text-xs px-3 h-7">Preview</TabsTrigger>
          </TabsList>
          <TabsContent value="write" className="mt-1.5">
            <div className="border rounded-md p-2">
              <MarkdownToolbar
                textareaRef={textareaRef}
                value={content}
                onChange={setContent}
                onImageClick={() => imageInputRef.current?.click()}
              />
              <Textarea
                ref={textareaRef}
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onPaste={handlePaste}
                placeholder="Add more details... (Markdown supported, paste images with Ctrl+V)"
                className={cn("border-0 p-0 focus-visible:ring-0 resize-y", compact ? "min-h-[80px]" : "min-h-[120px]")}
                maxLength={10000}
              />
              {pasteUploading && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Uploading image...
                </div>
              )}
            </div>
          </TabsContent>
          <TabsContent value="preview" className="mt-1.5">
            <div className={cn(
              "border rounded-md p-3",
              compact ? "min-h-[80px]" : "min-h-[120px]"
            )}>
              {content.trim() ? (
                <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:scroll-mt-20 prose-code:before:content-none prose-code:after:content-none break-words overflow-hidden">
                  <ReactMarkdown
                    remarkPlugins={[remarkBreaks, remarkGfm, remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                  >
                    {parseMentions(content)}
                  </ReactMarkdown>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Nothing to preview</p>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Hidden image input for toolbar image button */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleImageInsert}
        className="hidden"
      />

      {/* Attachments */}
      <div>
        <div className="flex items-center justify-between">
          <Label className="text-xs">Attachments</Label>
          <span className="text-xs text-muted-foreground">{attachments.length}/10</span>
        </div>

        {attachments.length > 0 && (
          <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2">
            {attachments.map((att, index) => (
              <div
                key={index}
                className="relative group border rounded-lg overflow-hidden bg-muted/50"
              >
                {att.file.type.startsWith('image/') && att.previewUrl ? (
                  <img
                    src={att.previewUrl}
                    alt={att.file.name}
                    className="w-full h-24 object-cover"
                  />
                ) : (
                  <div className="w-full h-24 flex flex-col items-center justify-center gap-1 p-2">
                    <FileText className="h-8 w-8 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground truncate max-w-full">
                      {att.file.name}
                    </span>
                  </div>
                )}
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] px-1.5 py-0.5 truncate">
                  {att.file.name} ({formatFileSize(att.file.size)})
                </div>
                {att.uploading && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <Loader2 className="h-5 w-5 text-white animate-spin" />
                  </div>
                )}
                {att.error && (
                  <div className="absolute inset-0 bg-red-500/20 flex items-center justify-center">
                    <span className="text-[10px] text-red-500 font-medium">{att.error}</span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => handleRemoveAttachment(index)}
                  className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {attachments.length < 10 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => fileInputRef.current?.click()}
          >
            <Paperclip className="h-4 w-4 mr-1" />
            Add Files
          </Button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,application/pdf,.zip,.txt,.csv,.json,.doc,.docx,.xls,.xlsx"
          onChange={handleFileSelect}
          className="hidden"
        />
        <p className="text-[10px] text-muted-foreground mt-1">
          Max 10MB per file. Images, PDF, ZIP, text files.
        </p>
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <Button type="submit" disabled={loading || !title.trim()} className="w-full">
        {loading ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Send className="h-4 w-4 mr-2" />
        )}
        Post
      </Button>
    </form>
  );

  if (compact) {
    return formContent;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Create Post</CardTitle>
      </CardHeader>
      <CardContent>
        {formContent}
      </CardContent>
    </Card>
  );
}
