'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '@/hooks/use-auth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Send, Bot, User, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ApiResponse } from '@/types/api';

interface Participant {
  type: 'agent' | 'human';
  id?: string;
  name?: string;
  display_name?: string;
  avatar_url?: string;
}

interface Message {
  id: string;
  conversation_id: string;
  sender_type: 'agent' | 'human';
  sender_name: string;
  sender_id: string;
  content: string;
  is_edited: boolean;
  created_at: string;
}

interface ConversationDetail {
  id: string;
  created_at: string;
  other_participant: Participant;
  status: 'pending' | 'accepted' | 'declined';
}

export default function ChatPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const conversationId = params.conversationId as string;

  const [conversation, setConversation] = useState<ConversationDetail | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }

    if (user && conversationId) {
      fetchConversation();
      fetchMessages();
      markAsRead();
    }
  }, [user, authLoading, conversationId, router]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  async function fetchConversation() {
    try {
      const response = await fetch(`/api/v1/dm/conversations/${conversationId}`, {
        credentials: 'include',
      });
      const result: ApiResponse<{ conversation: ConversationDetail }> = await response.json();

      if (result.success && result.data) {
        setConversation(result.data.conversation);
      }
    } catch (error) {
      console.error('Failed to fetch conversation:', error);
    }
  }

  async function fetchMessages() {
    try {
      const response = await fetch(`/api/v1/dm/conversations/${conversationId}/messages?limit=50`, {
        credentials: 'include',
      });
      const result: ApiResponse<{ messages: Message[] }> = await response.json();

      if (result.success && result.data) {
        // Messages come in DESC order (newest first), reverse for display
        setMessages([...result.data.messages].reverse());
      }
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    } finally {
      setLoading(false);
    }
  }

  async function markAsRead() {
    try {
      await fetch(`/api/v1/dm/conversations/${conversationId}/read`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    const messageContent = newMessage.trim();
    setNewMessage('');
    setSending(true);

    try {
      const response = await fetch(`/api/v1/dm/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ content: messageContent }),
      });

      const result: ApiResponse<{ message: Message }> = await response.json();

      if (result.success && result.data) {
        setMessages([...messages, result.data.message]);
        markAsRead();
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      setNewMessage(messageContent);
    } finally {
      setSending(false);
    }
  }

  function isOwnMessage(message: Message): boolean {
    if (!user) return false;
    return message.sender_id === user.id;
  }

  if (authLoading || loading) {
    return (
      <div className="max-w-2xl mx-auto flex flex-col h-[calc(100vh-4rem)]">
        <div className="flex items-center gap-3 p-4 border-b">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-8 w-8 rounded-full" />
          <div className="flex-1">
            <Skeleton className="h-4 w-32 mb-1" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
        <div className="flex-1 p-4 space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className={cn("flex", i % 2 === 0 ? "justify-start" : "justify-end")}>
              <Skeleton className={cn("h-16 rounded-lg", i % 2 === 0 ? "w-2/3" : "w-1/2")} />
            </div>
          ))}
        </div>
        <div className="p-4 border-t">
          <Skeleton className="h-9 w-full" />
        </div>
      </div>
    );
  }

  if (!user || !conversation) {
    return null;
  }

  const participant = conversation.other_participant;
  const displayName = participant.display_name || participant.name;

  return (
    <div className="max-w-2xl mx-auto flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b bg-background">
        <Button asChild variant="ghost" size="icon">
          <Link href="/messages">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <Avatar className="h-8 w-8">
          <AvatarImage src={participant.avatar_url} alt={displayName} />
          <AvatarFallback>
            {participant.type === 'agent' ? (
              <Bot className="h-4 w-4" />
            ) : (
              <User className="h-4 w-4" />
            )}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <p className="font-medium">{displayName}</p>
          <p className="text-xs text-muted-foreground">
            {participant.type === 'agent' ? 'AI Agent' : 'Human'}
          </p>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-center">
            <div>
              <p className="text-muted-foreground">No messages yet</p>
              <p className="text-sm text-muted-foreground">Send a message to start the conversation</p>
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg) => {
              const isOwn = isOwnMessage(msg);
              const timeAgo = formatDistanceToNow(new Date(msg.created_at), { addSuffix: true });

              return (
                <div
                  key={msg.id}
                  className={cn(
                    "flex",
                    isOwn ? "justify-end" : "justify-start"
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[80%] rounded-lg p-3",
                      isOwn
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    )}
                  >
                    <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                    <p className={cn(
                      "text-xs mt-1",
                      isOwn ? "opacity-70" : "opacity-60"
                    )}>
                      {timeAgo}
                      {msg.is_edited && ' (edited)'}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input area */}
      <form onSubmit={handleSend} className="p-4 border-t bg-background flex gap-2">
        <Input
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type a message..."
          className="flex-1"
          disabled={sending}
        />
        <Button type="submit" disabled={!newMessage.trim() || sending} size="icon">
          {sending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </form>
    </div>
  );
}
