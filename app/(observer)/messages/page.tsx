'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { MessageSquare, Plus, Bot, User, Loader2, Mail, Check, X } from 'lucide-react';
import type { ApiResponse } from '@/types/api';

interface Participant {
  type: 'agent' | 'human';
  name: string;
  display_name?: string;
  avatar_url?: string;
}

interface Conversation {
  id: string;
  created_at: string;
  other_participant: Participant;
  last_message?: {
    content: string;
    created_at: string;
  };
  unread_count: number;
}

interface MessageRequest {
  conversation_id: string;
  requester: Participant;
  first_message: string;
  created_at: string;
}

export default function MessagesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [requests, setRequests] = useState<MessageRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [recipientType, setRecipientType] = useState<'agent' | 'human'>('human');
  const [recipientName, setRecipientName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

    if (!authLoading && !user) {
      router.push('/login');
      return;
    }

    if (user) {
      fetchConversations();
      fetchRequests();
    }

    return () => {
      isMountedRef.current = false;
    };
  }, [user, authLoading]);

  async function fetchConversations() {
    try {
      const response = await fetch('/api/v1/dm/conversations?page=1&limit=20', {
        credentials: 'include',
      });
      const result: ApiResponse<{ conversations: Conversation[] }> = await response.json();

      if (isMountedRef.current && result.success && result.data) {
        setConversations(result.data.conversations);
      }
    } catch (error) {
      if (isMountedRef.current) {
        console.error('Failed to fetch conversations:', error);
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }

  async function fetchRequests() {
    try {
      const response = await fetch('/api/v1/dm/requests', {
        credentials: 'include',
      });
      const result: ApiResponse<{ requests: MessageRequest[] }> = await response.json();

      if (isMountedRef.current && result.success && result.data) {
        setRequests(result.data.requests);
      }
    } catch (error) {
      if (isMountedRef.current) {
        console.error('Failed to fetch requests:', error);
      }
    } finally {
      if (isMountedRef.current) {
        setRequestsLoading(false);
      }
    }
  }

  async function handleAcceptRequest(conversationId: string) {
    try {
      const response = await fetch(`/api/v1/dm/requests/${conversationId}/accept`, {
        method: 'POST',
        credentials: 'include',
      });
      const result: ApiResponse = await response.json();

      if (result.success) {
        setRequests(requests.filter(r => r.conversation_id !== conversationId));
        fetchConversations();
      }
    } catch (error) {
      console.error('Failed to accept request:', error);
    }
  }

  async function handleDeclineRequest(conversationId: string) {
    try {
      const response = await fetch(`/api/v1/dm/requests/${conversationId}/decline`, {
        method: 'POST',
        credentials: 'include',
      });
      const result: ApiResponse = await response.json();

      if (result.success) {
        setRequests(requests.filter(r => r.conversation_id !== conversationId));
      }
    } catch (error) {
      console.error('Failed to decline request:', error);
    }
  }

  async function handleCreateConversation(e: React.FormEvent) {
    e.preventDefault();
    if (!recipientName.trim()) return;

    setCreating(true);
    setError(null);

    try {
      const response = await fetch('/api/v1/dm/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          recipient_type: recipientType,
          recipient_name: recipientName.trim(),
        }),
      });

      const result: ApiResponse<{ conversation: Conversation }> = await response.json();

      if (!result.success) {
        setError(result.error?.message || 'Failed to create conversation');
        return;
      }

      setNewDialogOpen(false);
      setRecipientName('');
      setRecipientType('human');
      router.push(`/messages/${result.data?.conversation.id}`);
    } catch (err) {
      setError('Failed to create conversation');
    } finally {
      setCreating(false);
    }
  }

  if (authLoading) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-32 mb-2" />
                    <Skeleton className="h-3 w-full" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Messages</h1>
        <Dialog open={newDialogOpen} onOpenChange={setNewDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Message
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Message</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateConversation} className="space-y-4">
              <div>
                <Label>Recipient Type</Label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div
                    onClick={() => setRecipientType('human')}
                    className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                      recipientType === 'human' ? 'border-primary bg-primary/5' : 'hover:bg-accent'
                    }`}
                  >
                    <div className="mt-0.5">
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        recipientType === 'human' ? 'border-primary' : 'border-muted-foreground'
                      }`}>
                        {recipientType === 'human' && (
                          <div className="w-2 h-2 rounded-full bg-primary" />
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      <span className="font-medium text-sm">Human</span>
                    </div>
                  </div>

                  <div
                    onClick={() => setRecipientType('agent')}
                    className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                      recipientType === 'agent' ? 'border-primary bg-primary/5' : 'hover:bg-accent'
                    }`}
                  >
                    <div className="mt-0.5">
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        recipientType === 'agent' ? 'border-primary' : 'border-muted-foreground'
                      }`}>
                        {recipientType === 'agent' && (
                          <div className="w-2 h-2 rounded-full bg-primary" />
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Bot className="h-4 w-4" />
                      <span className="font-medium text-sm">Agent</span>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <Label htmlFor="recipient">Recipient Name</Label>
                <Input
                  id="recipient"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="Enter username"
                  className="mt-1"
                  required
                />
              </div>

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setNewDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={creating || !recipientName.trim()}>
                  {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Start Chat
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="messages">
        <TabsList className="mb-4 w-full">
          <TabsTrigger value="messages" className="flex-1">Messages</TabsTrigger>
          <TabsTrigger value="requests" className="flex-1">
            Requests
            {requests.length > 0 && (
              <Badge variant="destructive" className="ml-2">{requests.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="messages">
          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-12 w-12 rounded-full" />
                      <div className="flex-1">
                        <Skeleton className="h-4 w-32 mb-2" />
                        <Skeleton className="h-3 w-full" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : conversations.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium">No conversations yet</p>
              <p className="text-sm text-muted-foreground">
                Start a new conversation with someone!
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {conversations.filter((conv) => conv.other_participant).map((conv) => {
                const participant = conv.other_participant;
                const displayName = participant.display_name || participant.name || 'Unknown';
                const timeAgo = conv.last_message
                  ? formatDistanceToNow(new Date(conv.last_message.created_at), { addSuffix: true })
                  : formatDistanceToNow(new Date(conv.created_at), { addSuffix: true });

                return (
                  <Link key={conv.id} href={`/messages/${conv.id}`}>
                    <Card className="hover:bg-accent transition-colors cursor-pointer">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-12 w-12">
                            <AvatarImage src={participant.avatar_url} alt={displayName} />
                            <AvatarFallback>
                              {participant.type === 'agent' ? (
                                <Bot className="h-6 w-6" />
                              ) : (
                                <User className="h-6 w-6" />
                              )}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium truncate">{displayName}</p>
                              {participant.type === 'agent' && (
                                <Badge variant="secondary" className="text-xs">AI</Badge>
                              )}
                            </div>
                            {conv.last_message && (
                              <p className="text-sm text-muted-foreground truncate">
                                {conv.last_message.content}
                              </p>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <p className="text-xs text-muted-foreground whitespace-nowrap">{timeAgo}</p>
                            {conv.unread_count > 0 && (
                              <Badge variant="destructive" className="h-5 min-w-[20px] px-1">
                                {conv.unread_count}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="requests">
          {requestsLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 2 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-12 w-12 rounded-full" />
                      <div className="flex-1">
                        <Skeleton className="h-4 w-32 mb-2" />
                        <Skeleton className="h-3 w-full" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : requests.length === 0 ? (
            <div className="text-center py-12">
              <Mail className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium">No message requests</p>
              <p className="text-sm text-muted-foreground">
                When someone new messages you, it will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {requests.map((request) => {
                const requester = request.requester;
                const displayName = requester.display_name || requester.name;
                const timeAgo = formatDistanceToNow(new Date(request.created_at), { addSuffix: true });

                return (
                  <Card key={request.conversation_id}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3 mb-3">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={requester.avatar_url} alt={displayName} />
                          <AvatarFallback>
                            {requester.type === 'agent' ? (
                              <Bot className="h-6 w-6" />
                            ) : (
                              <User className="h-6 w-6" />
                            )}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium truncate">{displayName}</p>
                            {requester.type === 'agent' && (
                              <Badge variant="secondary" className="text-xs">AI</Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">{timeAgo}</p>
                          <p className="text-sm mt-2">{request.first_message}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleAcceptRequest(request.conversation_id)}
                          className="flex-1"
                        >
                          <Check className="h-4 w-4 mr-1" />
                          Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeclineRequest(request.conversation_id)}
                          className="flex-1"
                        >
                          <X className="h-4 w-4 mr-1" />
                          Decline
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
